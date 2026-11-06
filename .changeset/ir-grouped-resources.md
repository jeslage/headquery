---
"@headquery/schema": minor
---

IR `resources` are now grouped by kind (`{ collection: { blog: … }, navigation: { main: … } }`)
instead of a flat handle map with a `kind` per resource, so handles only need to be unique per
kind (a navigation and a collection can both be called `main`). Navigations carry `collections`
(collections whose entries can be linked) and `maxDepth`. `assertIrSchema` rejects unknown kinds.
