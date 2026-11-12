// Pure parts of `headquery init`: defaults, generated file texts, merges, next-steps text.
// File system and prompts live in commands/init.ts.
import { posix } from "node:path";
import type { SchemaSource } from "./config";

export type ConfigFormat = "ts" | "mts" | "mjs";
export type Framework = "next" | "nuxt" | "vite" | "node";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface PackageJson {
  type?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** Facts about the project directory, gathered by the command. */
export interface InitContext {
  env: Record<string, string | undefined>;
  hasSrcDir: boolean;
  hasLibDir: boolean;
  hasTsconfig: boolean;
  /** Parsed package.json, if there is one. */
  packageJson?: PackageJson;
  /** Whether this Node can import .ts files natively (`process.features.typescript`). */
  nodeStripsTypes: boolean;
  /** `HEADQUERY_BASE_URL` found in a dotenv file (only used as a suggestion, nothing is loaded). */
  dotenv?: { file: string; baseUrl: string };
  /** Existing dotenv files (`.env.local`, `.env`), in that order. */
  envFiles?: string[];
  /** Lockfiles in the project directory. */
  lockfiles?: string[];
}

export interface InitFlags {
  baseUrl?: string | undefined;
  from?: string | undefined;
  out?: string | undefined;
  framework?: string | undefined;
}

export interface InitDefaults {
  /** Source to suggest, if one is known (flag, `$HEADQUERY_BASE_URL` or a dotenv file). */
  source?: SchemaSource;
  /** Where `source` came from, for the prompt, e.g. "HEADQUERY_BASE_URL in .env.local". */
  sourceOrigin?: string;
  out: string;
  /** Why `out` was chosen, for the prompt. */
  outOrigin: string;
  format: ConfigFormat;
  framework: Framework;
  /** Why `framework` was chosen, for the prompt. */
  frameworkOrigin: string;
}

const isUrl = (value: string) => /^https?:\/\//i.test(value);

const dependencies = (pkg: PackageJson | undefined) => ({ ...pkg?.dependencies, ...pkg?.devDependencies });

/** Interpret a prompt answer: an http(s) value is the CMS base URL, anything else a schema file. */
export function parseSourceInput(input: string): SchemaSource {
  const value = input.trim();
  return isUrl(value) ? { baseUrl: value.replace(/\/+$/, "") } : value;
}

export const FRAMEWORKS: Record<Framework, string> = {
  next: "Next.js",
  nuxt: "Nuxt",
  vite: "Vite",
  node: "Node (or other)",
};

const isFramework = (value: string): value is Framework => Object.hasOwn(FRAMEWORKS, value);

/** Framework from package.json dependencies, if one is recognised. */
export function detectFramework(pkg: PackageJson | undefined): Framework | undefined {
  const deps = dependencies(pkg);
  // Nuxt and many Next setups also depend on vite, so check the frameworks first.
  return "next" in deps ? "next" : "nuxt" in deps ? "nuxt" : "vite" in deps ? "vite" : undefined;
}

export function initDefaults(ctx: InitContext, flags: InitFlags = {}): InitDefaults {
  if (flags.baseUrl !== undefined && flags.from !== undefined) {
    throw new Error("headquery init: use either --from or --base-url, not both");
  }
  if (flags.baseUrl !== undefined && !isUrl(flags.baseUrl)) {
    throw new Error(`headquery init: --base-url must be an http(s) URL, got "${flags.baseUrl}"`);
  }
  if (flags.framework !== undefined && !isFramework(flags.framework)) {
    throw new Error(
      `headquery init: --framework must be one of ${Object.keys(FRAMEWORKS).join(", ")}, got "${flags.framework}"`,
    );
  }
  const envBaseUrl = ctx.env.HEADQUERY_BASE_URL || undefined;
  const trim = (url: string) => url.replace(/\/+$/, "");
  let source: SchemaSource | undefined;
  let sourceOrigin: string | undefined;
  if (flags.baseUrl !== undefined) {
    [source, sourceOrigin] = [{ baseUrl: trim(flags.baseUrl) }, "--base-url"];
  } else if (flags.from !== undefined) {
    [source, sourceOrigin] = [flags.from, "--from"];
  } else if (envBaseUrl && isUrl(envBaseUrl)) {
    [source, sourceOrigin] = [{ baseUrl: trim(envBaseUrl) }, "$HEADQUERY_BASE_URL"];
  } else if (ctx.dotenv && isUrl(ctx.dotenv.baseUrl)) {
    [source, sourceOrigin] = [{ baseUrl: trim(ctx.dotenv.baseUrl) }, `HEADQUERY_BASE_URL in ${ctx.dotenv.file}`];
  }

  const [out, outOrigin] =
    flags.out !== undefined
      ? [flags.out, "--out"]
      : ctx.hasSrcDir
        ? ["src/cms.generated.ts", "src/ exists"]
        : ctx.hasLibDir
          ? ["lib/cms.generated.ts", "lib/ exists"]
          : ["cms.generated.ts", "no src/ or lib/ folder"];

  // .ts only where Node can load it; .mts outside "type": "module" packages so Node treats it as ESM.
  const format: ConfigFormat =
    !ctx.hasTsconfig || !ctx.nodeStripsTypes ? "mjs" : ctx.packageJson?.type === "module" ? "ts" : "mts";

  const detected = detectFramework(ctx.packageJson);
  const [framework, frameworkOrigin]: [Framework, string] =
    flags.framework !== undefined
      ? [flags.framework as Framework, "--framework"]
      : detected
        ? [detected, "detected from package.json"]
        : ["node", "no framework found in package.json"];

  return {
    ...(source !== undefined ? { source } : {}),
    ...(sourceOrigin !== undefined ? { sourceOrigin } : {}),
    out,
    outOrigin,
    format,
    framework,
    frameworkOrigin,
  };
}

const sourceLabel = (source: SchemaSource) => (typeof source === "string" ? source : source.baseUrl);

export interface TextPrompt {
  message: string;
  /** Pre-filled, editable answer (the default). */
  initialValue?: string;
  /** Dim hint shown while the answer is empty (only when there is no default). */
  placeholder?: string;
}

/** Texts for the interactive prompts (rendered with @clack/prompts). */
export function initPrompts(defaults: InitDefaults): { intro: string; source: TextPrompt; out: TextPrompt } {
  return {
    intro: `Creating ${configFileName(defaults.format)}`,
    source:
      defaults.source !== undefined
        ? {
            message: `CMS base URL or schema file (default from ${defaults.sourceOrigin})`,
            initialValue: sourceLabel(defaults.source),
          }
        : {
            message:
              "CMS base URL or schema file (no default: HEADQUERY_BASE_URL isn't set in env, .env.local or .env)",
            placeholder: "https://cms.example.com or ./schema.json",
          },
    out: { message: `Output file for the generated types (${defaults.outOrigin})`, initialValue: defaults.out },
  };
}

export const configFileName = (format: ConfigFormat) => `headquery.config.${format}`;

/** Text of the generated config file (valid as .ts, .mts and .mjs). */
export function renderConfig(answers: { source: SchemaSource; out: string; envFile?: string | undefined }): string {
  const { source, out, envFile } = answers;
  const from =
    typeof source === "string"
      ? JSON.stringify(source)
      : `{ baseUrl: process.env.HEADQUERY_BASE_URL ?? ${JSON.stringify(source.baseUrl)} }`;
  const loadEnv = envFile
    ? [
        `// The CLI doesn't load .env files itself. Existing env vars (e.g. CI secrets) win.`,
        `try {`,
        `  process.loadEnvFile(new URL(${JSON.stringify(envFile)}, import.meta.url));`,
        `} catch {`,
        `  // no such file (e.g. in CI): use the real environment`,
        `}`,
      ]
    : [
        `// The CLI doesn't load .env files; do it here if you need them, e.g.`,
        `// process.loadEnvFile(".env.local");`,
      ];
  return [
    `import { defineConfig } from "@headquery/codegen";`,
    ``,
    ...loadEnv,
    ``,
    `export default defineConfig({`,
    `  from: ${from},`,
    `  out: ${JSON.stringify(out)},`,
    ...(typeof source === "string" ? [] : [`  // token defaults to process.env.HEADQUERY_SCHEMA_TOKEN`]),
    `});`,
    ``,
  ].join("\n");
}

// --- client file ---

/** CMS adapter packages and the client factory they export. */
export interface AdapterInfo {
  factory: string;
  /**
   * What to set up on the CMS, for the next steps: text lines, and code lines (commands, env lines)
   * marked with "$ " that are printed indented without the marker.
   */
  cmsSetup: (source: SchemaSource) => string[];
}

export const ADAPTERS = {
  "@headquery/statamic": {
    factory: "createStatamicClient",
    cmsSetup: (source) => [
      "On the CMS: the REST API is a Statamic Pro feature and off by default. Add to its .env:",
      "$ STATAMIC_PRO_ENABLED=true",
      "$ STATAMIC_API_ENABLED=true",
      ...(typeof source === "string"
        ? []
        : ["$ HEADQUERY_SCHEMA_ROUTE=true", "$ HEADQUERY_SCHEMA_TOKEN=<a long random token>"]),
      "Enable the resources you query (and their allowed_filters) in config/statamic/api.php, then run:",
      "$ php artisan config:clear",
      ...(typeof source === "string"
        ? ["and export the schema:", `$ php please headquery:schema --out=${source}`]
        : []),
    ],
  },
} satisfies Record<string, AdapterInfo>;

export type Adapter = keyof typeof ADAPTERS;

/** First installed adapter package, if any. */
export function detectAdapter(pkg: PackageJson | undefined): Adapter | undefined {
  const deps = dependencies(pkg);
  return (Object.keys(ADAPTERS) as Adapter[]).find((name) => name in deps);
}

/** Env var the client reads its base URL from, and the expression that reads it. Nuxt has none. */
export function clientEnv(framework: Framework): { name: string; expression: string } | undefined {
  switch (framework) {
    case "next":
      // NEXT_PUBLIC_ is inlined at build time, so the client works in server and client components.
      return { name: "NEXT_PUBLIC_HEADQUERY_BASE_URL", expression: "process.env.NEXT_PUBLIC_HEADQUERY_BASE_URL" };
    case "vite":
      return { name: "VITE_HEADQUERY_BASE_URL", expression: "import.meta.env.VITE_HEADQUERY_BASE_URL" };
    case "nuxt":
      return undefined;
    case "node":
      return { name: "HEADQUERY_BASE_URL", expression: "process.env.HEADQUERY_BASE_URL" };
  }
}

/** Default client file: `cms.ts` next to the generated types. */
export function clientPath(out: string): string {
  const dir = posix.dirname(out.replaceAll("\\", "/"));
  const name = posix.basename(out) === "cms.ts" ? "client.ts" : "cms.ts";
  return dir === "." ? name : `${dir}/${name}`;
}

/** Import specifier of `target` from `from` (both project-relative), without the .ts extension. */
function importPath(from: string, target: string): string {
  const rel = posix
    .relative(posix.dirname(from.replaceAll("\\", "/")), target.replaceAll("\\", "/"))
    .replace(/\.(m|c)?tsx?$/, "");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

/** Text of the client file. */
export function renderClient(options: {
  adapter: Adapter;
  framework: Framework;
  source: SchemaSource;
  clientPath: string;
  out: string;
}): string {
  const { factory } = ADAPTERS[options.adapter];
  const env = clientEnv(options.framework);
  const literal = typeof options.source === "string" ? "https://cms.example.com" : options.source.baseUrl;
  const value = env ? `${env.expression} ?? ${JSON.stringify(literal)}` : JSON.stringify(literal);
  const comments = [
    ...(typeof options.source === "string" ? [`  // TODO: the origin of your CMS`] : []),
    ...(options.framework === "nuxt"
      ? [`  // To set it per environment, use runtimeConfig.public in nuxt.config and pass it in here.`]
      : []),
  ];
  return [
    `import { ${factory} } from ${JSON.stringify(options.adapter)};`,
    `// Generated by \`headquery generate\`; run it again whenever the content model changes.`,
    `import type { Schema } from ${JSON.stringify(importPath(options.clientPath, options.out))};`,
    ``,
    `export const cms = ${factory}<Schema>({`,
    ...comments,
    `  baseUrl: ${value},`,
    `});`,
    ``,
  ].join("\n");
}

// --- package.json scripts ---

export const SCRIPTS: Record<string, string> = {
  "cms:types": "headquery generate",
  "cms:types:check": "headquery generate --check",
};

export interface MergeResult {
  /** New file text (unchanged when nothing was added). */
  text: string;
  added: string[];
  /** Keys that already exist with a different value; never overwritten. */
  skipped: string[];
}

/** Add `SCRIPTS` to a package.json text, keeping its indentation and existing scripts. */
export function mergeScripts(text: string): MergeResult {
  const pkg = JSON.parse(text) as PackageJson;
  const scripts = { ...pkg.scripts };
  const added: string[] = [];
  const skipped: string[] = [];
  for (const [key, value] of Object.entries(SCRIPTS)) {
    if (!(key in scripts)) {
      scripts[key] = value;
      added.push(key);
    } else if (scripts[key] !== value) {
      skipped.push(key);
    }
  }
  if (added.length === 0) return { text, added, skipped };
  const indent = /^([ \t]+)"/m.exec(text)?.[1] ?? "  ";
  const newline = text.endsWith("\n") ? "\n" : "";
  return { text: JSON.stringify({ ...pkg, scripts }, null, indent) + newline, added, skipped };
}

// --- env file ---

/** Env lines for a base URL source: codegen's vars, plus the client's var if it reads another one. */
export function envLines(options: { source: SchemaSource; framework: Framework; client: boolean }): string[] {
  if (typeof options.source === "string") return [];
  const lines = [`HEADQUERY_BASE_URL=${options.source.baseUrl}`, `HEADQUERY_SCHEMA_TOKEN=`];
  const env = options.client ? clientEnv(options.framework) : undefined;
  if (env && env.name !== "HEADQUERY_BASE_URL") lines.push(`${env.name}=${options.source.baseUrl}`);
  return lines;
}

const envKey = (line: string) => /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];

/** Append env lines whose keys aren't set yet. `existing` is undefined for a new file. */
export function mergeEnv(existing: string | undefined, lines: string[]): MergeResult {
  const present = new Set((existing ?? "").split(/\r?\n/).map(envKey).filter(Boolean));
  const toAdd = lines.filter((line) => !present.has(envKey(line)));
  const skipped = lines.filter((line) => present.has(envKey(line))).map((line) => envKey(line)!);
  const added = toAdd.map((line) => envKey(line)!);
  if (toAdd.length === 0) return { text: existing ?? "", added, skipped };
  const before = existing ? `${existing.replace(/\n*$/, "")}\n\n` : "";
  return { text: `${before}# headquery\n${toAdd.join("\n")}\n`, added, skipped };
}

/** Default name for a new env file: the one the framework loads and git usually ignores. */
export const defaultEnvFile = (framework: Framework) =>
  framework === "next" || framework === "vite" ? ".env.local" : ".env";

/** Whether a .gitignore text ignores `file` (top-level file; supports `*` globs, ignores negations). */
export function isGitignored(gitignore: string, file: string): boolean {
  return gitignore.split(/\r?\n/).some((raw) => {
    const line = raw.trim().replace(/^\//, "");
    if (!line || line.startsWith("#") || line.startsWith("!") || line.includes("/")) return false;
    const pattern = line.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
    return new RegExp(`^${pattern}$`).test(file);
  });
}

// --- next steps ---

/** Package manager from package.json's `packageManager` field or a lockfile; npm otherwise. */
export function detectPackageManager(pkg: PackageJson | undefined, lockfiles: string[] = []): PackageManager {
  const field = pkg?.packageManager?.split("@")[0];
  if (field === "pnpm" || field === "yarn" || field === "bun" || field === "npm") return field;
  if (lockfiles.includes("pnpm-lock.yaml")) return "pnpm";
  if (lockfiles.includes("yarn.lock")) return "yarn";
  if (lockfiles.includes("bun.lock") || lockfiles.includes("bun.lockb")) return "bun";
  return "npm";
}

const pmCommands: Record<PackageManager, { addDev: string; run: string; exec: string }> = {
  npm: { addDev: "npm install -D", run: "npm run", exec: "npx" },
  pnpm: { addDev: "pnpm add -D", run: "pnpm", exec: "pnpm exec" },
  yarn: { addDev: "yarn add -D", run: "yarn", exec: "yarn" },
  bun: { addDev: "bun add -d", run: "bun run", exec: "bunx" },
};

/** Next steps printed after `init` (without a heading): only what `init` didn't do itself. */
export function renderNextSteps(answers: {
  source: SchemaSource;
  out: string;
  hasCodegenDependency: boolean;
  packageManager?: PackageManager;
  framework?: Framework;
  /** Written client file, if any. */
  client?: string | undefined;
  /** Whether package.json has the `cms:types` scripts now. */
  scripts?: boolean;
  /** Env file the lines were written to, if any. */
  envFile?: string | undefined;
  /** Adapter whose CMS setup to list. */
  adapter?: Adapter | undefined;
}): string {
  const pm = pmCommands[answers.packageManager ?? "npm"];
  const lines: string[] = [];
  let step = 1;
  if (!answers.hasCodegenDependency) {
    lines.push(`${step++}. Install the CLI as a dev dependency:`, ``, `   ${pm.addDev} @headquery/codegen`, ``);
  }
  if (!answers.scripts) {
    lines.push(
      `${step++}. Add scripts to package.json:`,
      ``,
      ...Object.entries(SCRIPTS).map(
        ([key, value], i, all) => `   "${key}": "${value}"${i < all.length - 1 ? "," : ""}`,
      ),
      ``,
    );
  }
  if (answers.adapter) {
    const [first = "", ...rest] = ADAPTERS[answers.adapter].cmsSetup(answers.source);
    lines.push(`${step++}. ${first}`);
    // Paragraphs are separated by blank lines; consecutive code lines form one block.
    let previousWasCode = false;
    for (const line of rest) {
      const code = line.startsWith("$ ");
      if (!(code && previousWasCode)) lines.push(``);
      lines.push(`   ${code ? line.slice(2) : line}`);
      previousWasCode = code;
    }
    lines.push(``);
  }
  if (typeof answers.source !== "string") {
    if (answers.envFile) {
      lines.push(
        `${step++}. Set HEADQUERY_SCHEMA_TOKEN in ${answers.envFile} to the CMS's token (and the env vars in CI).`,
        ``,
      );
    } else {
      lines.push(
        `${step++}. Set these env vars (e.g. in .env.local and in CI):`,
        ``,
        ...envLines({
          source: answers.source,
          framework: answers.framework ?? "node",
          client: Boolean(answers.client),
        }).map((line) => `   ${line}`),
        ``,
      );
    }
  }
  const generate = answers.scripts ? `${pm.run} cms:types` : `${pm.exec} headquery generate`;
  lines.push(`${step++}. Generate the types:`, ``, `   ${generate}`, ``);
  lines.push(
    answers.client
      ? `${step++}. Import \`cms\` from ${answers.client} and start querying.`
      : `${step++}. Import ${answers.out} once where you create the client.`,
  );
  return lines.join("\n");
}
