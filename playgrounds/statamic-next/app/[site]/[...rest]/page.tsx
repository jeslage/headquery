import { notFound } from "next/navigation";

// The root layout lives in [site], so there is no app-wide not-found page. Unknown URLs land here
// and render [site]/not-found.tsx inside their site's layout.
export default function CatchAll() {
  notFound();
}
