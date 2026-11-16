# @headquery/codegen

## 0.5.0

### Minor Changes

- e89921d: Bard and Replicator sets are exported as named interfaces, `{Handle}Set` (`callout` → `CalloutSet`, `text_image` → `TextImageSet`), and the field types reference them (`Array<HqBardText | CalloutSet | ImageSet>`). A set used in several fields with the same fields is one type. Sets that share a handle but differ in their fields are named after their location instead (`BlogBodyImageSet`). Replicator set `id` is now typed `string | null`, as the API returns it (was `id?: string`).

## 0.4.0

### Minor Changes

- 92321cb: Typed link fields. Statamic's `link` fieldtype was typed as `string`, but the API always returns an object: `{ url }` for a URL (`{ url: null }` when empty), the shallow entry for an entry or `@child` link, and the shallow asset for an asset link. The IR has a new field type `link` with `targets` (`entry`, `asset`), and codegen emits `HqLinkUrl | HqLinkEntry | HqLinkAsset` (assets only when the field has a `container`). `link.url` works for every variant; narrow with `"title" in link` or `"alt" in link`. Update the `headquery/statamic` addon and regenerate your types.

### Patch Changes

- Updated dependencies [92321cb]
  - @headquery/schema@0.4.0

## 0.3.0

### Minor Changes

- 06290c6: Typed Bard sets. The IR's `richtext` fields carry the Bard field's `sets` (same shape as `blocks.sets`), and codegen types Bard fields exactly: an HTML `string` without sets, and with sets an array of `HqBardText` items (`{ type: "text", text }`) and one object per set (`{ id, type: "<set>", …fields }`), `[]` when empty. Narrow on `type` to render them.

  **Breaking:** `HqRichText` is removed. Regenerate your types; Bard fields without sets are now `string | null`.

- cfd6411: One type per blueprint. Statamic only returns the fields of an entry's own blueprint, so the IR now exports collections and taxonomies with `blueprints` (handle → `{ title, fields }`) instead of merged `fields`, and codegen emits one entry type per blueprint with a literal `blueprint.handle` plus a union per collection (e.g. `PagesEntry = PagesLandingEntry | PagesPageEntry`). Narrow it with the new `isBlueprint(entry, "landing")` from `@headquery/statamic`, or fetch only one blueprint's entries with the new `.whereBlueprint("landing")` (or `["landing", "page"]`), which sends `filter[blueprint:…]` and narrows the result; it needs `blueprint` in the collection's `allowed_filters`. Taxonomies with several blueprints get one term type in which fields of only some blueprints are optional.

  The query builders accept the fields of every blueprint in `fields()`, `where()` and `sort()`, and `fields()` types a requested field that an item's blueprint lacks as `null`, as Statamic returns it (also in navigation trees, where link pages used to drop such fields from the type).

  **Breaking:** the IR shape of collections and taxonomies changed (still `schemaVersion: 1`). Update the `headquery/statamic` addon and regenerate your types.

### Patch Changes

- Updated dependencies [06290c6]
- Updated dependencies [cfd6411]
  - @headquery/schema@0.3.0

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
