import type { ArgsDef } from "citty";
import { FRAMEWORKS } from "./detect";

export const args = {
  "base-url": {
    type: "string",
    description:
      "CMS origin, e.g. https://cms.example.com (default: $HEADQUERY_BASE_URL, else from .env.local or .env)",
    valueHint: "url",
  },
  from: {
    type: "string",
    description: "Full schema endpoint URL or local schema JSON file instead of --base-url",
    valueHint: "url|file",
  },
  out: {
    type: "string",
    description: "Output .ts file (default: src/cms.generated.ts, lib/… or ./…)",
    valueHint: "file",
  },
  framework: {
    type: "string",
    description: `How the client reads env vars: ${Object.keys(FRAMEWORKS).join(", ")} (default: detected from package.json)`,
    valueHint: "name",
  },
  client: {
    type: "boolean",
    description: "Create a client file next to the generated types (needs an adapter, e.g. @headquery/statamic)",
    default: true,
  },
  scripts: { type: "boolean", description: "Add cms:types scripts to package.json", default: true },
  env: { type: "boolean", description: "Add HEADQUERY_* lines to the env file", default: true },
  "env-file": {
    type: "string",
    description: "Env file to add the lines to (default: existing .env.local or .env, else asked)",
    valueHint: "file",
  },
  yes: {
    type: "boolean",
    alias: "y",
    description: "Don't ask; use flags and defaults (also when stdin isn't a terminal)",
    default: false,
  },
  force: { type: "boolean", description: "Overwrite an existing headquery.config and client file", default: false },
} as const satisfies ArgsDef;

/** Parsed `init` flags. */
export interface InitArgs {
  "base-url"?: string | undefined;
  from?: string | undefined;
  out?: string | undefined;
  framework?: string | undefined;
  client: boolean;
  scripts: boolean;
  env: boolean;
  "env-file"?: string | undefined;
  yes: boolean;
  force: boolean;
}
