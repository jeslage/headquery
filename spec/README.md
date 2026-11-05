# spec/

The cross-language contract between the PHP plugins and the JS packages.

- `ir/schema-v1.json`: JSON Schema of the headquery intermediate schema (IR). The TS types in
  `packages/js/schema` and every PHP exporter must agree with it.
- `<cms>/fixtures/schema.json`: a realistic IR document per CMS. Used by:
  - `packages/js/schema` (validation + contract test with Ajv)
  - `packages/js/codegen` (snapshot `tests/__generated__/<cms>.ts`, type-checked against the adapter)
  - `packages/php/<cms>` (`ContractTest.php`, validated with opis/json-schema)

Changing the IR means: update `schema-v1.json`, `packages/js/schema/src/index.ts`, the
codegen, the PHP mappers and the fixtures in the same PR. A breaking change bumps
`schemaVersion` and needs a new `schema-v2.json`.
