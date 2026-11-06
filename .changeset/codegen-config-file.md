---
"@headquery/codegen": minor
---

Add config file support. `headquery-codegen` now reads `headquery.config.{ts,mts,mjs,js}` from
the current directory (or the file given with `--config`), so it runs without flags. Use the new
`defineConfig()` export for typed configs. Relative `from`/`out` paths resolve against the config
file, and CLI flags override config values. `.ts` configs need Node ≥ 22.18 (native type stripping);
use `.mjs` on older versions.

`from` can also be `{ baseUrl, apiPrefix?, schemaPath? }`: codegen then fetches
`<baseUrl>/api/headquery/schema` (defaults match the client and the Statamic addon), so the
same `HEADQUERY_BASE_URL` serves the client and codegen. On the CLI: `--base-url`, `--api-prefix`,
`--schema-path`. Also exported: `findConfig`, `loadConfig`, `resolveOptions`, `schemaEndpointUrl`.
