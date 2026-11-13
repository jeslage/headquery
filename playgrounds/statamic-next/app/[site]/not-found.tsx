import Link from "next/link";

// not-found.tsx gets no params, so it can't tell the site; the layout around it is localized.
export default function NotFound() {
  return (
    <>
      <h1>Not found</h1>
      <p>
        That page doesn’t exist or isn’t published. <Link href="/">Back to the blog</Link>
      </p>
    </>
  );
}
