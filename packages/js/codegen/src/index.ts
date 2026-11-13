// Public API of @headquery/codegen. The CLI lives in ./cli and is bundled separately (dist/cli.js).
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
export { type GenerateOptions, generate, type Target } from "./generate";
export { type LoadOptions, loadSchema, SchemaLoadError } from "./load";
export { fieldType, generateStatamic, pascal, type StatamicGenerateOptions } from "./statamic";
