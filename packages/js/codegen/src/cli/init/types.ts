import type { SchemaSource } from "../../config";

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

/** Result of a merge into an existing file (package.json scripts, env lines). */
export interface MergeResult {
  /** New file text (unchanged when nothing was added). */
  text: string;
  added: string[];
  /** Keys that already exist with a different value; never overwritten. */
  skipped: string[];
}
