---
"@headquery/codegen": minor
---

Extra shallow asset keys (`assetKeys`) that are blueprint fields of an asset container are now typed from the container's asset type instead of `unknown`, e.g. `tone: AssetsAsset["tone"]` on `HqAsset` and `HqLinkAsset`. With several containers the type is their union, plus `null` when a container doesn't have the field.
