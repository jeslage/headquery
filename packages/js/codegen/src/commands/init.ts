import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { findConfig } from "../config";
import {
  configFileName,
  initDefaults,
  parseSourceInput,
  renderConfig,
  renderNextSteps,
  type InitContext,
} from "../init";

const HELP = `
headquery init — create a headquery.config file in the current directory

Usage:
  headquery init                      # asks for the CMS URL and the output file
  headquery init --yes --base-url <cms origin> [--out <file>]

Options:
  --base-url   CMS origin, e.g. https://cms.example.com (default: $HEADQUERY_BASE_URL)
  --from       Full schema endpoint URL or local schema JSON file instead of --base-url
  --out        Output .ts file (default: src/cms.generated.ts, lib/… or ./…)
  --yes        Don't ask; use flags and defaults (also when stdin isn't a terminal)
  --force      Overwrite an existing headquery.config file
  --help       Show this help

Nothing besides the config file is written; package.json scripts and .env lines are printed.
`.trim();

async function readPackageJson(cwd: string): Promise<InitContext["packageJson"]> {
  try {
    return JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8")) as InitContext["packageJson"];
  } catch {
    return undefined;
  }
}

export async function initCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      "base-url": { type: "string" },
      from: { type: "string" },
      out: { type: "string" },
      yes: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }

  const cwd = process.cwd();
  const existing = await findConfig(cwd);
  if (existing && !values.force) {
    throw new Error(`headquery init: ${basename(existing)} already exists (use --force to overwrite)`);
  }

  const packageJson = await readPackageJson(cwd);
  const ctx: InitContext = {
    env: process.env,
    hasSrcDir: existsSync(resolve(cwd, "src")),
    hasLibDir: existsSync(resolve(cwd, "lib")),
    hasTsconfig: existsSync(resolve(cwd, "tsconfig.json")),
    ...(packageJson ? { packageJson } : {}),
    nodeStripsTypes: Boolean((process.features as { typescript?: unknown }).typescript),
  };
  const defaults = initDefaults(ctx, { baseUrl: values["base-url"], from: values.from, out: values.out });

  let source = defaults.source;
  let out = defaults.out;
  const interactive = !values.yes && process.stdin.isTTY === true;

  if (interactive) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const shown = source === undefined ? "" : typeof source === "string" ? source : source.baseUrl;
      // Flags that were given explicitly aren't asked again.
      if (values["base-url"] === undefined && values.from === undefined) {
        for (;;) {
          const answer = (await rl.question(`Base URL of your CMS (or path to a schema JSON file)${shown ? ` (${shown})` : ""}: `)).trim();
          if (answer) {
            source = parseSourceInput(answer);
            break;
          }
          if (source !== undefined) break;
        }
      }
      if (values.out === undefined) {
        out = (await rl.question(`Output file (${out}): `)).trim() || out;
      }
    } finally {
      rl.close();
    }
  }

  if (source === undefined) {
    throw new Error("headquery init: pass --base-url or --from (or set HEADQUERY_BASE_URL)");
  }

  const file = configFileName(defaults.format);
  await writeFile(resolve(cwd, file), renderConfig({ source, out }));

  const deps = { ...packageJson?.dependencies, ...packageJson?.devDependencies };
  console.log(
    renderNextSteps({ source, out, configFile: file, hasCodegenDependency: "@headquery/codegen" in deps }),
  );
  if (existing && basename(existing) !== file) {
    console.log(`\n! ${basename(existing)} still exists; remove it so ${file} is the only config.`);
  }
}
