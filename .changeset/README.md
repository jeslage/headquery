# Changesets

Run `pnpm changeset` for every user-facing change to a published JS package or to the PHP
addon (`@headquery-internal/php-statamic`), pick the affected packages and the semver bump,
and commit the generated file with your change.

The release workflow turns pending changesets into a "Version packages" PR; merging it
publishes to npm, and `php-release.yml` tags and splits a bumped PHP addon for Packagist.
