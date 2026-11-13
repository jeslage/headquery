import { basename } from "node:path";
import { outro } from "@clack/prompts";
import { defineCommand } from "citty";

import { guarded } from "../guarded";
import { style } from "../output";
import { args } from "./args";
import { dependencies, detectPackageManager } from "./detect";
import { renderNextSteps } from "./next-steps";
import { flagGiven, planInit } from "./plan";
import { readProject } from "./project";
import { addEnvLines, addScripts, createReporter, writeClientFile, writeConfigFile } from "./steps";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description:
      "Set up headquery: writes headquery.config, a client file, package.json scripts and env lines (each optional).",
  },
  args,
  run: guarded("init", args, async ({ args, rawArgs }) => {
    const cwd = process.cwd();
    const project = await readProject(cwd);

    if (project.existingConfig && !args.force) {
      throw new Error(`${basename(project.existingConfig)} already exists (use --force to overwrite)`);
    }

    const interactive = !args.yes && process.stdin.isTTY === true && process.stdout.isTTY === true;
    const plan = await planInit(project, args, { interactive, given: flagGiven(rawArgs) });

    const out = createReporter(interactive);
    await writeConfigFile(cwd, plan, project, out);
    const client = await writeClientFile(cwd, plan, { force: args.force, interactive }, out);
    const scripts = await addScripts(cwd, plan, project, out);
    const envFile = await addEnvLines(cwd, plan, client !== undefined, out);

    const { packageJson, lockfiles } = project.ctx;

    const steps = renderNextSteps(
      {
        source: plan.source,
        out: plan.out,
        hasCodegenDependency: "@headquery/codegen" in dependencies(packageJson),
        packageManager: detectPackageManager(packageJson, lockfiles),
        framework: plan.framework,
        client,
        scripts,
        envFile,
        adapter: plan.adapter,
      },
      { width: process.stdout.columns, style: (format, text) => style(format, text) },
    );

    // Plain text, no box around it, so commands can be copied as they are.
    if (interactive) outro("Done");
    console.log(`\n${style("bold", "Next steps")}\n\n${steps}\n`);
  }),
});
