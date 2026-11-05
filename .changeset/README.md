# Changesets

Run `pnpm changeset` for every user-facing change to a published JS package, pick the
affected packages and the semver bump, and commit the generated file with your change.

The release workflow turns pending changesets into a "Version packages" PR; merging it
publishes to npm.
