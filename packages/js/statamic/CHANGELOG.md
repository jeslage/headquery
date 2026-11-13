# @headquery/statamic

## 0.2.0

### Minor Changes

- c35ebe0: **Breaking:** the Statamic client now uses one pattern for every resource, named after the first segment of the REST path (like Statamic's API) and modelled on `Entry::query()->where('collection', …)`:

  | Before                               | After                                |
  | ------------------------------------ | ------------------------------------ |
  | `cms.collection("blog").entries()`   | `cms.collections("blog")`            |
  | `cms.collection("blog").entry(slug)` | `cms.collections("blog").find(slug)` |
  | `cms.taxonomy("tags").terms()`       | `cms.taxonomies("tags")`             |
  | `cms.taxonomy("tags").term(slug)`    | `cms.taxonomies("tags").find(slug)`  |
  | `cms.nav("main").tree()`             | `cms.navs("main").tree()`            |
  | `cms.global("settings")`             | `cms.globals("settings")`            |

  `.find(key)` resolves to `null` when the API answers 404 (other errors still throw), so `const post = await cms.collections("blog").find(slug).get(); if (!post) notFound();` replaces the try/catch. It is only available directly after `collections()`/`taxonomies()`/`assets()`, because the single-item endpoint ignores filters, sort and pagination. `globals(handle)` still throws on 404, since a missing global set is a configuration error.

  New: Statamic assets. `cms.assets(container)` lists and filters a container's assets (`GET /assets/{container}`), `cms.assets(container).find(path)` fetches one asset by its path, keeping folder slashes in the URL. Codegen emits asset containers (`HqAssetBase` plus blueprint fields), and allowed filters on system fields like `basename`, `folder` or `date` are typed via the new optional IR property `systemFilters`.

- e628031: Add collection trees: `cms.collections("pages").tree()` fetches the page tree of a structured collection (`GET /collections/{handle}/tree`) with `.maxDepth()`, `.site()`, `.fields()` and, unlike navigation trees, `.where()` filters from the collection's `allowed_filters`. The addon marks structured collections with the new optional IR property `structure` (`maxDepth`, `expectsRoot`), and codegen emits a `{Name}TreePage` type, so `tree()` only type-checks on structured collections.
- 2be67cb: More filters. `where()` now accepts every condition Statamic's API supports: `matches`/`doesnt_match` (regex), `is_after`/`is_before` (date string or `Date`), `overlaps`/`doesnt_overlap` for array fields, and the boolean conditions `is_future`, `is_past`, `is_alpha`, `is_alpha_numeric`, `is_numeric`, `is_url`, `is_embeddable` and `is_email`, which need no value (`.where("date", "is_future")`) or take `false` to negate. Entry lists get Statamic's taxonomy filters: `whereTaxonomy(taxonomy, terms)` (all), `whereTaxonomyIn()` (any) and `whereTaxonomyNotIn()` (none). They need `taxonomy:{handle}` in `allowed_filters`, and with generated types only those taxonomies type-check.
- 0e2c311: Add forms and sites: `cms.forms()` lists the forms enabled in `resources.forms`, `cms.forms(handle)` fetches one form with its fields (`StatamicForm`, `StatamicFormField`), and `cms.sites()` lists the sites (`StatamicSite`). The remaining metadata endpoints and `/ping` are documented to use `cms.send()`.
- b2a97bc: Add users: `cms.users()` lists users (`GET /users`) with filters, sort, pagination and `fields`, and `cms.users().find(id)` fetches one user or `null`. Users are typed as `StatamicUser` (`id`, `email`, `name`, `is_super`, `api_url`), the fixed fields Statamic returns. Because user filters may target fields the API doesn't return (e.g. `roles`), `where()` accepts any field name for users; Statamic enforces `allowed_filters`.
- 6a7f94c: Typed site handles. The IR gets an optional top-level `sites` map (handle → `{ name, locale }`, in
  the CMS's order; schemaVersion stays 1). `headquery generate` emits `sites: "default" | "de"` in the
  generated `Schema`, and `.site()` on every query only accepts those handles (`SiteHandle`, also the
  type of `StatamicSite.handle`). Without generated types, or with types generated before this
  change, `.site()` still takes any string.

## 0.1.0

### Minor Changes

- c384cf7: Initial release.

### Patch Changes

- Updated dependencies [c384cf7]
  - @headquery/core@0.1.0
