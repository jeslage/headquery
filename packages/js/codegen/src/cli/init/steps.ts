// The files `init` writes, one function per file. Each reports what it did.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { log } from "@clack/prompts";
import { ok, warn } from "../output";
import { yesNo } from "../prompts";
import { envLines, isGitignored, mergeEnv, mergeScripts, SCRIPTS } from "./merge";
import type { InitPlan } from "./plan";
import { type Project, readText } from "./project";
import { renderClient, renderConfig } from "./templates";

export interface Reporter {
  report: (message: string) => void;
  warn: (message: string) => void;
}

/** Inside the clack session when interactive, plain ✓/! lines otherwise. */
export const createReporter = (interactive: boolean): Reporter =>
  interactive ? { report: log.success, warn: log.warn } : { report: ok, warn };

export async function writeConfigFile(cwd: string, plan: InitPlan, project: Project, out: Reporter): Promise<void> {
  const { source, configFile, envFile } = plan;
  await writeFile(resolve(cwd, configFile), renderConfig({ source, out: plan.out, envFile }));
  out.report(`Wrote ${configFile}`);
  const existing = project.existingConfig && basename(project.existingConfig);
  if (existing && existing !== configFile) {
    out.warn(`${existing} still exists; remove it so ${configFile} is the only config.`);
  }
}

/** Returns the client file if it was written. */
export async function writeClientFile(
  cwd: string,
  plan: InitPlan,
  options: { force: boolean; interactive: boolean },
  out: Reporter,
): Promise<string | undefined> {
  const { client, adapter } = plan;
  if (client === undefined || adapter === undefined) return undefined;
  const path = resolve(cwd, client);
  let write = !existsSync(path) || options.force;
  if (!write && options.interactive) write = await yesNo(`${client} already exists. Overwrite it?`, false);
  if (!write) {
    out.warn(`${client} already exists, left unchanged (use --force to overwrite)`);
    return undefined;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    renderClient({ adapter, framework: plan.framework, source: plan.source, clientPath: client, out: plan.out }),
  );
  out.report(`Wrote ${client}`);
  return client;
}

/** Returns whether package.json has all our scripts afterwards (whoever wrote them). */
export async function addScripts(cwd: string, plan: InitPlan, project: Project, out: Reporter): Promise<boolean> {
  let scripts = project.ctx.packageJson?.scripts ?? {};
  if (plan.scripts && project.packageJsonText !== undefined) {
    const merged = mergeScripts(project.packageJsonText);
    if (merged.added.length > 0) {
      await writeFile(resolve(cwd, "package.json"), merged.text);
      out.report(`Added ${merged.added.join(", ")} to package.json scripts`);
      scripts = { ...scripts, ...Object.fromEntries(merged.added.map((key) => [key, SCRIPTS[key]!])) };
    }
    for (const key of merged.skipped) {
      out.warn(`package.json already has a "${key}" script (${JSON.stringify(scripts[key])}), left unchanged`);
    }
  }
  return Object.keys(SCRIPTS).every((key) => key in scripts);
}

/** Returns the env file if the lines were added to it. */
export async function addEnvLines(
  cwd: string,
  plan: InitPlan,
  wroteClient: boolean,
  out: Reporter,
): Promise<string | undefined> {
  const { envFile } = plan;
  if (envFile === undefined) return undefined;
  const path = resolve(cwd, envFile);
  const lines = envLines({ source: plan.source, framework: plan.framework, client: wroteClient });
  const merged = mergeEnv(await readText(path), lines);
  if (merged.added.length > 0) {
    await writeFile(path, merged.text);
    out.report(`Added ${merged.added.join(", ")} to ${envFile}`);
  }
  if (merged.skipped.length > 0) out.warn(`${envFile} already sets ${merged.skipped.join(", ")}, left unchanged`);
  const gitignore = await readText(resolve(cwd, ".gitignore"));
  if (!isGitignored(gitignore ?? "", envFile)) {
    out.warn(`${envFile} isn't in .gitignore; add it before you put the schema token in it.`);
  }
  return envFile;
}
