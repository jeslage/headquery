---
"@headquery/codegen": minor
---

`headquery init` now also offers to write a typed client file (when an adapter like `@headquery/statamic` is installed), add `cms:types` scripts to `package.json` and add the `HEADQUERY_*` lines to `.env.local`/`.env` (asking for a name if none exists). The framework (Next.js, Nuxt, Vite, Node) is detected and can be changed in the prompt; it decides how the client reads its base URL. New flags: `--framework`, `--no-client`, `--no-scripts`, `--no-env`, `--env-file`. The remaining next steps are printed as plain text without a box, including what to set up on the CMS (Statamic: Pro, REST API, schema route, `config:clear`).
