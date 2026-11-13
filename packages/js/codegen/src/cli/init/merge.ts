// Additions to files the project already has: package.json scripts, env lines, .gitignore check.
import type { SchemaSource } from "../../config";
import { clientEnv } from "./templates";
import type { Framework, MergeResult, PackageJson } from "./types";

export const SCRIPTS: Record<string, string> = {
  "cms:types": "headquery generate",
  "cms:types:check": "headquery generate --check",
};

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

/** Whether a .gitignore text ignores `file` (top-level file; supports `*` globs, ignores negations). */
export function isGitignored(gitignore: string, file: string): boolean {
  return gitignore.split(/\r?\n/).some((raw) => {
    const line = raw.trim().replace(/^\//, "");
    if (!line || line.startsWith("#") || line.startsWith("!") || line.includes("/")) return false;
    const pattern = line.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
    return new RegExp(`^${pattern}$`).test(file);
  });
}
