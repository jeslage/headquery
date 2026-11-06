import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Not found</h1>
      <p>
        That post doesn’t exist or isn’t published.{" "}
        <Link href="/">Back to the blog</Link>
      </p>
    </>
  );
}
