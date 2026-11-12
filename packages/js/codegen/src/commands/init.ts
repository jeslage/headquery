import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import * as util from "node:util";
import { cancel, confirm, intro, isCancel, log, outro, select, text } from "@clack/prompts";
import { defineCommand } from "citty";
import { findConfig, type SchemaSource } from "../config";
import {
  configFileName,
  clientPath as defaultClientPath,
  defaultEnvFile,
  detectAdapter,
  detectPackageManager,
  envLines,
  FRAMEWORKS,
  type Framework,
  type InitContext,
  initDefaults,
  initPrompts,
  isGitignored,
  mergeEnv,
  mergeScripts,
  parseSourceInput,
  renderClient,
  renderConfig,
  renderNextSteps,
  SCRIPTS,
  type TextPrompt,
} from "../init";
import { guarded, ok, style } from "./shared";

const readText = (path: string) => readFile(path, "utf8").catch(() => undefined);

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

/** Ctrl+C / Esc ends the command; files written before that stay. */
function orExit<T>(answer: T): Exclude<T, symbol> {
  if (isCancel(answer)) {
    cancel("Cancelled.");
    process.exit(1);
  }
  return answer as Exclude<T, symbol>;
}

/** Ask one question. */
async function ask(prompt: TextPrompt, required: boolean): Promise<string> {
  const answer = orExit(
    await text({ ...prompt, validate: (value) => (required && !value?.trim() ? "Required" : undefined) }),
  );
  return (answer ?? "").trim();
}

const yesNo = async (message: string, initialValue = true) => orExit(await confirm({ message, initialValue }));

const args = {
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
} as const;

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description:
      "Set up headquery: writes headquery.config, a client file, package.json scripts and env lines (each optional).",
  },
  args,
  run: guarded("init", args, async ({ args, rawArgs }) => {
    const cwd = process.cwd();
    const existing = await findConfig(cwd);
    if (existing && !args.force) {
      throw new Error(`${basename(existing)} already exists (use --force to overwrite)`);
    }
    // Flags given explicitly (incl. --no-x) aren't asked again.
    const given = (name: string) => rawArgs.some((raw) => new RegExp(`^--(no-)?${name}(=|$)`).test(raw));

    const packageJsonText = await readText(resolve(cwd, "package.json"));
    let packageJson: InitContext["packageJson"];
    try {
      packageJson = packageJsonText === undefined ? undefined : JSON.parse(packageJsonText);
    } catch {
      packageJson = undefined;
    }
    const envFiles = [".env.local", ".env"].filter((file) => existsSync(resolve(cwd, file)));
    const lockfiles = ["pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "package-lock.json"].filter((file) =>
      existsSync(resolve(cwd, file)),
    );
    const dotenv = await findDotenvBaseUrl(cwd, envFiles);
    const ctx: InitContext = {
      env: process.env,
      hasSrcDir: existsSync(resolve(cwd, "src")),
      hasLibDir: existsSync(resolve(cwd, "lib")),
      hasTsconfig: existsSync(resolve(cwd, "tsconfig.json")),
      ...(packageJson ? { packageJson } : {}),
      nodeStripsTypes: Boolean((process.features as { typescript?: unknown }).typescript),
      ...(dotenv ? { dotenv } : {}),
      envFiles,
      lockfiles,
    };
    const defaults = initDefaults(ctx, {
      baseUrl: args["base-url"],
      from: args.from,
      out: args.out,
      framework: args.framework,
    });
    const adapter = detectAdapter(packageJson);

    let source: SchemaSource | undefined = defaults.source;
    let out = defaults.out;
    let framework: Framework = defaults.framework;
    let wantClient = args.client && adapter !== undefined;
    let wantScripts = args.scripts && packageJsonText !== undefined && packageJson !== undefined;
    let wantEnv = args.env;
    let envFile = args["env-file"] ?? envFiles[0];
    const interactive = !args.yes && process.stdin.isTTY === true && process.stdout.isTTY === true;

    if (interactive) {
      const prompts = initPrompts(defaults);
      intro(style(["bold", "cyan"], "headquery init"));
      log.info(prompts.intro);
      if (!given("base-url") && !given("from")) {
        source = parseSourceInput(await ask(prompts.source, true));
      }
      if (!given("out")) {
        out = (await ask(prompts.out, false)) || out;
      }
    }
    if (source === undefined) {
      throw new Error("pass --base-url or --from (or set HEADQUERY_BASE_URL)");
    }
    const hasBaseUrl = typeof source !== "string";
    wantEnv &&= hasBaseUrl;
    const client = defaultClientPath(out);

    if (interactive) {
      if (adapter === undefined && !given("client")) {
        log.info("No headquery adapter (e.g. @headquery/statamic) in package.json, so no client file is created.");
      } else if (adapter !== undefined && !given("client")) {
        wantClient = await yesNo(`Create ${client} with a typed ${adapter} client?`);
      }
      // The framework only decides how the client and env lines read the base URL.
      if ((wantClient || wantEnv) && !given("framework")) {
        framework = orExit(
          await select({
            message: "Framework (decides how the client reads the base URL from env)",
            initialValue: framework,
            options: (Object.entries(FRAMEWORKS) as [Framework, string][]).map(([value, label]) => ({
              value,
              label,
              ...(value === defaults.framework ? { hint: defaults.frameworkOrigin } : {}),
            })),
          }),
        );
      }
      if (wantScripts && !given("scripts")) {
        wantScripts = await yesNo(`Add cms:types and cms:types:check scripts to package.json?`);
      }
      if (wantEnv && !given("env")) {
        wantEnv = await yesNo(
          envFile ? `Add HEADQUERY_* lines to ${envFile}?` : "Add HEADQUERY_* lines to an env file?",
        );
      }
      if (wantEnv && envFile === undefined) {
        envFile = await ask(
          {
            message: "No .env.local or .env found. Name of the env file to create",
            initialValue: defaultEnvFile(framework),
          },
          true,
        );
      }
    }
    envFile ??= defaultEnvFile(framework);

    const report = (message: string) => (interactive ? log.success(message) : ok(message));
    const warn = (message: string) =>
      interactive ? log.warn(message) : console.log(`${style("yellow", "!")} ${message}`);

    // 1. config
    const file = configFileName(defaults.format);
    await writeFile(resolve(cwd, file), renderConfig({ source, out, ...(wantEnv ? { envFile } : {}) }));
    report(`Wrote ${file}`);
    if (existing && basename(existing) !== file) {
      warn(`${basename(existing)} still exists; remove it so ${file} is the only config.`);
    }

    // 2. client
    let wroteClient: string | undefined;
    if (wantClient && adapter !== undefined) {
      const path = resolve(cwd, client);
      let write = !existsSync(path) || args.force;
      if (!write && interactive) write = await yesNo(`${client} already exists. Overwrite it?`, false);
      if (write) {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, renderClient({ adapter, framework, source, clientPath: client, out }));
        report(`Wrote ${client}`);
        wroteClient = client;
      } else {
        warn(`${client} already exists, left unchanged (use --force to overwrite)`);
      }
    }

    // 3. package.json scripts
    let scripts = packageJson?.scripts ?? {};
    if (wantScripts && packageJsonText !== undefined) {
      const merged = mergeScripts(packageJsonText);
      if (merged.added.length > 0) {
        await writeFile(resolve(cwd, "package.json"), merged.text);
        report(`Added ${merged.added.join(", ")} to package.json scripts`);
        scripts = { ...scripts, ...Object.fromEntries(merged.added.map((key) => [key, SCRIPTS[key]!])) };
      }
      for (const key of merged.skipped) {
        warn(`package.json already has a "${key}" script (${JSON.stringify(scripts[key])}), left unchanged`);
      }
    }
    // Scripts that exist under our names count as done, whoever wrote them.
    const hasScripts = Object.keys(SCRIPTS).every((key) => key in scripts);

    // 4. env file
    let wroteEnv: string | undefined;
    if (wantEnv) {
      const path = resolve(cwd, envFile);
      const merged = mergeEnv(await readText(path), envLines({ source, framework, client: wroteClient !== undefined }));
      if (merged.added.length > 0) {
        await writeFile(path, merged.text);
        report(`Added ${merged.added.join(", ")} to ${envFile}`);
      }
      if (merged.skipped.length > 0) warn(`${envFile} already sets ${merged.skipped.join(", ")}, left unchanged`);
      wroteEnv = envFile;
      const gitignore = await readText(resolve(cwd, ".gitignore"));
      if (!isGitignored(gitignore ?? "", envFile)) {
        warn(`${envFile} isn't in .gitignore; add it before you put the schema token in it.`);
      }
    }

    const deps = { ...packageJson?.dependencies, ...packageJson?.devDependencies };
    const steps = renderNextSteps({
      source,
      out,
      hasCodegenDependency: "@headquery/codegen" in deps,
      packageManager: detectPackageManager(packageJson, lockfiles),
      framework,
      client: wroteClient,
      scripts: hasScripts,
      envFile: wroteEnv,
      adapter,
    });

    // Plain text, no box around it, so commands can be copied as they are.
    if (interactive) outro("Done");
    console.log(`\n${style("bold", "Next steps")}\n\n${steps}\n`);
  }),
});
