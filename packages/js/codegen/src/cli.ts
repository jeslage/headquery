import { generateCommand } from "./commands/generate";
import { initCommand } from "./commands/init";

const HELP = `
headquery — typed SDKs for CMS REST APIs

Usage:
  headquery <command> [options]

Commands:
  init       Create a headquery.config file for this project (run once)
  generate   Generate TypeScript types from the CMS schema (use --check in CI)

Run \`headquery <command> --help\` for the command's options.
`.trim();

const commands: Record<string, (args: string[]) => Promise<void>> = {
  init: initCommand,
  generate: generateCommand,
};

async function main() {
  const [name, ...args] = process.argv.slice(2);
  if (name === "--help" || name === "-h") {
    console.log(HELP);
    return;
  }
  const command = name === undefined ? undefined : commands[name];
  if (!command) {
    if (name !== undefined) console.error(`unknown command "${name}"\n`);
    console.log(HELP);
    process.exit(1);
  }
  await command(args);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
