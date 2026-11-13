---
"@headquery/statamic": minor
---

Add forms and sites: `cms.forms()` lists the forms enabled in `resources.forms`, `cms.forms(handle)` fetches one form with its fields (`StatamicForm`, `StatamicFormField`), and `cms.sites()` lists the sites (`StatamicSite`). The remaining metadata endpoints and `/ping` are documented to use `cms.send()`.
