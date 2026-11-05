# headquery

Typed, cacheable JavaScript clients for the REST APIs of headless PHP CMSs — keep the
CMS's own query vocabulary, get TypeScript types generated from your content model.

> Early development. Statamic first; Kirby and Craft planned.

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
# frontend in another repo (schema endpoint, see packages/php/statamic/README.md)
npx headquery-codegen --from https://cms.example.com/api/headquery/schema \
  --token "$HEADQUERY_SCHEMA_TOKEN" --out src/cms.generated.ts

# same project
php please headquery:schema --out=schema.json
npx headquery-codegen --from schema.json --out src/cms.generated.ts
```

## Development

```bash
pnpm install
pnpm build
pnpm test:js
```

See [AGENT.md](./AGENT.md) for architecture, conventions and the roadmap.
