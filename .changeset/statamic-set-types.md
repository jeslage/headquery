---
"@headquery/codegen": minor
---

Bard and Replicator sets are exported as named interfaces, `{Handle}Set` (`callout` → `CalloutSet`, `text_image` → `TextImageSet`), and the field types reference them (`Array<HqBardText | CalloutSet | ImageSet>`). A set used in several fields with the same fields is one type. Sets that share a handle but differ in their fields are named after their location instead (`BlogBodyImageSet`). Replicator set `id` is now typed `string | null`, as the API returns it (was `id?: string`).
