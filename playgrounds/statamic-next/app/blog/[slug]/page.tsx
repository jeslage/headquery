import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HeadqueryHttpError } from "@headquery/statamic";
import { absolute, cms } from "@/lib/statamic";

type Props = { params: Promise<{ slug: string }> };

const blog = cms.collection("blog");

/** Pre-render every published post at build time. */
export async function generateStaticParams() {
  const { data } = await blog.entries().fields(["slug"]).get();
  return data.map((post) => ({ slug: post.slug }));
}

async function getPost(slug: string) {
  try {
    return (await blog.entry(slug).get()).data;
  } catch (err) {
    if (err instanceof HeadqueryHttpError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).slug);
  return { title: post.title };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);

  return (
    <article>
      <p>
        <Link href="/">← All posts</Link>
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

      {post.tags.length > 0 && <p className="meta">Tags: {post.tags.map((t) => t.title).join(", ")}</p>}

      {post.related.length > 0 && (
        <>
          <h2>Related</h2>
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
    </article>
  );
}
