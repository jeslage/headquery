// Reads what `init` needs to know about the project directory (nothing is written here).
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as util from "node:util";
import { findConfig } from "../../config";
import type { InitContext, PackageJson } from "./types";

export interface Project {
  ctx: InitContext;
  /** Raw package.json text, to merge scripts into while keeping its formatting. */
  packageJsonText?: string;
  /** Path of an existing headquery.config.*, if any. */
  existingConfig?: string;
}

const ENV_FILES = [".env.local", ".env"];
const LOCKFILES = ["pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "package-lock.json"];

export const readText = (path: string) => readFile(path, "utf8").catch(() => undefined);

export async function readProject(cwd: string): Promise<Project> {
  const exists = (file: string) => existsSync(resolve(cwd, file));
  const packageJsonText = await readText(resolve(cwd, "package.json"));
  const packageJson = parsePackageJson(packageJsonText);
  const envFiles = ENV_FILES.filter(exists);
  const dotenv = await findDotenvBaseUrl(cwd, envFiles);
  const existingConfig = await findConfig(cwd);

  return {
    ctx: {
      env: process.env,
      hasSrcDir: exists("src"),
      hasLibDir: exists("lib"),
      hasTsconfig: exists("tsconfig.json"),
      ...(packageJson ? { packageJson } : {}),
      nodeStripsTypes: Boolean((process.features as { typescript?: unknown }).typescript),
      ...(dotenv ? { dotenv } : {}),
      envFiles,
      lockfiles: LOCKFILES.filter(exists),
    },
    // Only an intact package.json gets scripts merged into it.
    ...(packageJson && packageJsonText !== undefined ? { packageJsonText } : {}),
    ...(existingConfig ? { existingConfig } : {}),
  };
}

function parsePackageJson(text: string | undefined): PackageJson | undefined {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** First `HEADQUERY_BASE_URL` in .env.local or .env, as a suggestion only (nothing is loaded). */
async function findDotenvBaseUrl(cwd: string, files: string[]): Promise<InitContext["dotenv"]> {
  // util.parseEnv needs Node ≥ 20.12; without it there's simply no suggestion.
  const parseEnv = (util as { parseEnv?: (content: string) => Record<string, string | undefined> }).parseEnv;
  if (!parseEnv) return undefined;
  for (const file of files) {
    const content = await readText(resolve(cwd, file));
    const baseUrl = content === undefined ? undefined : parseEnv(content).HEADQUERY_BASE_URL;
    if (baseUrl) return { file, baseUrl };
  }
  return undefined;
}
