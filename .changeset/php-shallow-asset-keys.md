---
"@headquery-internal/php-statamic": minor
---

Add `ShallowAsset::extend([...])` (and the `HasExtendedShallowKeys` trait for custom asset classes) to add keys to the shallow assets the REST API returns for asset fields and links. The schema export lists the extra keys as `assetKeys`.
