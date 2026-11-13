---
"@headquery/statamic": minor
"@headquery/codegen": minor
"@headquery/schema": minor
---

**Breaking:** the Statamic client now uses one pattern for every resource, named after the first segment of the REST path (like Statamic's API) and modelled on `Entry::query()->where('collection', …)`:

| Before | After |
| --- | --- |
| `cms.collection("blog").entries()` | `cms.collections("blog")` |
| `cms.collection("blog").entry(slug)` | `cms.collections("blog").find(slug)` |
| `cms.taxonomy("tags").terms()` | `cms.taxonomies("tags")` |
| `cms.taxonomy("tags").term(slug)` | `cms.taxonomies("tags").find(slug)` |
| `cms.nav("main").tree()` | `cms.navTree("main")` |

`.find(key)` resolves to `null` when the API answers 404 (other errors still throw), so `const post = await cms.collections("blog").find(slug).get(); if (!post) notFound();` replaces the try/catch. It is only available directly after `collections()`/`taxonomies()`/`assets()`, because the single-item endpoint ignores filters, sort and pagination. `global(handle)` still throws on 404.

New: Statamic assets. `cms.assets(container)` lists and filters a container's assets (`GET /assets/{container}`), `cms.assets(container).find(path)` fetches one asset by its path, keeping folder slashes in the URL. Codegen emits asset containers (`HqAssetBase` plus blueprint fields), and allowed filters on system fields like `basename`, `folder` or `date` are typed via the new optional IR property `systemFilters`.
