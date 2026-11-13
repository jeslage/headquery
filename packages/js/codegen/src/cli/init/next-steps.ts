// The "Next steps" printed after `init`: only what `init` didn't do itself.
import type { SchemaSource } from "../../config";
import type { Style } from "../output";
import { type Hint, renderHint } from "../text";
import { ADAPTERS, type Adapter } from "./detect";
import { envLines, SCRIPTS } from "./merge";
import type { Framework, PackageManager } from "./types";

const pmCommands: Record<PackageManager, { addDev: string; run: string; exec: string }> = {
  npm: { addDev: "npm install -D", run: "npm run", exec: "npx" },
  pnpm: { addDev: "pnpm add -D", run: "pnpm", exec: "pnpm exec" },
  yarn: { addDev: "yarn add -D", run: "yarn", exec: "yarn" },
  bun: { addDev: "bun add -d", run: "bun run", exec: "bunx" },
};

export interface NextStepsInput {
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
}

interface Step {
  title: string;
  body: Hint;
}

/** The steps that are left, as titles with a hint each. */
export function nextSteps(answers: NextStepsInput): Step[] {
  const pm = pmCommands[answers.packageManager ?? "npm"];
  const steps: Step[] = [];
  const step = (title: string, ...body: string[]) => steps.push({ title, body });

  if (!answers.hasCodegenDependency) {
    step("Install the CLI", `$ ${pm.addDev} @headquery/codegen`);
  }
  if (!answers.scripts) {
    const entries = Object.entries(SCRIPTS);
    step(
      "Add scripts to package.json",
      ...entries.map(([key, value], i) => `$ "${key}": "${value}"${i < entries.length - 1 ? "," : ""}`),
    );
  }
  if (answers.adapter) {
    const adapter = ADAPTERS[answers.adapter];
    step(`Set up ${adapter.cms}`, ...adapter.cmsSetup(answers.source));
  }
  if (typeof answers.source !== "string") {
    if (answers.envFile) {
      step(
        "Add the schema token",
        `Set HEADQUERY_SCHEMA_TOKEN in ${answers.envFile} to the token from the CMS's .env. In CI, set HEADQUERY_BASE_URL and HEADQUERY_SCHEMA_TOKEN as env vars.`,
      );
    } else {
      const lines = envLines({
        source: answers.source,
        framework: answers.framework ?? "node",
        client: Boolean(answers.client),
      });
      step("Set the env vars", "e.g. in .env.local and in CI:", ...lines.map((line) => `$ ${line}`));
    }
  }
  step("Generate the types", `$ ${answers.scripts ? `${pm.run} cms:types` : `${pm.exec} headquery generate`}`);
  step(
    "Start querying",
    answers.client
      ? `Import \`cms\` from ${answers.client}.`
      : `Import ${answers.out} once where you create the client.`,
  );
  return steps;
}

/** Next steps for the terminal (without a heading): bold titles, wrapped text, commands in cyan. */
export function renderNextSteps(answers: NextStepsInput, options: { width?: number; style?: Style } = {}): string {
  const width = Math.max(60, Math.min(options.width ?? 100, 110));
  const style: Style = options.style ?? ((_, text) => text);
  return nextSteps(answers)
    .map(({ title, body }, i) => {
      const heading = `  ${style("dim", `${i + 1}.`)} ${style("bold", title)}`;
      const lines = renderHint(body, {
        width,
        textIndent: "     ",
        codeIndent: "       ",
        codeStyle: (code) => style("cyan", code),
      });
      return [heading, ...lines].join("\n");
    })
    .join("\n\n");
}
