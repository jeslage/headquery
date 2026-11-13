# AGENT.md — headquery

Guidance for AI coding agents (and humans) working in this repository.

## What this project is

**headquery** is a set of thin, typed JavaScript SDKs for the **existing REST APIs** of
PHP-based CMSs. Developers keep the CMS's own query vocabulary (filters, sort, fields) but
write it in JS with full type safety. Statamic is the first target; Kirby and Craft follow.

The SDK is an abstraction over `fetch`, nothing more. It does **not** add a new server-side
query engine.

Two halves:

1. **JS packages (npm):** a CMS-agnostic core, one adapter per CMS, a codegen CLI.
2. **Composer packages (Packagist):** one small plugin per CMS that **exports the content
   model** (via CLI command or an authenticated endpoint) so codegen can produce TS types.

## Non-negotiable design principles

1. **Wrap existing REST APIs; prefer GET.** Cacheability by browsers/CDNs/proxies is a core
   feature. Do not introduce POST-based query endpoints for reads unless a CMS leaves no
   other option (Kirby KQL is the known exception — see roadmap).
2. **Deterministic URLs.** The same logical query must always produce the identical URL.
   Query keys are sorted in `serializeQuery` (packages/js/core/src/url.ts). Never bypass it.
3. **Core is CMS-agnostic and framework-agnostic.** `@headquery/core` knows nothing about
   Statamic, Vue or React. Only `fetch`, URLs, auth, errors.
4. **Adapters compile to `RequestSpec`.** Every CMS adapter's builders implement
   `Compilable<T>` (`toRequest(): RequestSpec`). Framework adapters (future `@headquery/vue`,
   `@headquery/react`) depend only on core's `Compilable`/`CoreClient`, so they work with
   every CMS. Never build per-CMS-per-framework packages.
5. **Builders are immutable.** Every builder method returns a new instance.
6. **Works untyped, better typed.** Without generated types everything still works with
   loose types (`LooseSchema`). Generated types plug in via module augmentation of
   `Register` — users should never have to pass generics manually.
7. **Zero runtime dependencies** in published JS packages unless clearly justified.
   CLI-only libraries (`citty`, `@clack/prompts` in `@headquery/codegen`) are devDependencies
   that tsup bundles into `dist/cli.js`; never import them from a library entry (`src/index.ts`).
8. **Bundle size is a feature.** A fetch wrapper is only worth installing if it costs about as
   much as a hand-written `fetch`. Budgets in `.size-limit.json` (minified + gzip, checked in CI
   via `pnpm size`): `createStatamicClient` ≤ 2.5 kB including core, `createCoreClient` ≤ 1.2 kB.
   New resources must not bloat the base client; don't raise a limit without a reason in the commit.
9. **The PHP side stays tiny.** It exports the schema and (only where needed) adds small
   glue. No business logic, no query engine.

## Repository layout

```
packages/
  js/
    core/        @headquery/core      fetch transport, deterministic URLs, errors, types
    schema/      @headquery/schema    IR types + assertIrSchema() (dependency-free)
    statamic/    @headquery/statamic  typed builders for the Statamic REST Content API
    codegen/     @headquery/codegen   `headquery` CLI (init, generate) + API: IR (file or URL) → .ts with Register augmentation
  php/
    statamic/    headquery/statamic   Statamic addon: schema exporter, CLI, schema route
                 (package.json here is only a private Turborepo wrapper, never published)
apps/
  docs/          @headquery-internal/docs  Nextra 4 docs site (static export), never published
spec/
  ir/schema-v1.json                   JSON Schema of the IR — THE cross-language contract
  statamic/fixtures/schema.json       realistic IR used by JS and PHP tests
playgrounds/statamic/                 local Statamic install (gitignored except setup files)
playgrounds/statamic-client/          private JS package: runs @headquery/statamic against the playground
playgrounds/statamic-next/            private Next.js app (App Router) using the client: blog list + /blog/[slug]
.github/workflows/                    ci.yml, release.yml (changesets → npm), split.yml (→ Packagist)
```

## Commands

```bash
pnpm install
pnpm build                 # turbo: builds all JS packages in dependency order (not docs/playgrounds)
pnpm test:js               # vitest + tsc --noEmit for every JS package
pnpm test:php              # runs `composer test` in PHP packages (needs `composer install` there first)
pnpm --filter @headquery/statamic test     # one package
pnpm lint                  # biome check: formatting, lint, import sorting (CI runs `biome ci .`)
pnpm lint:fix              # apply safe fixes + formatting
pnpm size                  # bundle size budget (size-limit; run pnpm build first)
pnpm changeset             # REQUIRED for user-facing changes to published JS packages
pnpm docs:dev              # docs site on localhost:3000 (builds packages first)
pnpm docs:test             # type-checks every ```ts twoslash snippet in apps/docs/content
pnpm docs:build            # static site → apps/docs/out (incl. Pagefind search index)

# against a running playground (HEADQUERY_BASE_URL in playgrounds/statamic-client/.env)
pnpm --filter @headquery-internal/playground-statamic-client types      # regenerate src/cms.ts (headquery.config.ts)
pnpm --filter @headquery-internal/playground-statamic-client try        # scratch script
pnpm --filter @headquery-internal/playground-statamic-client test:e2e   # codegen + e2e tests + tsc
pnpm --filter @headquery-internal/playground-statamic-next dev          # Next.js app (env in .env.local)
```

PHP package directly:

```bash
cd packages/php/statamic && composer install && composer test
```

Notes:
- JS tests run `vitest run && tsc --noEmit`. Type-level assertions (`expectTypeOf`,
  `@ts-expect-error`) are only enforced by the `tsc` step — keep it in the test script.
- Tests in adapters import other workspace packages through their built `dist/`, so
  Turbo's `test` depends on `^build`. Run `pnpm build` first when running vitest by hand.
- `pnpm test` (without `:js`) also runs PHP tests and fails if Composer deps are missing.

## The IR (intermediate schema)

- Defined in `spec/ir/schema-v1.json`, mirrored in `packages/js/schema/src/index.ts`.
- `resources` is grouped by kind (`collection taxonomy global navigation assetContainer`),
  each a map handle → resource, because Statamic handles are only unique per kind.
  Navigations also carry `collections` (linkable collections) and `maxDepth`.
- Field types: `string number boolean date enum array object relation asset richtext blocks unknown`.
- `filterable: true` mirrors Statamic's `allowed_filters` — codegen turns it into the
  `filterable` union that restricts `.where()`. Allowed filters that are not blueprint fields
  (system fields like `basename`, `folder`, `date`) go into the resource's `systemFilters`
  (additive, schemaVersion 1). `allowed_filters: true`/`['*']` can't list them, so none are emitted.
- Empty field maps and resource maps must encode as JSON `{}` (PHP: cast to `(object)`).

**Changing the IR** requires, in one PR: JSON Schema, TS types, codegen, all PHP mappers,
fixtures, and the codegen snapshot (`packages/js/codegen/tests/__generated__/`). Breaking
changes bump `schemaVersion` and add `schema-v2.json`; codegen must reject versions it
does not understand.

## Tests that guard the contract

- `packages/js/schema/tests/contract.test.ts` — fixtures validate against the JSON Schema (Ajv).
- `packages/php/statamic/tests/ContractTest.php` — PHP mapper output validates against the
  same JSON Schema (opis/json-schema). Skips outside the monorepo.
- `packages/js/codegen/tests/generate.test.ts` — fixture → file snapshot
  `tests/__generated__/statamic.ts`. Update with `pnpm --filter @headquery/codegen exec vitest run -u`
  and review the diff.
- `packages/js/codegen/tests/usage.test.ts` — imports that snapshot and type-checks real
  client usage against it (registered schema, filterable fields, narrowing via `fields()`).

## Docs (`apps/docs`)

- Nextra 4 (App Router) with `output: "export"`; pages are MDX in `apps/docs/content/`,
  navigation order in `_meta.ts` files.
- Code samples marked ```` ```ts twoslash ```` are type-checked against the real workspace
  packages and against types generated from `spec/statamic/fixtures/schema.json`
  (`apps/docs/generated/`, gitignored, written by the `codegen` pre-script). Import them
  with `import "./generated/cms.generated";` above a `// ---cut---` line.
- `next build` does **not** fail on broken snippets (rehype-pretty-code swallows Twoslash
  errors), so `pnpm docs:test` (`scripts/check-snippets.mjs`) is the guard. Expected
  errors need `// @errors: <code>`.
- Public API changes should update the docs in the same PR.
- Structure: `getting-started.mdx` (CMS cards + requirements), `codegen/` and
  `client/` (CMS-agnostic: CLI, config, client options, types, caching, errors),
  `cms/<name>/` (CMS-specific, incl. its linear quickstart `getting-started.mdx`), `frameworks/` and `data-fetching/`. Keep CMS-agnostic content
  out of `cms/`. Client snippets mirror the file `headquery init` writes (`createX<Schema>`).
- A new CMS adapter needs `cms/<name>/{index,getting-started,querying,field-types,custom-fieldtypes,troubleshooting}.mdx`
  (getting-started in the same step order as Statamic's and as `nextSteps()` in
  `packages/js/codegen/src/cli/init/next-steps.ts`) and a card in `getting-started.mdx`.
- The CLI links to `/cms/<name>/troubleshooting#<cause>` (`DOCS_URL` in
  `packages/js/codegen/src/cli/docs.ts`): never rename those pages or anchors. Moved pages get a
  redirect in `apps/docs/vercel.json` (Next's `redirects` don't work with `output: "export"`).
- `pnpm-workspace.yaml` pins zod 4.3.6 for Nextra only: Nextra 4.6.1 breaks with zod 4.6.x (4.3.6 verified).

## Statamic specifics

- REST API base: `/{statamic.api.route}` (default `/api`). Endpoints used:
  `/collections/{c}/entries`, `/collections/{c}/entries/{id}`, `/taxonomies/{t}/terms`,
  `/taxonomies/{t}/terms/{slug}`, `/collections/{c}/tree`, `/globals`, `/globals/{handle}`, `/navs`, `/navs/{n}/tree`,
  `/assets/{container}`, `/assets/{container}/{path}` (path keeps its slashes, segments encoded).
- Filters: `filter[field:condition]=value`; only fields in `allowed_filters` are accepted
  by Statamic. Sort: `sort=a,-b`. Also `fields=`, `limit=`, `page=`, `site=`.
- Client API (method = first REST path segment): `collections(c)`, `taxonomies(t)`, `assets(c)` return a `ResourceQuery` (a `ListQuery` plus
  `find(key)`, which only exists before list options are set and resolves 404 to `null`);
  `globals()`/`globals(h)`, `navs()`/`navs(h).tree()`. `collections(c).tree()` exists only for
  structured collections (IR `structure`); it's a `TreeQuery` that, unlike nav trees, accepts filters.
- Response: `{ data, links, meta }` for entry/term/asset lists, `{ data }` for single items and for
  the unpaginated `/globals`, `/navs` and nav trees. Trees also accept `max_depth=`.
- Addon pieces: `FieldMapper` (pure, unit-tested; maps fieldtype+config → IR),
  `SchemaExporter` (walks collections/taxonomies/globals/navs, respects `statamic.api.resources`
  and `allowed_filters`), `ExportSchemaCommand` (`php please headquery:schema --out=…`),
  `SchemaController` + `AuthorizeSchemaRequest` (`GET /api/headquery/schema`).
- Schema endpoint security: off unless `HEADQUERY_SCHEMA_ROUTE=true` **and**
  `HEADQUERY_SCHEMA_TOKEN` is set; 404 otherwise, 401 on wrong token; `hash_equals`
  comparison; ETag/304 support. Never weaken these defaults.

### Known unverified assumptions (verify against the playground first)

The playground targets Statamic 6 (the addon supports `^5.0 || ^6.0`).

- `SchemaExporter` has been run manually against Statamic 6.40 in the seeded playground
  (output validates against `schema-v1.json`), but has no automated tests yet — only
  `FieldMapper` is unit-tested. Asset containers are read from `resources.assets`.
- Bard output type (`HqRichText`) depends on field config (HTML string without sets, array
  of blocks with sets); the IR doesn't carry that distinction yet.

Verified against Statamic 6 responses (keep in sync with `packages/js/codegen/src/statamic.ts`;
guarded by `playgrounds/statamic-client/tests/e2e.test.ts`):
`LIST_SEPARATOR = "|"` for `in`/`not_in` filters; filters outside `allowed_filters` return 422;
unpublished entries are hidden from lists and 404 as single items;
select-like fields return `{ key, value, label }` (all `null` when empty, `[]` when multiple);
toggles are always boolean; grid/replicator/multi relations return `[]`, but
list/taggable/table return `null` when empty; assets use `max_files` (not `max_items`).
System fields of entries/terms/globals are modelled as `HqEntryBase`/`HqTermBase`/`HqGlobalBase`.
Nav tree items are `{ page, depth, children }` (depth 1 = top level). Pages linked to an entry
contain all of the entry's fields plus `entry_id`; their `id` is the nav item id, not the entry id.
Plain link pages only have `id title url uri permalink` and `entry_id: null`. Nav blueprint
fields are on every page (`null` when empty). Modelled as `HqNavLink`/`HqNavEntry`.
Filters: all collection-tag conditions work in the API (`queryCondition()`), incl. `matches`,
`is_after`/`is_before` (string = date, `true`/numeric = now), `overlaps` (`|` values) and the boolean
`is_*` checks (`true`/`false`). Taxonomy filters `filter[taxonomy:{t}:{any|not|all}]=a,b` use commas,
need `taxonomy:{t}` in `allowed_filters` (exported as `systemFilters`) and only apply to entry lists.
Collection trees (`/collections/{c}/tree`) have the same `{ page, depth, children }` items; pages are
the entries plus `entry_id`, and `id === entry_id` (no separate branch id). Unpublished entries are
left out. Filters (from `allowed_filters`, 422 otherwise) apply per level, so a non-matching parent
drops its subtree. Unstructured collections 404. Nav trees ignore `filter[...]`. Structured
collections carry `structure: { maxDepth?, expectsRoot? }` in the IR; codegen emits `{Name}TreePage`.
Assets from `/assets/...` carry all `AugmentedAsset` keys (`HqAssetBase`) plus blueprint fields;
`width height ratio` are `null` for non-images but `orientation` is `"square"`; `folder` is `/` at
the root. Asset *fields* on entries are shallow (`id url permalink api_url alt`, `HqAsset`).
The asset path route accepts literal slashes and `%2F`.
`status` is a reserved field handle in Statamic (it's the entry's publish status) — don't use
it for blueprint fields in fixtures or the seed.

## Conventions

- TypeScript strict (incl. `noUncheckedIndexedAccess`), ESM-first, dual ESM/CJS via tsup,
  `.d.ts` emitted. Node ≥ 20. Use `import type` for types (`verbatimModuleSyntax`).
- Formatting and linting: Biome (`biome.json`), JS/TS/JSON/CSS only; Markdown, YAML and
  PHP are not touched. 2 spaces, double quotes, semicolons, 120 columns. Generated files
  (codegen snapshot, `apps/docs/generated`, playground `cms.ts`) are excluded.
  `noNonNullAssertion` is off because `noUncheckedIndexedAccess` makes `!` idiomatic here.
- Public API changes in JS packages need a changeset. Internal wrappers
  (`@headquery-internal/*`) are ignored by changesets.
- PHP ≥ 8.2, PSR-4 under `Headquery\Statamic\`, PSR-12 style, no new runtime dependencies
  beyond `statamic/cms`.
- Keep `FieldMapper` free of Statamic classes so it stays unit-testable.
- Don't commit the playground install, `vendor/`, `dist/` or lockfiles of PHP packages.

## Branches

- `dev` is the working branch: commit and push directly, no feature branches or PRs needed.
  CI runs on every push to `dev`.
- `main` is the released state. Pushes to `main` trigger the npm release workflow
  (changesets "Version packages" PR) and the Packagist split, so only update it to release:
  `git checkout main && git merge --ff-only dev && git push`.

## Releasing

- **npm:** changesets → `release.yml` opens a "Version packages" PR → merging publishes.
  Needs `NPM_TOKEN` secret and the `@headquery` npm org.
- **Packagist:** `split.yml` mirrors `packages/php/statamic` to `github.com/jeslage/headquery-statamic`
  on every push to main. Release by tagging the monorepo `php-statamic/X.Y.Z` (no "v"); the split
  repo receives `X.Y.Z`. Needs `SPLIT_TOKEN` secret, the empty split repo and a Packagist entry.

## Roadmap (suggested order)

1. Run the addon in `playgrounds/statamic` (or the existing prototype); fix `SchemaExporter`
   against real Statamic; verify the unverified assumptions above; add Testbench-based
   tests for exporter, command and route.
2. Contract/e2e tests: JS client against the running playground in CI.
3. Remaining Statamic resources: users, forms; multi-site helpers.
   (Navigation and collection trees, the globals list and assets are done.)
4. Codegen: `--check` in docs/CI recipes, ETag-aware fetch. (Config file `headquery.config.ts`
   is done: `packages/js/codegen/src/config.ts`.)
5. Framework adapters: `@headquery/vue` (composables), `@headquery/react` (hooks),
   then Nuxt/Next integrations (SSR, `revalidate`, caching keys via `query.url()`).
6. Next CMS: Kirby. KQL is `POST /api/query` (not HTTP-cacheable) → the Kirby Composer
   package likely needs a GET route that accepts the query and forwards to KQL. Reuse/align
   with `kirby-types`. Then Craft (native API is GraphQL; consider Element API or
   Craft Query API for REST/GET).
