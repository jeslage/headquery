// What's installed in the project: framework, CMS adapter, package manager.
import type { SchemaSource } from "../../config";
import type { Hint } from "../text";
import type { Framework, PackageJson, PackageManager } from "./types";

export const dependencies = (pkg: PackageJson | undefined) => ({ ...pkg?.dependencies, ...pkg?.devDependencies });

export const FRAMEWORKS: Record<Framework, string> = {
  next: "Next.js",
  nuxt: "Nuxt",
  vite: "Vite",
  node: "Node (or other)",
};

export const isFramework = (value: string): value is Framework => Object.hasOwn(FRAMEWORKS, value);

/** Framework from package.json dependencies, if one is recognised. */
export function detectFramework(pkg: PackageJson | undefined): Framework | undefined {
  const deps = dependencies(pkg);
  // Nuxt and many Next setups also depend on vite, so check the frameworks first.
  return "next" in deps ? "next" : "nuxt" in deps ? "nuxt" : "vite" in deps ? "vite" : undefined;
}

/** CMS adapter packages and the client factory they export. */
export interface AdapterInfo {
  factory: string;
  /** Name of the CMS, for the next steps. */
  cms: string;
  /** What to set up on the CMS, for the next steps. */
  cmsSetup: (source: SchemaSource) => Hint;
}

export const ADAPTERS = {
  "@headquery/statamic": {
    factory: "createStatamicClient",
    cms: "Statamic",
    cmsSetup: (source) => [
      "The REST API is a Statamic Pro feature and off by default. Add to the CMS's .env:",
      "$ STATAMIC_PRO_ENABLED=true",
      "$ STATAMIC_API_ENABLED=true",
      ...(typeof source === "string"
        ? []
        : ["$ HEADQUERY_SCHEMA_ROUTE=true", "$ HEADQUERY_SCHEMA_TOKEN=<a long random token>"]),
      "Enable the resources you query (and their allowed_filters) in config/statamic/api.php, then clear the config cache:",
      "$ php artisan config:clear",
      ...(typeof source === "string" ? ["Export the schema:", `$ php please headquery:schema --out=${source}`] : []),
    ],
  },
} satisfies Record<string, AdapterInfo>;

export type Adapter = keyof typeof ADAPTERS;

/** First installed adapter package, if any. */
export function detectAdapter(pkg: PackageJson | undefined): Adapter | undefined {
  const deps = dependencies(pkg);
  return (Object.keys(ADAPTERS) as Adapter[]).find((name) => name in deps);
}

/** Package manager from package.json's `packageManager` field or a lockfile; npm otherwise. */
export function detectPackageManager(pkg: PackageJson | undefined, lockfiles: string[] = []): PackageManager {
  const field = pkg?.packageManager?.split("@")[0];
  if (field === "pnpm" || field === "yarn" || field === "bun" || field === "npm") return field;
  if (lockfiles.includes("pnpm-lock.yaml")) return "pnpm";
  if (lockfiles.includes("yarn.lock")) return "yarn";
  if (lockfiles.includes("bun.lock") || lockfiles.includes("bun.lockb")) return "bun";
  return "npm";
}
