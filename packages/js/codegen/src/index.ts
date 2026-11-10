import { assertIrSchema, type IrSchema } from "@headquery/schema";
import { generateStatamic } from "./statamic";

export {
  type CliFlags,
  CONFIG_FILES,
  DEFAULT_API_PREFIX,
  DEFAULT_SCHEMA_PATHS,
  defineConfig,
  findConfig,
  type HeadqueryConfig,
  loadConfig,
  type ResolvedOptions,
  resolveOptions,
  type SchemaEndpoint,
  type SchemaSource,
  schemaEndpointUrl,
} from "./config";
export { fieldType, generateStatamic, pascal, type StatamicGenerateOptions } from "./statamic";

export type Target = "statamic";

export interface GenerateOptions {
  /** Defaults to `schema.cms.name`. */
  target?: Target;
  moduleName?: string;
}

/** Validate an IR schema and generate a TypeScript module for the matching adapter. */
export function generate(input: unknown, options: GenerateOptions = {}): string {
  assertIrSchema(input);
  const schema: IrSchema = input;
  const target = options.target ?? (schema.cms.name as Target);
  switch (target) {
    case "statamic":
      return generateStatamic(schema, options.moduleName ? { moduleName: options.moduleName } : {});
    default:
      throw new Error(`headquery codegen: no generator for target "${target}"`);
  }
}

export interface LoadOptions {
  token?: string;
  fetch?: typeof fetch;
}

/** Load a schema from a URL (http/https) or a local JSON file. */
export async function loadSchema(from: string, options: LoadOptions = {}): Promise<unknown> {
  if (/^https?:\/\//i.test(from)) {
    const doFetch = options.fetch ?? globalThis.fetch;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    const res = await doFetch(from, { headers });
    if (!res.ok) throw new Error(`headquery codegen: ${from} responded ${res.status}`);
    return res.json();
  }
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(from, "utf8"));
}
