---
"@headquery/schema": minor
"@headquery/codegen": minor
---

Typed Bard sets. The IR's `richtext` fields carry the Bard field's `sets` (same shape as `blocks.sets`), and codegen types Bard fields exactly: an HTML `string` without sets, and with sets an array of `HqBardText` items (`{ type: "text", text }`) and one object per set (`{ id, type: "<set>", …fields }`), `[]` when empty. Narrow on `type` to render them.

**Breaking:** `HqRichText` is removed. Regenerate your types; Bard fields without sets are now `string | null`.
