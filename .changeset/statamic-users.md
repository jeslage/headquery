---
"@headquery/statamic": minor
---

Add users: `cms.users()` lists users (`GET /users`) with filters, sort, pagination and `fields`, and `cms.users().find(id)` fetches one user or `null`. Users are typed as `StatamicUser` (`id`, `email`, `name`, `is_super`, `api_url`), the fixed fields Statamic returns. Because user filters may target fields the API doesn't return (e.g. `roles`), `where()` accepts any field name for users; Statamic enforces `allowed_filters`.
