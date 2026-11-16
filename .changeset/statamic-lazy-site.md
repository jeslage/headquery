---
"@headquery/statamic": minor
---

The `site` client option also takes a function (`site: () => locale()`, sync or async). It's called for every request and adds `site=` to the same endpoints as a fixed default site, unless the query sets `.site()`. The client can stay a synchronous module-level value, so queries need no extra `await`. The lazy site is added when the request is sent, so it isn't part of `query.url()` / `toRequest()`.
