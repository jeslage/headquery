---
"@headquery/schema": minor
"@headquery/codegen": minor
---

Extra shallow asset keys. Asset fields and asset links return only `id url permalink api_url alt` by default; projects that add keys (e.g. `width`, `height`, `focus_css` via the addon's `ShallowAsset::extend()` or their own asset class) now get them typed. The IR has a new optional top-level `assetKeys`, and codegen adds those keys to `HqAsset` and `HqLinkAsset` (typed from `HqAssetBase` when known, `unknown` otherwise). Update the `headquery/statamic` addon and regenerate your types.
