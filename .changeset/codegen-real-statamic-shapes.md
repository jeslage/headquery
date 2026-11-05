---
"@headquery/codegen": minor
---

Match generated Statamic types to real REST API responses (checked against Statamic 6):
select-like fields are typed as `HqOption<…>` (`{ key, value, label }`, or `HqEmptyOption`
when empty) instead of a plain string union; toggles are never `null`; `list`/`taggable`/`table`
fields can be `null`; grid rows include `id`; `HqAsset`, `HqRelatedEntry`, `HqRelatedTerm` and
`HqUser` now list the properties Statamic always returns.

Generated items now include Statamic's system fields via `HqEntryBase`, `HqTermBase` and
`HqGlobalBase` (`url`, `permalink`, `api_url`, `published`, `status`, `updated_at`, …), so they
can be used in `.fields()` and `.sort()`. Blueprint fields with the same handle take precedence.
