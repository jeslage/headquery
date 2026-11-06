import { defineCommand, runMain } from "citty";
import pkg from "../package.json";
import { generateCommand } from "./commands/generate";
import { initCommand } from "./commands/init";

const main = defineCommand({
  meta: {
    name: "headquery",
    version: pkg.version,
    description: "Generate TypeScript types for headquery clients from your CMS schema",
  },
  subCommands: {
    init: initCommand,
    generate: generateCommand,
  },
});

void runMain(main);
