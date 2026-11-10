# headquery

Typed, cacheable JavaScript clients for the REST APIs of headless PHP CMSs — keep the
CMS's own query vocabulary, get TypeScript types generated from your content model.

> **Early development.** headquery is still under development and should not be used in production yet. APIs, generated types and the schema format may change in any 0.x release.
> Statamic is supported first; Kirby and Craft are planned.

```ts
import { createStatamicClient } from "@headquery/statamic";
import "./cms.generated"; // registers your schema's types

const cms = createStatamicClient({ baseUrl: "https://cms.example.com" });

const posts = await cms
  .collection("blog")                       // collection handles autocomplete
  .entries()
  .where("title", "contains", "monorepo")   // only allowed_filters fields are accepted
  .sort("-date")
  .limit(10)
  .fields(["title", "date", "hero"])        // narrows the result type
  .get();
// GET /api/collections/blog/entries?fields=title,date,hero&filter[title:contains]=monorepo&limit=10&sort=-date
```

## Packages

| Package | Registry | Purpose |
| --- | --- | --- |
| `@headquery/core` | npm | CMS-agnostic fetch transport with deterministic (cache-friendly) URLs |
| `@headquery/statamic` | npm | Typed query builders for the Statamic REST Content API |
| `@headquery/codegen` | npm | Generates TS types from a CMS schema (file or URL) |
| `@headquery/schema` | npm | Types for the intermediate schema (IR) |
| `headquery/statamic` | Packagist | Statamic addon: exports the content model via CLI or endpoint |

## Generate types

```bash
# once per frontend: writes headquery.config.ts, prints package.json scripts and env lines
npx @headquery/codegen init

# then, whenever the content model changes (add --check in CI)
npx headquery generate

# without a config: schema endpoint (see packages/php/statamic/README.md) …
npx headquery generate --base-url https://cms.example.com --out src/cms.generated.ts
# … or an exported file from the same project
php please headquery:schema --out=schema.json
npx headquery generate --from schema.json --out src/cms.generated.ts
```

## Development

```bash
pnpm install
pnpm build
pnpm test:js
pnpm docs:dev     # documentation site (apps/docs)
```

See [AGENT.md](./AGENT.md) for architecture, conventions and the roadmap.
