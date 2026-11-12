# @headquery/codegen

> **Early development.** headquery is still under development and should not be used in production yet. APIs, generated types and the schema format may change in any 0.x release.

The `headquery` CLI generates TypeScript types for headquery clients from your CMS's content model.
The schema comes from a CMS plugin (for Statamic: the Composer package
[`headquery/statamic`](https://packagist.org/packages/headquery/statamic)), either as an exported file or from an
authenticated endpoint.

```bash
npm install -D @headquery/codegen

# once: writes headquery.config.ts and offers a typed client file, package.json scripts and env lines
npx headquery init

# whenever the content model changes (add --check in CI)
npx headquery generate

# without a config file
npx headquery generate --base-url https://cms.example.com --out src/cms.generated.ts
npx headquery generate --from schema.json --out src/cms.generated.ts
```

The generated module exports a `Schema` type to pass to the client (`createStatamicClient<Schema>()`) and also
augments `@headquery/statamic`, so importing the file once registers it globally. A programmatic API (`generate`, `loadSchema`) is exported as well.

See the [repository](https://github.com/jeslage/headquery) for documentation. MIT licensed.
