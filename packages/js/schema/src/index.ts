/**
 * headquery intermediate schema (IR).
 *
 * CMS plugins export their content model in this CMS-neutral shape (via CLI or the
 * schema endpoint); `@headquery/codegen` turns it into TypeScript types.
 *
 * The JSON Schema in `spec/ir/schema-v1.json` is the cross-language contract.
 * Any change here must be mirrored there, in the PHP exporters and in the fixtures.
 */

export const SCHEMA_VERSION = 1 as const;

export interface IrSchema {
  schemaVersion: typeof SCHEMA_VERSION;
  cms: { name: string; version?: string };
  generatedAt?: string;
  /**
   * Sites keyed by handle, in the CMS's order (the first is the default site). Single-site
   * installs export their one site. Absent in schemas exported before sites were added.
   */
  sites?: Record<string, IrSite>;
  /** Resources grouped by kind, each keyed by handle. Handles only need to be unique within a kind. */
  resources: IrResources;
}

export interface IrSite {
  name?: string;
  /** The site's locale as configured in the CMS, e.g. `en_US`. */
  locale?: string;
}

export interface IrResources {
  collection?: Record<string, IrResource>;
  taxonomy?: Record<string, IrResource>;
  global?: Record<string, IrResource>;
  navigation?: Record<string, IrNavigation>;
  assetContainer?: Record<string, IrResource>;
}

export type IrResourceKind = keyof IrResources;

export const IR_RESOURCE_KINDS: readonly IrResourceKind[] = [
  "collection",
  "taxonomy",
  "global",
  "navigation",
  "assetContainer",
];

export interface IrResource {
  /** Human-readable title from the CMS. */
  title?: string;
  /** Fields keyed by handle. For collections this is the union of all entry blueprints. */
  fields: Record<string, IrField>;
  /**
   * Handles that may be used in API filters but are not blueprint fields, e.g. system fields
   * like `date` or an asset's `basename`. Blueprint fields carry `filterable` instead.
   */
  systemFilters?: string[];
  /**
   * Set for collections whose entries form a page tree (Statamic: structured collections),
   * which can be fetched as a whole via the collection's tree endpoint.
   */
  structure?: IrStructure;
}

export interface IrStructure {
  maxDepth?: number;
  /** The first page is the root (home) page. */
  expectsRoot?: boolean;
}

/** A navigation tree. `fields` are the navigation blueprint's fields, present on every page. */
export interface IrNavigation extends Omit<IrResource, "systemFilters" | "structure"> {
  /** Handles of collections whose entries can be linked as pages. */
  collections?: string[];
  maxDepth?: number;
}

interface IrFieldBase {
  required?: boolean;
  /** Field may be used in API filters (Statamic: listed in `allowed_filters`). */
  filterable?: boolean;
  /** Original CMS field type, kept for debugging and custom mappings. */
  cmsType?: string;
  description?: string;
}

export type IrField =
  | (IrFieldBase & { type: "string" })
  | (IrFieldBase & { type: "number"; integer?: boolean })
  | (IrFieldBase & { type: "boolean" })
  | (IrFieldBase & { type: "date"; withTime?: boolean })
  | (IrFieldBase & { type: "enum"; values: string[]; multiple?: boolean })
  | (IrFieldBase & { type: "array"; items: IrField })
  | (IrFieldBase & { type: "object"; fields: Record<string, IrField> })
  | (IrFieldBase & { type: "relation"; to: IrRelationTarget; resources?: string[]; multiple?: boolean })
  | (IrFieldBase & { type: "asset"; multiple?: boolean })
  | (IrFieldBase & { type: "richtext" })
  | (IrFieldBase & { type: "blocks"; sets: Record<string, Record<string, IrField>> })
  | (IrFieldBase & { type: "unknown" });

export type IrRelationTarget = "entry" | "term" | "user" | "asset";

export type IrFieldType = IrField["type"];

export class IrSchemaError extends Error {
  override readonly name = "IrSchemaError";
}

/**
 * Light structural validation. Throws IrSchemaError with a useful message.
 * Intentionally dependency-free; the full contract lives in spec/ir/schema-v1.json.
 */
export function assertIrSchema(input: unknown): asserts input is IrSchema {
  if (!isObject(input)) throw new IrSchemaError("Schema must be a JSON object");
  if (input.schemaVersion !== SCHEMA_VERSION) {
    throw new IrSchemaError(
      `Unsupported schemaVersion ${String(input.schemaVersion)}; this version of headquery understands ${SCHEMA_VERSION}`,
    );
  }
  if (!isObject(input.cms) || typeof input.cms.name !== "string") {
    throw new IrSchemaError("Schema is missing cms.name");
  }
  if (input.sites !== undefined) {
    if (!isObject(input.sites)) throw new IrSchemaError("sites must be an object of handle → site");
    for (const [handle, site] of Object.entries(input.sites)) {
      if (!isObject(site)) throw new IrSchemaError(`Site "${handle}" must be an object`);
    }
  }
  if (!isObject(input.resources)) throw new IrSchemaError("Schema is missing resources");
  for (const [kind, resources] of Object.entries(input.resources)) {
    if (!(IR_RESOURCE_KINDS as readonly string[]).includes(kind)) {
      throw new IrSchemaError(`Unknown resource kind "${kind}" (expected one of ${IR_RESOURCE_KINDS.join(", ")})`);
    }
    if (!isObject(resources)) throw new IrSchemaError(`resources.${kind} must be an object of handle → resource`);
    for (const [handle, resource] of Object.entries(resources)) {
      if (!isObject(resource) || !isObject(resource.fields)) {
        throw new IrSchemaError(`Resource "${kind}.${handle}" must have fields`);
      }
      const { systemFilters } = resource;
      if (systemFilters !== undefined && !(Array.isArray(systemFilters) && systemFilters.every(isString))) {
        throw new IrSchemaError(`Resource "${kind}.${handle}" systemFilters must be an array of strings`);
      }
      if (resource.structure !== undefined && !isObject(resource.structure)) {
        throw new IrSchemaError(`Resource "${kind}.${handle}" structure must be an object`);
      }
      for (const [field, def] of Object.entries(resource.fields)) {
        if (!isObject(def) || typeof def.type !== "string") {
          throw new IrSchemaError(`Field "${kind}.${handle}.${field}" must have a type`);
        }
      }
    }
  }
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
