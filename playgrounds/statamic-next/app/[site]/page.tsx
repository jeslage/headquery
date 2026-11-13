import Link from "next/link";
import { notFound } from "next/navigation";
import { isSite } from "@/lib/sites";
import { cms } from "@/lib/statamic";

type Props = { params: Promise<{ site: string }> };

export default async function HomePage({ params }: Props) {
  const { site } = await params;
  if (!isSite(site)) notFound();

  // Without site(), Statamic lists the entries of every site.
  const query = cms.collections("blog").site(site).sort("-date").fields(["title", "url", "date", "featured", "tags"]);

  const { data: posts } = await query.get();

  return (
    <>
      <h1>Blog</h1>
      <ul className="posts">
        {posts.map((post) => (
          <li key={post.url}>
            {/* Statamic's url (/blog/{slug}, /de/blog/{slug}) is this app's route. */}
            <Link href={post.url ?? "/"}>{post.title}</Link>
            {post.featured && <span className="badge">featured</span>}
            <small>
              {post.date?.slice(0, 10)} · {post.tags.map((t) => t.title).join(", ")}
            </small>
          </li>
        ))}
      </ul>

      <p className="debug">
        <code>GET {query.url()}</code>
      </p>
    </>
  );
}
