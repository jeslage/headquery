# Statamic playground

A local Statamic site for developing the addon and running the JS client against a real
REST API. Only this README and `setup.sh` are committed; the install itself is gitignored.

## Fresh install

```bash
cd playgrounds/statamic
./setup.sh               # asks: local PHP or DDEV
./setup.sh --local       # or pick directly
./setup.sh --ddev
./setup.sh --no-seed     # blank Statamic site without demo content
```

`setup.sh` creates a Statamic project here, links `packages/php/statamic` via a Composer
path repository (symlinked, so edits apply immediately) and enables the REST API and the
schema endpoint in `.env`.

### Local PHP

Needs `php` and `composer` on your machine.

```bash
php artisan serve        # http://127.0.0.1:8000
```

### DDEV

Needs [DDEV](https://ddev.com). The script creates the DDEV project `headquery-statamic`
and starts it; the site runs at https://headquery-statamic.ddev.site (`ddev launch`).

Prefix PHP/Composer commands with `ddev`, e.g. `ddev php please …`, `ddev composer …`.
The monorepo's `packages/` folder is mounted into the container at `/var/packages`
(`.ddev/docker-compose.headquery.yaml`), so the relative path repository and the
`vendor/` symlink resolve inside the container too.

```bash
ddev stop                          # stop the project
ddev delete -Oy headquery-statamic # remove containers and database
```

## Demo content (`seed/`)

Unless you pass `--no-seed`, `setup.sh` copies `seed/` over the fresh install. The folder
mirrors a Statamic site root and contains a content model that follows
`spec/statamic/fixtures/schema.json`:

| Resource        | Handle               | Notes                                                                                                          |
| --------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Collection      | `blog`               | 4 entries (one unpublished); text, slug, date, toggle, integer, select, terms, users, assets, bard, replicator |
| Taxonomy        | `tags`               | `javascript`, `php`, `statamic`                                                                                |
| Globals         | `settings`           | `site_name`, `social` (grid)                                                                                   |
| Navigation      | `main`               | entry links, a nested child, an external URL                                                                   |
| Asset container | `assets`             | three SVGs in `public/assets`                                                                                  |
| User            | `author@example.com` | relation target for `author`, has no password                                                                  |

`seed/config/statamic/api.php` replaces the skeleton's API config: it exposes all of the
above, sets `allowed_filters` to the fixture's filterable fields and turns off API caching.

Differences from the fixture: there is no `seo` field (would need the SEO Pro addon), and
`blog` has an extra `related` entries field to cover entry relations.

Content you change in the Control Panel stays local; copy files back into `seed/` if
they should be committed.

## Using an existing prototype instead

Point your existing Statamic project at the addon with a path repository:

```bash
composer config repositories.headquery path ../path/to/headquery/packages/php/statamic
composer require headquery/statamic:@dev
```

## Try it

```bash
# BASE=http://127.0.0.1:8000 (local) or BASE=https://headquery-statamic.ddev.site (DDEV)
php please headquery:schema --out=schema.json        # DDEV: ddev php please …
curl -H "Authorization: Bearer dev-schema-token" $BASE/api/headquery/schema
```

Turn the schema into types (run from the repo root after `pnpm build`):

```bash
# from the exported file …
node packages/js/codegen/dist/cli.js --from playgrounds/statamic/schema.json --out types/cms.ts
# … or straight from the running site
node packages/js/codegen/dist/cli.js --from $BASE/api/headquery/schema --token dev-schema-token --out types/cms.ts
```

In a consuming project the CLI is the `headquery-codegen` bin of `@headquery/codegen`
(`npx headquery-codegen …`).
