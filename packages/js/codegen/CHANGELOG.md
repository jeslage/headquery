# @headquery/codegen

## 0.2.0

### Minor Changes

- 38d185e: `headquery generate` now explains why the schema couldn't be loaded instead of printing a bare `fetch failed`. The report leads with the HTTP status (e.g. `401 Unauthorized`) or system error (e.g. `ECONNREFUSED`, `self-signed certificate`), then shows the URL, content type, whether a token was sent and an excerpt of the response, followed by the likely cause and a checklist of common problems for the adapter with the matching one highlighted. `loadSchema()` throws the new exported `SchemaLoadError` with `kind`, `source`, `status`, `statusText`, `contentType`, `body` (excerpt), `code`, `reason` and `sentToken`.
- c130940: `headquery init` now also offers to write a typed client file (when an adapter like `@headquery/statamic` is installed), add `cms:types` scripts to `package.json` and add the `HEADQUERY_*` lines to `.env.local`/`.env` (asking for a name if none exists). The framework (Next.js, Nuxt, Vite, Node) is detected and can be changed in the prompt; it decides how the client reads its base URL. New flags: `--framework`, `--no-client`, `--no-scripts`, `--no-env`, `--env-file`. The remaining next steps are printed as plain text without a box, including what to set up on the CMS (Statamic: Pro, REST API, schema route, `config:clear`).
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
- 6a7f94c: Typed site handles. The IR gets an optional top-level `sites` map (handle → `{ name, locale }`, in
  the CMS's order; schemaVersion stays 1). `headquery generate` emits `sites: "default" | "de"` in the
  generated `Schema`, and `.site()` on every query only accepts those handles (`SiteHandle`, also the
  type of `StatamicSite.handle`). Without generated types, or with types generated before this
  change, `.site()` still takes any string.

### Patch Changes

- 087278b: Nicer CLI output. `headquery init` prints its next steps with short titles, wrapped text and highlighted
  commands. When `headquery generate` can't load the schema, it shows the likely cause and links to the
  matching section of the new Statamic troubleshooting page instead of listing every common problem.
- Updated dependencies [c35ebe0]
- Updated dependencies [e628031]
- Updated dependencies [6a7f94c]
  - @headquery/schema@0.2.0

## 0.1.0

### Minor Changes

- c384cf7: Initial release.

### Patch Changes

- Updated dependencies [c384cf7]
  - @headquery/schema@0.1.0
