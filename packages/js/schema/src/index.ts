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
  resources: Record<string, IrResource>;
}

export type IrResourceKind = "collection" | "taxonomy" | "global" | "navigation" | "assetContainer";

export interface IrResource {
  kind: IrResourceKind;
  /** Human-readable title from the CMS. */
  title?: string;
  /** Fields keyed by handle. For collections this is the union of all entry blueprints. */
  fields: Record<string, IrField>;
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
  if (!isObject(input.resources)) throw new IrSchemaError("Schema is missing resources");
  for (const [handle, resource] of Object.entries(input.resources)) {
    if (!isObject(resource) || typeof resource.kind !== "string" || !isObject(resource.fields)) {
      throw new IrSchemaError(`Resource "${handle}" must have a kind and fields`);
    }
    for (const [field, def] of Object.entries(resource.fields)) {
      if (!isObject(def) || typeof def.type !== "string") {
        throw new IrSchemaError(`Field "${handle}.${field}" must have a type`);
      }
    }
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
