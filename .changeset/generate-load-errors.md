---
"@headquery/codegen": minor
---

`headquery generate` now explains why the schema couldn't be loaded instead of printing a bare `fetch failed`. The report leads with the HTTP status (e.g. `401 Unauthorized`) or system error (e.g. `ECONNREFUSED`, `self-signed certificate`), then shows the URL, content type, whether a token was sent and an excerpt of the response, followed by the likely cause and a checklist of common problems for the adapter with the matching one highlighted. `loadSchema()` throws the new exported `SchemaLoadError` with `kind`, `source`, `status`, `statusText`, `contentType`, `body` (excerpt), `code`, `reason` and `sentToken`.
