import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { homeOf, isSite, SITE_HANDLES, SITES, type Site } from "@/lib/sites";
import { absolute, cms } from "@/lib/statamic";

type Props = { params: Promise<{ site: string; slug: string }> };

/** Pre-render every published post of each site at build time (`site` comes from the layout). */
export async function generateStaticParams({ params }: { params: { site: string } }) {
  const { data } = await cms.collections("blog").site(params.site).fields(["slug"]).get();
  return data.map((post) => ({ slug: post.slug }));
}

async function getPost(params: Props["params"]) {
  const { site, slug } = await params;
  if (!isSite(site)) notFound();
  // Slugs are per site: /de/blog/hallo-headquery is the German version of /blog/hello-headquery.
  const post = await cms.collections("blog").find(slug).site(site).get();
  if (!post) notFound();
  return { site, post: post.data };
}

/** The same post in the other sites: find(id) with site() returns that site's localization, or null. */
async function getTranslations(site: Site, id: string) {
  const others = SITE_HANDLES.filter((s) => s !== site);
  const found = await Promise.all(
    others.map((s) => cms.collections("blog").find(id).site(s).fields(["title", "url"]).get()),
  );
  return others.flatMap((s, i) => {
    const data = found[i]?.data;
    return data?.url ? [{ site: s, title: data.title, url: data.url }] : [];
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { post } = await getPost(params);
  return { title: post.title };
}

export default async function PostPage({ params }: Props) {
  const { site, post } = await getPost(params);
  const t = SITES[site].t;
  const translations = await getTranslations(site, post.id);

  return (
    <article>
      <p>
        <Link href={homeOf(site)}>← {t.allPosts}</Link>
      </p>

      <h1>{post.title}</h1>

      <p className="meta">
        {post.date?.slice(0, 10)}
        {post.author?.name && <> · {post.author.name}</>}
        {post.reading_time && <> · {post.reading_time} min</>}
        {post.stage.label && <> · {post.stage.label}</>}
      </p>

      {post.hero && <img className="hero" src={absolute(post.hero.url)} alt={post.hero.alt ?? ""} />}

      {typeof post.content === "string" && <div dangerouslySetInnerHTML={{ __html: post.content }} />}

      {post.sections.map((section, i) =>
        section.type === "quote" ? (
          <blockquote key={section.id ?? i}>
            {section.text}
            {section.cite && <cite> — {section.cite}</cite>}
          </blockquote>
        ) : (
          <div key={section.id ?? i} className="gallery">
            {section.images.map((img) => (
              <img key={img.id} src={absolute(img.url)} alt={img.alt ?? ""} />
            ))}
          </div>
        ),
      )}

      {post.tags.length > 0 && (
        <p className="meta">
          {t.tags}: {post.tags.map((tag) => tag.title).join(", ")}
        </p>
      )}

      {post.related.length > 0 && (
        <>
          <h2>{t.related}</h2>
          <ul>
            {post.related.map((r) => (
              <li key={r.id}>
                {/* Related entries carry no slug; Statamic's `url` (/blog/{slug}) matches this app's route. */}
                <Link href={r.url ?? "/"}>{r.title}</Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {translations.length > 0 && (
        <p className="meta">
          {t.alsoIn}:{" "}
          {translations.map((tr) => (
            <Link key={tr.site} href={tr.url} hrefLang={SITES[tr.site].lang}>
              {SITES[tr.site].label} ({tr.title})
            </Link>
          ))}
        </p>
      )}
    </article>
  );
}
