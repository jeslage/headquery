// Scratch pad: edit freely, then `pnpm --filter @headquery-internal/playground-statamic-client try`.
import { HeadqueryHttpError } from "@headquery/statamic";
import { cms } from "./client";
import { requireBaseUrl } from "./env";

requireBaseUrl();

async function show(label: string, query: { url(): string; get(): Promise<unknown> }) {
  console.log(`\n▶ ${label}\n  GET ${query.url()}`);
  try {
    console.dir(await query.get(), { depth: 4 });
  } catch (err) {
    if (err instanceof HeadqueryHttpError) console.error(`  ✗ ${err.status}`, err.body);
    else throw err;
  }
}

const blog = cms.collections("blog");

await show(
  "featured posts, newest first",
  blog.where("featured", true).sort("-date").fields(["title", "slug", "date"]),
);
await show("title contains 'GET'", blog.where("title", "contains", "GET").fields(["title"]));
await show("slug in [...]", blog.where("slug", "in", ["hello-headquery", "statamic-addon"]).fields(["slug"]));
await show("single entry by slug", blog.find("hello-headquery").fields(["title", "stage", "tags", "hero"]));
await show("tags", cms.taxonomies("tags").fields(["title", "slug"]));
await show("settings global", cms.globals("settings"));
