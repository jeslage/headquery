import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Target } from "./index";

/** A CMS to fetch the schema from; the endpoint URL is `baseUrl + apiPrefix + schemaPath`. */
export interface SchemaEndpoint {
  /** Origin of the CMS, e.g. `https://cms.example.com`. */
  baseUrl: string;
  /** The CMS's API prefix. Default: `/api` (same default as the client). */
  apiPrefix?: string;
  /** Path of the schema route below the API prefix. Default for Statamic: `/headquery/schema`. */
  schemaPath?: string;
}

/**
 * Where the schema comes from: a CMS endpoint (`{ baseUrl }`), a full http(s) URL, or a local
 * JSON file (relative to the config file).
 */
export type SchemaSource = string | SchemaEndpoint;

/** Configuration read from `headquery.config.{ts,mts,mjs,js}`. */
export interface HeadqueryConfig {
  /** Schema source: `{ baseUrl }` of the CMS, a full http(s) URL, or a JSON file. */
  from: SchemaSource;
  /** Output `.ts` file (relative to the config file). */
  out: string;
  /** Bearer token for the schema endpoint. Default: `$HEADQUERY_SCHEMA_TOKEN`. */
  token?: string;
  /** Adapter target. Default: taken from the schema (and `statamic` for the default `schemaPath`). */
  target?: Target;
  /** Module to augment. Default: `@headquery/<target>`. */
  module?: string;
}

/** Identity helper that gives a config file autocomplete and type checking. */
export function defineConfig(config: HeadqueryConfig): HeadqueryConfig {
  return config;
}

/** Config file names the CLI looks for, in order of precedence. */
export const CONFIG_FILES = [
  "headquery.config.ts",
  "headquery.config.mts",
  "headquery.config.mjs",
  "headquery.config.js",
] as const;

/** Default API prefix, matching `@headquery/core`'s client default. */
export const DEFAULT_API_PREFIX = "/api";

/** Default schema route per target (below the API prefix), as registered by the CMS plugin. */
export const DEFAULT_SCHEMA_PATHS: Record<Target, string> = {
  statamic: "/headquery/schema",
};

const isUrl = (value: string) => /^https?:\/\//i.test(value);
const segment = (value: string) => {
  const trimmed = value.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
};

/** Build the schema endpoint URL from `{ baseUrl, apiPrefix, schemaPath }`. */
export function schemaEndpointUrl(endpoint: SchemaEndpoint, target: Target = "statamic"): string {
  if (!isUrl(endpoint.baseUrl)) {
    throw new Error(`headquery codegen: baseUrl must be an http(s) URL, got "${endpoint.baseUrl}"`);
  }
  const schemaPath = endpoint.schemaPath ?? DEFAULT_SCHEMA_PATHS[target];
  if (schemaPath === undefined) {
    throw new Error(`headquery codegen: no default schemaPath for target "${target}"; set from.schemaPath`);
  }
  return (
    endpoint.baseUrl.replace(/\/+$/, "") + segment(endpoint.apiPrefix ?? DEFAULT_API_PREFIX) + segment(schemaPath)
  );
}

/** Return the absolute path of the first config file in `cwd`, if any. */
export async function findConfig(cwd: string): Promise<string | undefined> {
  for (const name of CONFIG_FILES) {
    const path = resolve(cwd, name);
    try {
      await access(path);
      return path;
    } catch {
      // try the next name
    }
  }
  return undefined;
}

/** Import a config file and validate its default export. */
export async function loadConfig(path: string): Promise<HeadqueryConfig> {
  const file = resolve(path);
  await access(file).catch(() => {
    throw new Error(`headquery codegen: config file not found: ${file}`);
  });
  let mod: { default?: unknown };
  try {
    mod = (await import(pathToFileURL(file).href)) as { default?: unknown };
  } catch (error) {
    if (/\.m?ts$/.test(file) && (error as { code?: string } | null)?.code === "ERR_UNKNOWN_FILE_EXTENSION") {
      throw new Error(
        `headquery codegen: Node ${process.version} can't load TypeScript config files natively (needs ≥ 22.18). ` +
          `Rename ${file} to headquery.config.mjs or upgrade Node.`,
      );
    }
    throw error;
  }
  return assertConfig(mod.default, file);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function assertConfig(value: unknown, file: string): HeadqueryConfig {
  const fail = (message: string): never => {
    throw new Error(`headquery codegen: invalid config in ${file}: ${message}`);
  };
  if (!isObject(value)) return fail("expected `export default defineConfig({ from, out })`");

  const from = value.from;
  if (isObject(from)) {
    if (typeof from.baseUrl !== "string" || !isUrl(from.baseUrl)) fail("`from.baseUrl` must be an http(s) URL");
    for (const key of ["apiPrefix", "schemaPath"] as const) {
      if (from[key] !== undefined && typeof from[key] !== "string") fail(`\`from.${key}\` must be a string`);
    }
  } else if (typeof from !== "string" || from === "") {
    fail("`from` must be a URL, a file path or `{ baseUrl }`");
  }
  if (typeof value.out !== "string" || value.out === "") fail("`out` must be a non-empty string");
  for (const key of ["token", "target", "module"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "string") fail(`\`${key}\` must be a string`);
  }
  return value as unknown as HeadqueryConfig;
}

export interface CliFlags {
  from?: string | undefined;
  baseUrl?: string | undefined;
  apiPrefix?: string | undefined;
  schemaPath?: string | undefined;
  out?: string | undefined;
  token?: string | undefined;
  target?: string | undefined;
  module?: string | undefined;
}

export interface ResolvedOptions {
  /** URL or file path, ready for `loadSchema()`. */
  from?: string;
  out?: string;
  token?: string;
  target?: Target;
  module?: string;
}

/**
 * Merge CLI flags, config and environment: flags > config > env/defaults.
 * Relative paths from the config resolve against its directory; flag paths stay as given (cwd).
 * `{ baseUrl, apiPrefix, schemaPath }` sources are turned into the endpoint URL.
 */
export function resolveOptions(
  flags: CliFlags,
  config: { config: HeadqueryConfig; path: string } | undefined,
  env: Record<string, string | undefined> = {},
): ResolvedOptions {
  const c = config?.config;
  const dir = config ? dirname(resolve(config.path)) : undefined;
  const target = (flags.target ?? c?.target) as Target | undefined;

  if (flags.from !== undefined && flags.baseUrl !== undefined) {
    throw new Error("headquery codegen: use either --from or --base-url, not both");
  }

  let from: string | undefined;
  if (flags.from !== undefined) {
    from = flags.from;
  } else {
    const endpoint = typeof c?.from === "object" ? c.from : undefined;
    const baseUrl = flags.baseUrl ?? endpoint?.baseUrl;
    if (baseUrl !== undefined) {
      const apiPrefix = flags.apiPrefix ?? endpoint?.apiPrefix;
      const schemaPath = flags.schemaPath ?? endpoint?.schemaPath;
      from = schemaEndpointUrl(
        {
          baseUrl,
          ...(apiPrefix !== undefined ? { apiPrefix } : {}),
          ...(schemaPath !== undefined ? { schemaPath } : {}),
        },
        target,
      );
    } else if (flags.apiPrefix !== undefined || flags.schemaPath !== undefined) {
      throw new Error("headquery codegen: --api-prefix and --schema-path need --base-url or `from: { baseUrl }`");
    } else if (typeof c?.from === "string") {
      from = isUrl(c.from) || dir === undefined ? c.from : resolve(dir, c.from);
    }
  }

  const out = flags.out ?? (c?.out !== undefined && dir !== undefined ? resolve(dir, c.out) : undefined);
  const token = flags.token ?? c?.token ?? (env.HEADQUERY_SCHEMA_TOKEN || undefined);
  const module = flags.module ?? c?.module;

  return {
    ...(from !== undefined ? { from } : {}),
    ...(out !== undefined ? { out } : {}),
    ...(token !== undefined ? { token } : {}),
    ...(target !== undefined ? { target } : {}),
    ...(module !== undefined ? { module } : {}),
  };
}
