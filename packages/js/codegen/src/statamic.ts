import type { IrField, IrNavigation, IrResource, IrSchema } from "@headquery/schema";

export interface StatamicGenerateOptions {
  /** Module to augment. Defaults to `@headquery/statamic`. */
  moduleName?: string;
}

// Shapes below were checked against Statamic 6 REST API responses (playgrounds/statamic).
const HELPERS = `
/** Bard: an HTML string without sets, an array of text/set blocks with sets. */
export type HqRichText = string | Array<Record<string, unknown>>;

/** Select-like fields (select, button_group, radio, checkboxes) return labelled values. */
export interface HqOption<T extends string = string> {
  key: T;
  value: T;
  label: string;
}

/** A single select without a value still returns an object, with every property null. */
export interface HqEmptyOption {
  key: null;
  value: null;
  label: null;
}

export interface HqAsset {
  id: string;
  url: string;
  permalink: string;
  api_url: string;
  alt: string | null;
  [key: string]: unknown;
}

export interface HqRelatedEntry {
  id: string;
  title: string;
  url: string | null;
  permalink: string | null;
  api_url: string;
  [key: string]: unknown;
}

export interface HqRelatedTerm {
  id: string;
  title: string;
  slug: string;
  url: string | null;
  permalink: string | null;
  api_url: string;
  [key: string]: unknown;
}

export interface HqUser {
  id: string;
  name: string | null;
  email: string;
  api_url: string;
  [key: string]: unknown;
}

/** Fields Statamic adds to every entry, regardless of the blueprint. */
export interface HqEntryBase {
  id: string;
  title: string;
  slug: string | null;
  /** Entry date for dated collections, otherwise null. */
  date: string | null;
  uri: string | null;
  url: string | null;
  permalink: string | null;
  api_url: string;
  edit_url: string;
  published: boolean;
  private: boolean;
  status: "published" | "draft" | "scheduled" | "expired";
  locale: string;
  origin_id: string | null;
  order: number | null;
  mount: unknown;
  is_entry: true;
  blueprint: { title: string; handle: string };
  collection: { title: string; handle: string };
  last_modified: string;
  updated_at: string;
  updated_by: HqUser | null;
}

/** Fields Statamic adds to every taxonomy term, regardless of the blueprint. */
export interface HqTermBase {
  id: string;
  title: string;
  slug: string;
  uri: string | null;
  url: string | null;
  permalink: string | null;
  api_url: string;
  edit_url: string;
  locale: string;
  is_term: true;
  entries_count: number;
  taxonomy: { title: string; handle: string; uri: string | null; url: string | null; permalink: string | null };
  updated_at: string;
  updated_by: HqUser | null;
}

/** Fields Statamic adds to every asset from \`cms.assets()\`, regardless of the blueprint. */
export interface HqAssetBase {
  /** \`container::path\` */
  id: string;
  title: string;
  /** Relative to the container root, e.g. \`2026/hero.jpg\`. */
  path: string;
  filename: string;
  basename: string;
  extension: string;
  /** \`/\` for the container root. */
  folder: string;
  url: string | null;
  permalink: string | null;
  api_url: string;
  edit_url: string;
  is_asset: true;
  is_audio: boolean;
  is_previewable: boolean;
  is_image: boolean;
  is_svg: boolean;
  is_video: boolean;
  is_pdf: boolean;
  blueprint: { title: string; handle: string };
  container: {
    id: string;
    title: string;
    handle: string;
    disk: string;
    blueprint: { title: string; handle: string };
    search_index: string | null;
    api_url: string | null;
  };
  /** Human-readable, e.g. \`255 B\`. */
  size: string;
  size_bytes: number;
  size_kilobytes: number;
  size_megabytes: number;
  size_gigabytes: number;
  size_b: number;
  size_kb: number;
  size_mb: number;
  size_gb: number;
  last_modified: string;
  last_modified_timestamp: number;
  last_modified_instance: string;
  /** \`x-y-zoom\` in percent, \`50-50-1\` when no focal point is set. */
  focus: string;
  has_focus: boolean;
  focus_css: string;
  /** Images and videos only. */
  width: number | null;
  height: number | null;
  /** \`square\` for non-images (width and height are both null). */
  orientation: "landscape" | "portrait" | "square";
  ratio: number | null;
  mime_type: string | null;
  /** Audio and video only, in seconds. */
  duration: number | null;
  duration_seconds: number | null;
  duration_minutes: string | null;
  duration_sec: number | null;
  duration_min: string | null;
  playtime: string;
}

/** Fields Statamic adds to every global set. \`handle\` tells sets apart in \`cms.globals()\`. */
export interface HqGlobalBase<H extends string = string> {
  handle: H;
  api_url: string;
}

/** Properties every navigation page has. \`id\` is the nav item's id, not the entry's. */
export interface HqNavPageBase {
  id: string;
  title: string | null;
  url: string | null;
  uri: string | null;
  permalink: string | null;
}

/** A navigation page that is a plain link or text (not linked to an entry). */
export type HqNavLink<F> = HqNavPageBase & F & { entry_id: null };

/** A page of a structured collection's tree: the entry's fields plus \`entry_id\` (equal to \`id\`). */
export type HqTreeEntry<E> = E & { entry_id: string };

/** A navigation page linked to an entry: the entry's fields, the nav fields and \`entry_id\`. */
export type HqNavEntry<E, F> = Omit<E, keyof HqNavPageBase | keyof F | "entry_id"> &
  HqNavPageBase &
  F & { entry_id: string };
`.trim();

/** Keys of the base interfaces above; blueprint fields with the same handle take precedence. */
const BASE_KEYS = {
  HqEntryBase: [
    "id",
    "title",
    "slug",
    "date",
    "uri",
    "url",
    "permalink",
    "api_url",
    "edit_url",
    "published",
    "private",
    "status",
    "locale",
    "origin_id",
    "order",
    "mount",
    "is_entry",
    "blueprint",
    "collection",
    "last_modified",
    "updated_at",
    "updated_by",
  ],
  HqTermBase: [
    "id",
    "title",
    "slug",
    "uri",
    "url",
    "permalink",
    "api_url",
    "edit_url",
    "locale",
    "is_term",
    "entries_count",
    "taxonomy",
    "updated_at",
    "updated_by",
  ],
  HqGlobalBase: ["handle", "api_url"],
  HqAssetBase: [
    "id",
    "title",
    "path",
    "filename",
    "basename",
    "extension",
    "folder",
    "url",
    "permalink",
    "api_url",
    "edit_url",
    "is_asset",
    "is_audio",
    "is_previewable",
    "is_image",
    "is_svg",
    "is_video",
    "is_pdf",
    "blueprint",
    "container",
    "size",
    "size_bytes",
    "size_kilobytes",
    "size_megabytes",
    "size_gigabytes",
    "size_b",
    "size_kb",
    "size_mb",
    "size_gb",
    "last_modified",
    "last_modified_timestamp",
    "last_modified_instance",
    "focus",
    "has_focus",
    "focus_css",
    "height",
    "width",
    "orientation",
    "ratio",
    "mime_type",
    "duration",
    "duration_seconds",
    "duration_minutes",
    "duration_sec",
    "duration_min",
    "playtime",
  ],
} as const;

type BaseName = keyof typeof BASE_KEYS;

/** Turn an IR schema into a TypeScript module for `@headquery/statamic`. */
export function generateStatamic(schema: IrSchema, options: StatamicGenerateOptions = {}): string {
  const moduleName = options.moduleName ?? "@headquery/statamic";
  const out: string[] = [];
  const collections: string[] = [];
  const taxonomies: string[] = [];
  const globals: string[] = [];
  const navigations: string[] = [];
  const assetContainers: string[] = [];
  const sorted = <T>(map: Record<string, T> | undefined): Array<[string, T]> =>
    Object.entries(map ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  for (const [handle, resource] of sorted(schema.resources.collection)) {
    const name = `${pascal(handle)}Entry`;
    out.push(itemInterface(name, resource, "HqEntryBase"));
    let tree = "";
    if (resource.structure) {
      // Structured collection: `cms.collections(handle).tree()` returns its page tree.
      const page = `${pascal(handle)}TreePage`;
      const depth = resource.structure.maxDepth ? ` (max depth ${resource.structure.maxDepth})` : "";
      out.push(
        `/** Page of the \`${resource.title ?? handle}\` tree${depth}. */\nexport type ${page} = HqTreeEntry<${name}>;`,
      );
      tree = `; tree: ${page}`;
    }
    collections.push(`    ${key(handle)}: { item: ${name}; filterable: ${filterable(resource)}${tree} };`);
  }
  for (const [handle, resource] of sorted(schema.resources.taxonomy)) {
    const name = `${pascal(handle)}Term`;
    out.push(itemInterface(name, resource, "HqTermBase"));
    taxonomies.push(`    ${key(handle)}: { item: ${name}; filterable: ${filterable(resource)} };`);
  }
  for (const [handle, resource] of sorted(schema.resources.global)) {
    const name = `${pascal(handle)}Global`;
    out.push(itemInterface(name, resource, "HqGlobalBase", JSON.stringify(handle)));
    globals.push(`    ${key(handle)}: ${name};`);
  }
  for (const [handle, nav] of sorted(schema.resources.navigation)) {
    const name = `${pascal(handle)}NavPage`;
    out.push(...navigationTypes(name, nav, schema));
    navigations.push(`    ${key(handle)}: { page: ${name} };`);
  }
  for (const [handle, resource] of sorted(schema.resources.assetContainer)) {
    const name = `${pascal(handle)}Asset`;
    out.push(itemInterface(name, resource, "HqAssetBase"));
    assetContainers.push(`    ${key(handle)}: { item: ${name}; filterable: ${filterable(resource)} };`);
  }

  const header = [
    "/* eslint-disable */",
    "// This file is generated by @headquery/codegen. Do not edit it by hand.",
    `// Source: ${schema.cms.name}${schema.cms.version ? ` ${schema.cms.version}` : ""}`,
    "",
    `import type {} from ${JSON.stringify(moduleName)};`,
  ].join("\n");

  const schemaType = [
    "export interface Schema {",
    `  collections: {${block(collections)}};`,
    `  taxonomies: {${block(taxonomies)}};`,
    `  globals: {${block(globals)}};`,
    `  navigations: {${block(navigations)}};`,
    `  assetContainers: {${block(assetContainers)}};`,
    ...sitesType(schema),
    "}",
  ].join("\n");

  const augmentation = [
    `declare module ${JSON.stringify(moduleName)} {`,
    "  interface Register {",
    "    schema: Schema;",
    "  }",
    "}",
  ].join("\n");

  return `${[header, HELPERS, ...out, schemaType, augmentation].join("\n\n")}\n`;
}

/** `sites: "default" | "de";` in the CMS's order; nothing for schemas exported without sites. */
function sitesType(schema: IrSchema): string[] {
  const sites = Object.entries(schema.sites ?? {});
  if (!sites.length) return [];
  const info = sites.map(([handle, s]) => {
    const details = [s.name, s.locale].filter(Boolean).join(", ");
    return details ? `${handle} (${details})` : handle;
  });
  return [
    `  /** Site handles for \`.site()\`: ${info.join(", ")}. */`,
    `  sites: ${sites.map(([handle]) => JSON.stringify(handle)).join(" | ")};`,
  ];
}

function block(lines: string[]): string {
  return lines.length ? `\n${lines.join("\n")}\n  ` : "";
}

function itemInterface(name: string, resource: IrResource, base: BaseName, baseArg?: string): string {
  const lines: string[] = [];
  const overridden = BASE_KEYS[base].filter((k) => k in resource.fields);
  const baseRef = baseArg ? `${base}<${baseArg}>` : base;
  const parent = overridden.length
    ? `Omit<${baseRef}, ${overridden
        .map((k) => JSON.stringify(k))
        .sort()
        .join(" | ")}>`
    : baseRef;
  for (const handle of Object.keys(resource.fields).sort()) {
    const field = resource.fields[handle]!;
    lines.push(`${doc(field, "  ")}  ${key(handle)}: ${fieldType(field, 1)};`);
  }
  return `export interface ${name} extends ${parent} {\n${lines.join("\n")}\n}`;
}

/**
 * A navigation page is either a plain link or an entry of one of the linked collections
 * (the API returns the entry's fields). Nav blueprint fields are on every page.
 */
function navigationTypes(name: string, nav: IrNavigation, schema: IrSchema): string[] {
  const fieldsName = `${name.replace(/Page$/, "")}Fields`;
  const fieldLines = Object.keys(nav.fields)
    .sort()
    .map((h) => `${doc(nav.fields[h]!, "  ")}  ${key(h)}: ${fieldType(nav.fields[h]!, 1)};`);
  const fieldsType = fieldLines.length
    ? `export interface ${fieldsName} {\n${fieldLines.join("\n")}\n}`
    : `export interface ${fieldsName} {}`;

  // Collections not in the schema (e.g. not exposed via the API) still come back as entries.
  const entryTypes = [...new Set(nav.collections ?? [])]
    .sort()
    .map((c) => (schema.resources.collection?.[c] ? `${pascal(c)}Entry` : "HqEntryBase"));
  const variants = [
    `HqNavLink<${fieldsName}>`,
    ...[...new Set(entryTypes)].map((e) => `HqNavEntry<${e}, ${fieldsName}>`),
  ];
  const comment = `/** Page of the \`${nav.title ?? name}\` navigation${nav.maxDepth ? ` (max depth ${nav.maxDepth})` : ""}. */`;
  return [fieldsType, `${comment}\nexport type ${name} =\n  | ${variants.join("\n  | ")};`];
}

/** Blueprint fields marked filterable plus allowed system filters (e.g. `date`, `basename`). */
function filterable(resource: IrResource): string {
  const handles = new Set(resource.systemFilters ?? []);
  for (const [h, f] of Object.entries(resource.fields)) if (f.filterable) handles.add(h);
  const sorted = [...handles].sort().map((h) => JSON.stringify(h));
  return sorted.length ? sorted.join(" | ") : "never";
}

/**
 * TypeScript type for a field as the Statamic REST API returns it, including `| null`
 * where an empty value comes back as null.
 */
export function fieldType(field: IrField, depth = 0): string {
  const base = baseType(field, depth);
  return field.required || neverNull(field) ? base : `${base} | null`;
}

/** Fields whose augmented value is never null, even when empty. */
function neverNull(field: IrField): boolean {
  switch (field.type) {
    case "unknown":
    case "boolean": // toggle casts to bool
    case "blocks": // replicator: []
    case "enum": // multiple: [], single: HqEmptyOption (part of the base type)
      return true;
    case "relation":
    case "asset":
      return field.multiple === true; // [] when multiple, null when single
    case "array":
      // grid returns [], but list/taggable/table return null when empty
      return field.cmsType === "grid";
    default:
      return false;
  }
}

function baseType(field: IrField, depth: number): string {
  switch (field.type) {
    case "string":
    case "date":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "enum": {
      const union = field.values.length ? field.values.map((v) => JSON.stringify(v)).join(" | ") : "string";
      const option = `HqOption<${union}>`;
      if (field.multiple) return `Array<${option}>`;
      return field.required ? option : `${option} | HqEmptyOption`;
    }
    case "array":
      // Grid rows carry a row id next to their fields.
      if (field.cmsType === "grid" && field.items.type === "object") {
        return `Array<${objectType({ ...field.items.fields }, depth, "id: string")}>`;
      }
      return `Array<${baseType(field.items, depth)}>`;
    case "object":
      return objectType(field.fields, depth);
    case "relation": {
      const t = { entry: "HqRelatedEntry", term: "HqRelatedTerm", user: "HqUser", asset: "HqAsset" }[field.to];
      return field.multiple ? `Array<${t}>` : t;
    }
    case "asset":
      return field.multiple ? "Array<HqAsset>" : "HqAsset";
    case "richtext":
      return "HqRichText";
    case "blocks": {
      const sets = Object.keys(field.sets).sort();
      if (!sets.length) return "Array<{ id?: string; type: string; [key: string]: unknown }>";
      const variants = sets.map((set) => {
        const fields = field.sets[set]!;
        const inner = Object.keys(fields)
          .sort()
          .map((h) => `${key(h)}: ${fieldType(fields[h]!, depth + 1)}`);
        return `{ id?: string; type: ${JSON.stringify(set)}${inner.length ? `; ${inner.join("; ")}` : ""} }`;
      });
      return `Array<${variants.join(" | ")}>`;
    }
    case "unknown":
      return "unknown";
  }
}

function objectType(fields: Record<string, IrField>, depth: number, prefix?: string): string {
  const inner = Object.keys(fields)
    .sort()
    .map((h) => `${key(h)}: ${fieldType(fields[h]!, depth + 1)}`);
  if (prefix) inner.unshift(prefix);
  return inner.length ? `{ ${inner.join("; ")} }` : "Record<string, unknown>";
}

function doc(field: IrField, indent: string): string {
  const parts: string[] = [];
  if (field.description) parts.push(field.description);
  if (field.cmsType) parts.push(`CMS field type: \`${field.cmsType}\``);
  return parts.length ? `${indent}/** ${parts.join(" — ").replace(/\*\//g, "*\\/")} */\n` : "";
}

function key(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

export function pascal(handle: string): string {
  const p = handle
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((s) => s[0]!.toUpperCase() + s.slice(1))
    .join("");
  return /^[0-9]/.test(p) ? `_${p}` : p || "Resource";
}
