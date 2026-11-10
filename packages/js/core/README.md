# @headquery/core

The CMS-agnostic transport behind the headquery adapters: a thin `fetch` wrapper with deterministic,
cache-friendly URLs (sorted query keys), auth headers and typed errors (`HeadqueryHttpError`,
`HeadqueryNetworkError`).

You usually don't install this directly. Use a CMS adapter such as
[`@headquery/statamic`](https://www.npmjs.com/package/@headquery/statamic).

See the [repository](https://github.com/jeslage/headquery) for documentation. MIT licensed.
