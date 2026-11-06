import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { findConfig, loadConfig, resolveOptions } from "../config";
import { generate, loadSchema } from "../index";

const HELP = `
headquery generate — generate TypeScript types from a CMS schema

Usage:
  headquery generate [options]                     # reads headquery.config.{ts,mts,mjs,js}
  headquery generate --from <url|file> --out <file> [options]
  headquery generate --base-url <cms origin> --out <file> [options]

Options:
  --config       Config file (default: headquery.config.{ts,mts,mjs,js} in the current directory)
  --from         Schema source: full http(s) URL of the schema endpoint, or a local JSON file
  --base-url     CMS origin instead of --from; the URL is <base-url><api-prefix><schema-path>
  --api-prefix   API prefix of the CMS (default: /api)
  --schema-path  Schema route below the API prefix (default for statamic: /headquery/schema)
  --out          Output .ts file
  --token        Bearer token for the schema endpoint (default: $HEADQUERY_SCHEMA_TOKEN)
  --target       Adapter target (default: taken from the schema, e.g. "statamic")
  --module       Module to augment (default: @headquery/<target>)
  --check        Do not write; exit 1 if the output file is out of date (for CI)
  --help         Show this help

Flags override values from the config file.
`.trim();

export async function generateCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      config: { type: "string" },
      from: { type: "string" },
      "base-url": { type: "string" },
      "api-prefix": { type: "string" },
      "schema-path": { type: "string" },
      out: { type: "string" },
      token: { type: "string" },
      target: { type: "string" },
      module: { type: "string" },
      check: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  // An explicit --config must exist; without it, a config file is optional.
  const configPath = values.config ? resolve(values.config) : await findConfig(process.cwd());
  const config = configPath ? { config: await loadConfig(configPath), path: configPath } : undefined;
  if (configPath) console.log(`using ${relative(process.cwd(), configPath) || configPath}`);

  const options = resolveOptions(
    {
      ...values,
      baseUrl: values["base-url"],
      apiPrefix: values["api-prefix"],
      schemaPath: values["schema-path"],
    },
    config,
    process.env,
  );
  if (!options.from || !options.out) {
    console.log(HELP);
    process.exit(1);
  }

  const schema = await loadSchema(options.from, options.token ? { token: options.token } : {});
  const code = generate(schema, {
    ...(options.target ? { target: options.target } : {}),
    ...(options.module ? { moduleName: options.module } : {}),
  });
  const out = options.out;
  const shown = relative(process.cwd(), out) || out;

  if (values.check) {
    const current = await readFile(out, "utf8").catch(() => "");
    if (current !== code) {
      console.error(`✗ ${shown} is out of date. Run \`headquery generate\` without --check.`);
      process.exit(1);
    }
    console.log(`✓ ${shown} is up to date`);
    return;
  }

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, code);
  console.log(`✓ wrote ${shown}`);
}
