// Pure parts of `headquery init`: defaults, config file text, next-steps text.
// File system and prompts live in commands/init.ts.
import type { SchemaSource } from "./config";

export type ConfigFormat = "ts" | "mts" | "mjs";

/** Facts about the project directory, gathered by the command. */
export interface InitContext {
  env: Record<string, string | undefined>;
  hasSrcDir: boolean;
  hasLibDir: boolean;
  hasTsconfig: boolean;
  /** Parsed package.json, if there is one. */
  packageJson?: {
    type?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  /** Whether this Node can import .ts files natively (`process.features.typescript`). */
  nodeStripsTypes: boolean;
}

export interface InitFlags {
  baseUrl?: string | undefined;
  from?: string | undefined;
  out?: string | undefined;
}

export interface InitDefaults {
  /** Source to suggest, if one is known (flag or `$HEADQUERY_BASE_URL`). */
  source?: SchemaSource;
  out: string;
  format: ConfigFormat;
}

const isUrl = (value: string) => /^https?:\/\//i.test(value);

/** Interpret a prompt answer: an http(s) value is the CMS base URL, anything else a schema file. */
export function parseSourceInput(input: string): SchemaSource {
  const value = input.trim();
  return isUrl(value) ? { baseUrl: value.replace(/\/+$/, "") } : value;
}

export function initDefaults(ctx: InitContext, flags: InitFlags = {}): InitDefaults {
  if (flags.baseUrl !== undefined && flags.from !== undefined) {
    throw new Error("headquery init: use either --from or --base-url, not both");
  }
  if (flags.baseUrl !== undefined && !isUrl(flags.baseUrl)) {
    throw new Error(`headquery init: --base-url must be an http(s) URL, got "${flags.baseUrl}"`);
  }
  const envBaseUrl = ctx.env.HEADQUERY_BASE_URL || undefined;
  const source: SchemaSource | undefined =
    flags.baseUrl !== undefined
      ? { baseUrl: flags.baseUrl.replace(/\/+$/, "") }
      : flags.from !== undefined
        ? flags.from
        : envBaseUrl && isUrl(envBaseUrl)
          ? { baseUrl: envBaseUrl.replace(/\/+$/, "") }
          : undefined;

  const out =
    flags.out ?? (ctx.hasSrcDir ? "src/cms.generated.ts" : ctx.hasLibDir ? "lib/cms.generated.ts" : "cms.generated.ts");

  // .ts only where Node can load it; .mts outside "type": "module" packages so Node treats it as ESM.
  const format: ConfigFormat =
    !ctx.hasTsconfig || !ctx.nodeStripsTypes ? "mjs" : ctx.packageJson?.type === "module" ? "ts" : "mts";

  return { ...(source !== undefined ? { source } : {}), out, format };
}

export const configFileName = (format: ConfigFormat) => `headquery.config.${format}`;

/** Text of the generated config file (valid as .ts, .mts and .mjs). */
export function renderConfig(answers: { source: SchemaSource; out: string }): string {
  const { source, out } = answers;
  const from =
    typeof source === "string"
      ? JSON.stringify(source)
      : `{ baseUrl: process.env.HEADQUERY_BASE_URL ?? ${JSON.stringify(source.baseUrl)} }`;
  return [
    `import { defineConfig } from "@headquery/codegen";`,
    ``,
    `// The CLI doesn't load .env files; do it here if you need them, e.g.`,
    `// process.loadEnvFile(".env.local");`,
    ``,
    `export default defineConfig({`,
    `  from: ${from},`,
    `  out: ${JSON.stringify(out)},`,
    ...(typeof source === "string" ? [] : [`  // token defaults to process.env.HEADQUERY_SCHEMA_TOKEN`]),
    `});`,
    ``,
  ].join("\n");
}

/** Instructions printed after `init`. Nothing here is written to disk. */
export function renderNextSteps(answers: {
  source: SchemaSource;
  out: string;
  configFile: string;
  hasCodegenDependency: boolean;
}): string {
  const lines: string[] = [`✓ wrote ${answers.configFile}`, ``, `Next steps:`, ``];
  let step = 1;
  if (!answers.hasCodegenDependency) {
    lines.push(`${step++}. Install the CLI as a dev dependency:`, ``, `     npm install -D @headquery/codegen`, ``);
  }
  lines.push(
    `${step++}. Add scripts to package.json:`,
    ``,
    `     "cms:types": "headquery generate",`,
    `     "cms:types:check": "headquery generate --check"`,
    ``,
  );
  if (typeof answers.source !== "string") {
    lines.push(
      `${step++}. Add to .env.example (and set real values in your env / CI secrets):`,
      ``,
      `     HEADQUERY_BASE_URL=${answers.source.baseUrl}`,
      `     HEADQUERY_SCHEMA_TOKEN=`,
      ``,
    );
  }
  lines.push(
    `${step++}. Run \`npx headquery generate\`, then import ${answers.out} once where you create the client.`,
  );
  return lines.join("\n");
}
