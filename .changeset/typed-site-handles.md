---
"@headquery/schema": minor
"@headquery/codegen": minor
"@headquery/statamic": minor
---

Typed site handles. The IR gets an optional top-level `sites` map (handle → `{ name, locale }`, in
the CMS's order; schemaVersion stays 1). `headquery generate` emits `sites: "default" | "de"` in the
generated `Schema`, and `.site()` on every query only accepts those handles (`SiteHandle`, also the
type of `StatamicSite.handle`). Without generated types, or with types generated before this
change, `.site()` still takes any string.
