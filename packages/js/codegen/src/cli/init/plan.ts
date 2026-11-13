// Decides what `init` will do: from flags and defaults, and from the answers when interactive.
import { intro, log } from "@clack/prompts";
import type { SchemaSource } from "../../config";
import { style } from "../output";
import { ask, choose, yesNo } from "../prompts";
import type { InitArgs } from "./args";
import { configFileName, defaultEnvFile, initDefaults, initPrompts, parseSourceInput } from "./defaults";
import { type Adapter, detectAdapter, FRAMEWORKS } from "./detect";
import type { Project } from "./project";
import { clientPath } from "./templates";
import type { Framework, InitDefaults } from "./types";

export interface InitPlan {
  source: SchemaSource;
  out: string;
  configFile: string;
  framework: Framework;
  adapter?: Adapter;
  /** Client file to create, if wanted. */
  client?: string;
  /** Whether to add the cms:types scripts to package.json. */
  scripts: boolean;
  /** Env file to add the HEADQUERY_* lines to, if wanted. */
  envFile?: string;
}

export interface PlanOptions {
  interactive: boolean;
  /** Whether a flag was passed explicitly (incl. --no-x); those aren't asked again. */
  given: (name: string) => boolean;
}

export async function planInit(project: Project, args: InitArgs, options: PlanOptions): Promise<InitPlan> {
  const { ctx } = project;
  const { interactive, given } = options;
  const defaults = initDefaults(ctx, {
    baseUrl: args["base-url"],
    from: args.from,
    out: args.out,
    framework: args.framework,
  });
  const adapter = detectAdapter(ctx.packageJson);

  let { source, out, framework } = defaults;
  let wantClient = args.client && adapter !== undefined;
  let wantScripts = args.scripts && project.packageJsonText !== undefined;
  let wantEnv = args.env;
  let envFile = args["env-file"] ?? ctx.envFiles?.[0];

  // 1. Where the schema comes from and where the types go.
  if (interactive) {
    const prompts = initPrompts(defaults);
    intro(style(["bold", "cyan"], "headquery init"));
    log.info(prompts.intro);
    if (!given("base-url") && !given("from")) source = parseSourceInput(await ask(prompts.source, true));
    if (!given("out")) out = (await ask(prompts.out, false)) || out;
  }
  if (source === undefined) throw new Error("pass --base-url or --from (or set HEADQUERY_BASE_URL)");
  // Env lines only make sense for a CMS base URL.
  wantEnv &&= typeof source !== "string";
  const client = clientPath(out);

  // 2. What else to set up.
  if (interactive) {
    if (!given("client")) {
      if (adapter === undefined) {
        log.info("No headquery adapter (e.g. @headquery/statamic) in package.json, so no client file is created.");
      } else {
        wantClient = await yesNo(`Create ${client} with a typed ${adapter} client?`);
      }
    }
    // The framework only decides how the client and env lines read the base URL.
    if ((wantClient || wantEnv) && !given("framework")) framework = await askFramework(framework, defaults);
    if (wantScripts && !given("scripts")) {
      wantScripts = await yesNo(`Add cms:types and cms:types:check scripts to package.json?`);
    }
    if (wantEnv && !given("env")) {
      wantEnv = await yesNo(envFile ? `Add HEADQUERY_* lines to ${envFile}?` : "Add HEADQUERY_* lines to an env file?");
    }
    if (wantEnv && envFile === undefined) {
      const initialValue = defaultEnvFile(framework);
      envFile = await ask(
        { message: "No .env.local or .env found. Name of the env file to create", initialValue },
        true,
      );
    }
  }

  return {
    source,
    out,
    configFile: configFileName(defaults.format),
    framework,
    ...(adapter ? { adapter } : {}),
    ...(wantClient ? { client } : {}),
    scripts: wantScripts,
    ...(wantEnv ? { envFile: envFile ?? defaultEnvFile(framework) } : {}),
  };
}

const askFramework = (current: Framework, defaults: InitDefaults) =>
  choose(
    "Framework (decides how the client reads the base URL from env)",
    current,
    (Object.entries(FRAMEWORKS) as [Framework, string][]).map(([value, label]) => ({
      value,
      label,
      ...(value === defaults.framework ? { hint: defaults.frameworkOrigin } : {}),
    })),
  );

/** `given` for raw CLI args. */
export const flagGiven = (rawArgs: string[]) => (name: string) =>
  rawArgs.some((raw) => new RegExp(`^--(no-)?${name}(=|$)`).test(raw));
