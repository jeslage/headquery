---
"@headquery/schema": minor
"@headquery/codegen": minor
"@headquery/statamic": minor
---

One type per blueprint. Statamic only returns the fields of an entry's own blueprint, so the IR now exports collections and taxonomies with `blueprints` (handle → `{ title, fields }`) instead of merged `fields`, and codegen emits one entry type per blueprint with a literal `blueprint.handle` plus a union per collection (e.g. `PagesEntry = PagesLandingEntry | PagesPageEntry`). Narrow it with the new `isBlueprint(entry, "landing")` from `@headquery/statamic`, or fetch only one blueprint's entries with the new `.whereBlueprint("landing")` (or `["landing", "page"]`), which sends `filter[blueprint:…]` and narrows the result; it needs `blueprint` in the collection's `allowed_filters`. Taxonomies with several blueprints get one term type in which fields of only some blueprints are optional.

The query builders accept the fields of every blueprint in `fields()`, `where()` and `sort()`, and `fields()` types a requested field that an item's blueprint lacks as `null`, as Statamic returns it (also in navigation trees, where link pages used to drop such fields from the type).

**Breaking:** the IR shape of collections and taxonomies changed (still `schemaVersion: 1`). Update the `headquery/statamic` addon and regenerate your types.
