---
"@headquery/statamic": minor
---

New `site` client option: `createStatamicClient({ baseUrl, site: "de" })` sends `site=de` with every query that supports it (entry and term lists, `find()`, globals, collection and nav trees). `.site()` overrides it per query. Typed with the schema's site handles; exported as `StatamicClientOptions` (and `SiteHandleOf<Schema>`).
