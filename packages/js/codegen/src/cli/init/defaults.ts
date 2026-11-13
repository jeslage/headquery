// Suggested answers for `headquery init` and the texts of the questions that show them.
import type { SchemaSource } from "../../config";
import { isUrl, trimTrailingSlash } from "../../url";
import type { TextPrompt } from "../prompts";
import { detectFramework, FRAMEWORKS, isFramework } from "./detect";
import type { ConfigFormat, Framework, InitContext, InitDefaults, InitFlags } from "./types";

export const configFileName = (format: ConfigFormat) => `headquery.config.${format}`;

/** Default name for a new env file: the one the framework loads and git usually ignores. */
export const defaultEnvFile = (framework: Framework) =>
  framework === "next" || framework === "vite" ? ".env.local" : ".env";

/** Interpret a prompt answer: an http(s) value is the CMS base URL, anything else a schema file. */
export function parseSourceInput(input: string): SchemaSource {
  const value = input.trim();
  return isUrl(value) ? { baseUrl: trimTrailingSlash(value) } : value;
}

export function initDefaults(ctx: InitContext, flags: InitFlags = {}): InitDefaults {
  assertFlags(flags);
  const source = defaultSource(ctx, flags);
  const [out, outOrigin] = defaultOut(ctx, flags);
  const [framework, frameworkOrigin] = defaultFramework(ctx, flags);
  return {
    ...(source ? { source: source[0], sourceOrigin: source[1] } : {}),
    out,
    outOrigin,
    format: configFormat(ctx),
    framework,
    frameworkOrigin,
  };
}

function assertFlags(flags: InitFlags): void {
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
}

/** Source and where it came from: flag, `$HEADQUERY_BASE_URL`, then a dotenv file. */
function defaultSource(ctx: InitContext, flags: InitFlags): [SchemaSource, string] | undefined {
  const envBaseUrl = ctx.env.HEADQUERY_BASE_URL || undefined;
  if (flags.baseUrl !== undefined) return [{ baseUrl: trimTrailingSlash(flags.baseUrl) }, "--base-url"];
  if (flags.from !== undefined) return [flags.from, "--from"];
  if (envBaseUrl && isUrl(envBaseUrl)) return [{ baseUrl: trimTrailingSlash(envBaseUrl) }, "$HEADQUERY_BASE_URL"];
  if (ctx.dotenv && isUrl(ctx.dotenv.baseUrl)) {
    return [{ baseUrl: trimTrailingSlash(ctx.dotenv.baseUrl) }, `HEADQUERY_BASE_URL in ${ctx.dotenv.file}`];
  }
  return undefined;
}

function defaultOut(ctx: InitContext, flags: InitFlags): [string, string] {
  if (flags.out !== undefined) return [flags.out, "--out"];
  if (ctx.hasSrcDir) return ["src/cms.generated.ts", "src/ exists"];
  if (ctx.hasLibDir) return ["lib/cms.generated.ts", "lib/ exists"];
  return ["cms.generated.ts", "no src/ or lib/ folder"];
}

/** .ts only where Node can load it; .mts outside "type": "module" packages so Node treats it as ESM. */
function configFormat(ctx: InitContext): ConfigFormat {
  if (!ctx.hasTsconfig || !ctx.nodeStripsTypes) return "mjs";
  return ctx.packageJson?.type === "module" ? "ts" : "mts";
}

function defaultFramework(ctx: InitContext, flags: InitFlags): [Framework, string] {
  if (flags.framework !== undefined) return [flags.framework as Framework, "--framework"];
  const detected = detectFramework(ctx.packageJson);
  return detected ? [detected, "detected from package.json"] : ["node", "no framework found in package.json"];
}

const sourceLabel = (source: SchemaSource) => (typeof source === "string" ? source : source.baseUrl);

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
