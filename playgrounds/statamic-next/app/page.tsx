import Link from "next/link";
import { cms } from "@/lib/statamic";

export default async function HomePage() {
  const query = cms
    .collection("blog")
    .entries()
    .sort("-date")
    .fields(["title", "slug", "date", "featured", "tags"]);

  const { data: posts } = await query.get();

  return (
    <>
      <h1>Blog</h1>
      <ul className="posts">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            {post.featured && <span className="badge">featured</span>}
            <small>
              {post.date?.slice(0, 10)} ·{" "}
              {post.tags.map((t) => t.title).join(", ")}
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
