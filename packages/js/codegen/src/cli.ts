import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { generate, loadSchema, type Target } from "./index";

const HELP = `
headquery-codegen — generate TypeScript types from a CMS schema

Usage:
  headquery-codegen --from <url|file> --out <file> [options]

Options:
  --from     Schema source: http(s) URL of the schema endpoint, or a local JSON file
  --out      Output .ts file
  --token    Bearer token for the schema endpoint (default: $HEADQUERY_SCHEMA_TOKEN)
  --target   Adapter target (default: taken from the schema, e.g. "statamic")
  --module   Module to augment (default: @headquery/<target>)
  --check    Do not write; exit 1 if the output file is out of date (for CI)
  --help     Show this help
`.trim();

async function main() {
  const { values } = parseArgs({
    options: {
      from: { type: "string" },
      out: { type: "string" },
      token: { type: "string" },
      target: { type: "string" },
      module: { type: "string" },
      check: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help || !values.from || !values.out) {
    console.log(HELP);
    process.exit(values.help ? 0 : 1);
  }

  const token = values.token ?? process.env.HEADQUERY_SCHEMA_TOKEN;
  const schema = await loadSchema(values.from, token ? { token } : {});
  const code = generate(schema, {
    ...(values.target ? { target: values.target as Target } : {}),
    ...(values.module ? { moduleName: values.module } : {}),
  });

  if (values.check) {
    const current = await readFile(values.out, "utf8").catch(() => "");
    if (current !== code) {
      console.error(`✗ ${values.out} is out of date. Run headquery-codegen without --check.`);
      process.exit(1);
    }
    console.log(`✓ ${values.out} is up to date`);
    return;
  }

  await mkdir(dirname(values.out), { recursive: true });
  await writeFile(values.out, code);
  console.log(`✓ wrote ${values.out}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
