---
"@headquery/schema": minor
"@headquery/codegen": minor
---

Typed link fields. Statamic's `link` fieldtype was typed as `string`, but the API always returns an object: `{ url }` for a URL (`{ url: null }` when empty), the shallow entry for an entry or `@child` link, and the shallow asset for an asset link. The IR has a new field type `link` with `targets` (`entry`, `asset`), and codegen emits `HqLinkUrl | HqLinkEntry | HqLinkAsset` (assets only when the field has a `container`). `link.url` works for every variant; narrow with `"title" in link` or `"alt" in link`. Update the `headquery/statamic` addon and regenerate your types.
