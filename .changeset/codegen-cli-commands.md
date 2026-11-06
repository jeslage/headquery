---
"@headquery/codegen": minor
---

The CLI bin is now `headquery` (was `headquery-codegen`) with two commands:

- `headquery init` asks for the CMS base URL (or a schema file) and the output path, writes
  `headquery.config.ts` (`.mts`/`.mjs` where Node or the project needs it) and prints the
  `package.json` scripts and `.env.example` lines to add. Flags: `--base-url`, `--from`, `--out`,
  `--yes`, `--force`.
- `headquery generate` does what `headquery-codegen` did (config file, flags, `--check`).

Before installing, run `npx @headquery/codegen init`.
