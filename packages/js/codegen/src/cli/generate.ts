import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { defineCommand } from "citty";
import { findConfig, loadConfig, type ResolvedOptions, resolveOptions } from "../config";
import { generate, type Target } from "../generate";
import { loadSchema, SchemaLoadError } from "../load";
import { guarded } from "./guarded";
import { fail, link, ok, style } from "./output";
import { formatLoadError } from "./troubleshoot";

const args = {
  config: {
    type: "string",
    description: "Config file (default: headquery.config.{ts,mts,mjs,js} in the current directory)",
    valueHint: "file",
  },
  from: {
    type: "string",
    description: "Schema source: full http(s) URL of the schema endpoint, or a local JSON file",
    valueHint: "url|file",
  },
  "base-url": {
    type: "string",
    description: "CMS origin instead of --from; fetches <base-url><api-prefix><schema-path>",
    valueHint: "url",
  },
  "api-prefix": { type: "string", description: "API prefix of the CMS (default: /api)", valueHint: "path" },
  "schema-path": {
    type: "string",
    description: "Schema route below the API prefix (default for statamic: /headquery/schema)",
    valueHint: "path",
  },
  out: { type: "string", description: "Output .ts file", valueHint: "file" },
  token: {
    type: "string",
    description: "Bearer token for the schema endpoint (default: $HEADQUERY_SCHEMA_TOKEN)",
  },
  target: { type: "string", description: 'Adapter target (default: taken from the schema, e.g. "statamic")' },
  module: { type: "string", description: "Module to augment (default: @headquery/<target>)" },
  check: {
    type: "boolean",
    description: "Don't write; exit 1 if the output file is out of date (for CI)",
    default: false,
  },
} as const;

const shown = (path: string) => relative(process.cwd(), path) || path;

export const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate TypeScript types from the CMS schema. Reads headquery.config.*; flags override it.",
  },
  args,
  run: guarded("generate", args, async ({ args }) => {
    // An explicit --config must exist; without it, a config file is optional.
    const configPath = args.config ? resolve(args.config) : await findConfig(process.cwd());
    const config = configPath ? { config: await loadConfig(configPath), path: configPath } : undefined;
    if (configPath) console.log(style("dim", `using ${shown(configPath)}`));

    const options = resolveOptions(
      {
        from: args.from,
        baseUrl: args["base-url"],
        apiPrefix: args["api-prefix"],
        schemaPath: args["schema-path"],
        out: args.out,
        token: args.token,
        target: args.target,
        module: args.module,
      },
      config,
      process.env,
    );
    const { from, out } = options;
    if (!from || !out) {
      throw new Error(
        "no schema source or output file. Run `headquery init` to create a config, or pass --base-url/--from and --out.",
      );
    }

    const schema = await loadOrExplain(from, options);
    const code = generate(schema, {
      ...(options.target ? { target: options.target } : {}),
      ...(options.module ? { moduleName: options.module } : {}),
    });

    if (args.check) {
      const current = await readFile(out, "utf8").catch(() => "");
      if (current !== code) {
        fail(`${shown(out)} is out of date. Run \`headquery generate\` without --check.`);
        process.exit(1);
      }
      ok(`${shown(out)} is up to date`);
      return;
    }

    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, code);
    ok(`wrote ${shown(out)}`);
  }),
});

/** Load the schema; if that fails, print the troubleshooting report and exit 1. */
async function loadOrExplain(from: string, options: ResolvedOptions): Promise<unknown> {
  try {
    return await loadSchema(from, options.token ? { token: options.token } : {});
  } catch (error) {
    if (!(error instanceof SchemaLoadError)) throw error;
    // statamic is the only target so far, and the default when the schema decides.
    const target: Target = options.target ?? "statamic";
    const report = formatLoadError(error, target, {
      width: process.stderr.columns,
      style: (format, text) => style(format, text, process.stderr),
      link: (url) => link(url, process.stderr),
    });
    // A blank line after the report keeps it apart from the next prompt.
    console.error(`${report}\n`);
    process.exit(1);
  }
}
