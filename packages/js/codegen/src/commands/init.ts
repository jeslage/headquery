import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import * as util from "node:util";
import { cancel, intro, isCancel, log, note, outro, text } from "@clack/prompts";
import { defineCommand } from "citty";
import { findConfig, type SchemaSource } from "../config";
import {
  configFileName,
  initDefaults,
  initPrompts,
  parseSourceInput,
  renderConfig,
  renderNextSteps,
  type InitContext,
  type TextPrompt,
} from "../init";
import { guarded, ok, style } from "./shared";

async function readPackageJson(cwd: string): Promise<InitContext["packageJson"]> {
  try {
    return JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8")) as InitContext["packageJson"];
  } catch {
    return undefined;
  }
}

/** First `HEADQUERY_BASE_URL` in .env.local or .env, as a suggestion only (nothing is loaded). */
async function findDotenvBaseUrl(cwd: string): Promise<InitContext["dotenv"]> {
  // util.parseEnv needs Node ≥ 20.12; without it there's simply no suggestion.
  const parseEnv = (util as { parseEnv?: (content: string) => Record<string, string | undefined> }).parseEnv;
  if (!parseEnv) return undefined;
  for (const file of [".env.local", ".env"]) {
    try {
      const baseUrl = parseEnv(await readFile(resolve(cwd, file), "utf8")).HEADQUERY_BASE_URL;
      if (baseUrl) return { file, baseUrl };
    } catch {
      // missing or unreadable: try the next file
    }
  }
  return undefined;
}

/** Ask one question; Ctrl+C / Esc ends the command without writing anything. */
async function ask(prompt: TextPrompt, required: boolean): Promise<string> {
  const answer = await text({
    ...prompt,
    validate: (value) => (required && !value?.trim() ? "Required" : undefined),
  });
  if (isCancel(answer)) {
    cancel("Cancelled, nothing was written.");
    process.exit(1);
  }
  return (answer ?? "").trim();
}

const args = {
  "base-url": {
    type: "string",
    description: "CMS origin, e.g. https://cms.example.com (default: $HEADQUERY_BASE_URL, else from .env.local or .env)",
    valueHint: "url",
  },
  from: {
    type: "string",
    description: "Full schema endpoint URL or local schema JSON file instead of --base-url",
    valueHint: "url|file",
  },
  out: { type: "string", description: "Output .ts file (default: src/cms.generated.ts, lib/… or ./…)", valueHint: "file" },
  yes: {
    type: "boolean",
    alias: "y",
    description: "Don't ask; use flags and defaults (also when stdin isn't a terminal)",
    default: false,
  },
  force: { type: "boolean", description: "Overwrite an existing headquery.config file", default: false },
} as const;

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description:
      "Create a headquery.config file for this project. Only the config is written; package.json scripts and .env lines are printed.",
  },
  args,
  run: guarded("init", args, async ({ args }) => {
    const cwd = process.cwd();
    const existing = await findConfig(cwd);
    if (existing && !args.force) {
      throw new Error(`${basename(existing)} already exists (use --force to overwrite)`);
    }

    const packageJson = await readPackageJson(cwd);
    const dotenv = await findDotenvBaseUrl(cwd);
    const ctx: InitContext = {
      env: process.env,
      hasSrcDir: existsSync(resolve(cwd, "src")),
      hasLibDir: existsSync(resolve(cwd, "lib")),
      hasTsconfig: existsSync(resolve(cwd, "tsconfig.json")),
      ...(packageJson ? { packageJson } : {}),
      nodeStripsTypes: Boolean((process.features as { typescript?: unknown }).typescript),
      ...(dotenv ? { dotenv } : {}),
    };
    const defaults = initDefaults(ctx, { baseUrl: args["base-url"], from: args.from, out: args.out });

    let source: SchemaSource | undefined = defaults.source;
    let out = defaults.out;
    const interactive = !args.yes && process.stdin.isTTY === true && process.stdout.isTTY === true;

    if (interactive) {
      const prompts = initPrompts(defaults);
      intro(style(["bold", "cyan"], "headquery init"));
      log.info(prompts.intro);
      // Flags that were given explicitly aren't asked again.
      if (args["base-url"] === undefined && args.from === undefined) {
        source = parseSourceInput(await ask(prompts.source, true));
      }
      if (args.out === undefined) {
        out = (await ask(prompts.out, false)) || out;
      }
    }

    if (source === undefined) {
      throw new Error("pass --base-url or --from (or set HEADQUERY_BASE_URL)");
    }

    const file = configFileName(defaults.format);
    await writeFile(resolve(cwd, file), renderConfig({ source, out }));

    const deps = { ...packageJson?.dependencies, ...packageJson?.devDependencies };
    const steps = renderNextSteps({ source, out, hasCodegenDependency: "@headquery/codegen" in deps });
    const leftover =
      existing && basename(existing) !== file
        ? `${basename(existing)} still exists; remove it so ${file} is the only config.`
        : undefined;

    if (interactive) {
      log.success(`Wrote ${file}`);
      if (leftover) log.warn(leftover);
      note(steps, "Next steps");
      outro("Done");
    } else {
      ok(`wrote ${file}`);
      console.log(`\nNext steps:\n\n${steps}`);
      if (leftover) console.log(`\n${style("yellow", "!")} ${leftover}`);
    }
  }),
});
