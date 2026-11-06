---
"@headquery/statamic": minor
"@headquery/codegen": minor
---

Navigation trees and the globals list:

- `cms.nav("main").tree()` (`GET /navs/{handle}/tree`) with `.maxDepth()`, `.site()` and
  `.fields()`. Pages are typed as plain links (`entry_id: null`) or entries of the linked
  collections (`entry_id: string`, with the entry's fields); nav blueprint fields are on every page.
- `cms.navs()` (`GET /navs`) and `cms.globals()` (`GET /globals`). Generated global sets extend
  `HqGlobalBase<"handle">`, so the `globals()` list is a union you can narrow by `handle`.
- Codegen reads the regrouped IR and emits `<Nav>NavFields`, `<Nav>NavPage` and the
  `HqNavPageBase`/`HqNavLink`/`HqNavEntry` helpers; `Schema` gains `navigations`.
