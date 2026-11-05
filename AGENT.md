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
8. **The PHP side stays tiny.** It exports the schema and (only where needed) adds small
   glue. No business logic, no query engine.

## Repository layout

```
packages/
  js/
    core/        @headquery/core      fetch transport, deterministic URLs, errors, types
    schema/      @headquery/schema    IR types + assertIrSchema() (dependency-free)
    statamic/    @headquery/statamic  typed builders for the Statamic REST Content API
    codegen/     @headquery/codegen   CLI + API: IR (file or URL) → .ts with Register augmentation
  php/
    statamic/    headquery/statamic   Statamic addon: schema exporter, CLI, schema route
                 (package.json here is only a private Turborepo wrapper, never published)
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
pnpm build                 # turbo: builds all JS packages in dependency order
pnpm test:js               # vitest + tsc --noEmit for every JS package
pnpm test:php              # runs `composer test` in PHP packages (needs `composer install` there first)
pnpm --filter @headquery/statamic test     # one package
pnpm changeset             # REQUIRED for user-facing changes to published JS packages

# against a running playground (HEADQUERY_BASE_URL in playgrounds/statamic-client/.env)
pnpm --filter @headquery-internal/playground-statamic-client types      # regenerate src/cms.ts
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
- Field types: `string number boolean date enum array object relation asset richtext blocks unknown`.
- `filterable: true` mirrors Statamic's `allowed_filters` — codegen turns it into the
  `filterable` union that restricts `.where()`.
- Empty field maps must encode as JSON `{}` (PHP: cast to `(object)`).

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

## Statamic specifics

- REST API base: `/{statamic.api.route}` (default `/api`). Endpoints used:
  `/collections/{c}/entries`, `/collections/{c}/entries/{id}`, `/taxonomies/{t}/terms`,
  `/taxonomies/{t}/terms/{slug}`, `/globals/{handle}`.
- Filters: `filter[field:condition]=value`; only fields in `allowed_filters` are accepted
  by Statamic. Sort: `sort=a,-b`. Also `fields=`, `limit=`, `page=`, `site=`.
- Response: `{ data, links, meta }` for lists, `{ data }` for single items.
- Addon pieces: `FieldMapper` (pure, unit-tested; maps fieldtype+config → IR),
  `SchemaExporter` (walks collections/taxonomies/globals, respects `statamic.api.resources`
  and `allowed_filters`), `ExportSchemaCommand` (`php please headquery:schema --out=…`),
  `SchemaController` + `AuthorizeSchemaRequest` (`GET /api/headquery/schema`).
- Schema endpoint security: off unless `HEADQUERY_SCHEMA_ROUTE=true` **and**
  `HEADQUERY_SCHEMA_TOKEN` is set; 404 otherwise, 401 on wrong token; `hash_equals`
  comparison; ETag/304 support. Never weaken these defaults.

### Known unverified assumptions (verify against the playground first)

The playground targets Statamic 6 (the addon supports `^5.0 || ^6.0`).

- `SchemaExporter` has been run manually against Statamic 6.40 in the seeded playground
  (output validates against `schema-v1.json`), but has no automated tests yet — only
  `FieldMapper` is unit-tested. It does not export navigations or asset containers yet.
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
`status` is a reserved field handle in Statamic (it's the entry's publish status) — don't use
it for blueprint fields in fixtures or the seed.

## Conventions

- TypeScript strict (incl. `noUncheckedIndexedAccess`), ESM-first, dual ESM/CJS via tsup,
  `.d.ts` emitted. Node ≥ 20. Use `import type` for types (`verbatimModuleSyntax`).
- Public API changes in JS packages need a changeset. Internal wrappers
  (`@headquery-internal/*`) are ignored by changesets.
- PHP ≥ 8.2, PSR-4 under `Headquery\Statamic\`, PSR-12 style, no new runtime dependencies
  beyond `statamic/cms`.
- Keep `FieldMapper` free of Statamic classes so it stays unit-testable.
- Don't commit the playground install, `vendor/`, `dist/` or lockfiles of PHP packages.

## Releasing

- **npm:** changesets → `release.yml` opens a "Version packages" PR → merging publishes.
  Needs `NPM_TOKEN` secret and the `@headquery` npm org.
- **Packagist:** `split.yml` mirrors `packages/php/statamic` to `github.com/headquery/statamic`
  on every push to main. Release by tagging the monorepo `php-statamic/vX.Y.Z`; the split
  repo receives `vX.Y.Z`. Needs `SPLIT_TOKEN` secret, the empty split repo and a Packagist entry.

## Roadmap (suggested order)

1. Run the addon in `playgrounds/statamic` (or the existing prototype); fix `SchemaExporter`
   against real Statamic; verify the unverified assumptions above; add Testbench-based
   tests for exporter, command and route.
2. Contract/e2e tests: JS client against the running playground in CI.
3. Remaining Statamic resources: navigation trees, assets, users; multi-site helpers.
4. Codegen: config file (`headquery.config.ts`), `--check` in docs/CI recipes, ETag-aware fetch.
5. Framework adapters: `@headquery/vue` (composables), `@headquery/react` (hooks),
   then Nuxt/Next integrations (SSR, `revalidate`, caching keys via `query.url()`).
6. Next CMS: Kirby. KQL is `POST /api/query` (not HTTP-cacheable) → the Kirby Composer
   package likely needs a GET route that accepts the query and forwards to KQL. Reuse/align
   with `kirby-types`. Then Craft (native API is GraphQL; consider Element API or
   Craft Query API for REST/GET).
