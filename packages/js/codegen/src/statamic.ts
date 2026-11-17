import type { IrBlueprintResource, IrField, IrNavigation, IrResource, IrSchema } from "@headquery/schema";

export interface StatamicGenerateOptions {
  /** Module to augment. Defaults to `@headquery/statamic`. */
  moduleName?: string;
}

/** Placeholder in HELPERS for the extra keys of shallow assets (IR `assetKeys`), see `assetKeyLines()`. */
const ASSET_KEYS = "\0assetKeys\0";

// Shapes below were checked against Statamic 6 REST API responses (playgrounds/statamic).
const HELPERS = `
/** Text between the sets of a Bard field with sets: the HTML of its paragraphs, headings, lists, … */
export interface HqBardText {
  type: "text";
  text: string;
}

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
${ASSET_KEYS}
  [key: string]: unknown;
}

/**
 * Link field pointing to a URL (\`mailto:\` and relative paths too); \`{ url: null }\` when empty or
 * when the linked entry doesn't exist. A link is never \`null\` itself, so \`link.url\` always works.
 */
export interface HqLinkUrl {
  url: string | null;
}

/** Link field pointing to an entry (also \`@child\`): the entry's shallow fields. Narrow with \`"title" in link\`. */
export interface HqLinkEntry {
  id: string;
  title: string;
  url: string | null;
  permalink: string | null;
  api_url: string;
}

/** Link field pointing to an asset: the asset's shallow fields. Narrow with \`"alt" in link\`. */
export interface HqLinkAsset {
  id: string;
  url: string;
  permalink: string;
  api_url: string;
  alt: string | null;
${ASSET_KEYS}
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
export type HqNavEntry<E, F> = E extends unknown
  ? Omit<E, keyof HqNavPageBase | keyof F | "entry_id"> & HqNavPageBase & F & { entry_id: string }
  : never;
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

  const names = new Set<string>();
  const unique = (name: string, what: string) => {
    if (names.has(name)) throw new Error(`headquery codegen: ${what} would be named ${name}, which is already taken`);
    names.add(name);
    return name;
  };

  const { names: setNames, code: sets } = setTypes(setOwners(schema), unique);
  out.push(...sets);

  for (const [handle, resource] of sorted(schema.resources.collection)) {
    const name = unique(`${pascal(handle)}Entry`, `collection "${handle}"`);
    out.push(...entryTypes(name, handle, resource, unique, setNames));
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
    const name = unique(`${pascal(handle)}Term`, `taxonomy "${handle}"`);
    out.push(itemInterface(name, termFields(resource, setNames), "HqTermBase", { names: setNames }));
    taxonomies.push(`    ${key(handle)}: { item: ${name}; filterable: ${filterable(resource)} };`);
  }
  for (const [handle, resource] of sorted(schema.resources.global)) {
    const name = `${pascal(handle)}Global`;
    out.push(
      itemInterface(name, resource.fields, "HqGlobalBase", { baseArg: JSON.stringify(handle), names: setNames }),
    );
    globals.push(`    ${key(handle)}: ${name};`);
  }
  for (const [handle, nav] of sorted(schema.resources.navigation)) {
    const name = `${pascal(handle)}NavPage`;
    out.push(...navigationTypes(name, nav, schema, setNames));
    navigations.push(`    ${key(handle)}: { page: ${name} };`);
  }
  for (const [handle, resource] of sorted(schema.resources.assetContainer)) {
    const name = `${pascal(handle)}Asset`;
    out.push(itemInterface(name, resource.fields, "HqAssetBase", { names: setNames }));
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

  const helpers = HELPERS.replaceAll(`${ASSET_KEYS}\n`, assetKeyLines(schema));

  return `${[header, helpers, ...out, schemaType, augmentation].join("\n\n")}\n`;
}

/**
 * Extra keys of shallow assets (asset fields and asset links), e.g. from the addon's
 * \`ShallowAsset::extend()\`. A blueprint field of an asset container is typed from that container's
 * asset type (several containers: their union, \`| null\` when some container lacks the field); keys of
 * the full asset from \`HqAssetBase\`; anything else is \`unknown\`.
 */
function assetKeyLines(schema: IrSchema): string {
  const base: readonly string[] = BASE_KEYS.HqAssetBase;
  const containers = Object.entries(schema.resources.assetContainer ?? {}).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return (schema.assetKeys ?? [])
    .filter((k) => !["id", "url", "permalink", "api_url", "alt"].includes(k))
    .map((k) => {
      const owners = containers
        .filter(([, c]) => k in c.fields)
        .map(([h]) => `${pascal(h)}Asset[${JSON.stringify(k)}]`);
      let type = base.includes(k) ? `HqAssetBase[${JSON.stringify(k)}]` : "unknown";
      if (owners.length) type = [...owners, ...(owners.length < containers.length ? ["null"] : [])].join(" | ");
      return `  ${key(k)}: ${type};\n`;
    })
    .join("");
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

interface ItemOptions {
  /** Type argument of the base interface, e.g. the global set handle. */
  baseArg?: string;
  /** Literal blueprint of an entry type: `blueprint: { handle: "page"; title: string }`. */
  blueprint?: string;
  /** Doc comment above the interface. */
  comment?: string;
  /** Exported set interfaces to reference instead of inline set types. */
  names?: SetNames;
}

/** A field of the item interface; `optional` for taxonomy fields that only some blueprints have. */
type ItemField = { field: IrField; type?: string; optional?: boolean };

function itemInterface(
  name: string,
  fields: Record<string, IrField | ItemField>,
  base: BaseName,
  options: ItemOptions = {},
): string {
  const lines: string[] = [];
  const omitted: string[] = BASE_KEYS[base].filter((k) => k in fields);
  if (options.blueprint !== undefined) omitted.push("blueprint");
  const baseRef = options.baseArg ? `${base}<${options.baseArg}>` : base;
  const parent = omitted.length
    ? `Omit<${baseRef}, ${omitted
        .map((k) => JSON.stringify(k))
        .sort()
        .join(" | ")}>`
    : baseRef;
  if (options.blueprint !== undefined) {
    lines.push(`  blueprint: { handle: ${JSON.stringify(options.blueprint)}; title: string };`);
  }
  for (const handle of Object.keys(fields).sort()) {
    const entry = fields[handle]!;
    const item: ItemField = "field" in entry ? entry : { field: entry };
    const optional = item.optional ? "?" : "";
    lines.push(
      `${doc(item.field, "  ")}  ${key(handle)}${optional}: ${item.type ?? fieldType(item.field, 1, options.names)};`,
    );
  }
  const comment = options.comment ? `/** ${options.comment} */\n` : "";
  return `${comment}export interface ${name} extends ${parent} {\n${lines.join("\n")}\n}`;
}

/**
 * Entry types of a collection. The API returns only the fields of an entry's own blueprint,
 * so each blueprint gets its own interface with a literal `blueprint.handle`; several
 * blueprints form a union that narrows on it.
 */
function entryTypes(
  name: string,
  collection: string,
  resource: IrBlueprintResource,
  unique: (name: string, what: string) => string,
  names: SetNames,
): string[] {
  const blueprints = Object.entries(resource.blueprints).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const title = resource.title ?? collection;
  if (blueprints.length === 1) {
    const [handle, blueprint] = blueprints[0]!;
    return [itemInterface(name, blueprint.fields, "HqEntryBase", { blueprint: handle, names })];
  }
  const members = blueprints.map(([handle, blueprint]) => {
    const member = unique(`${name.replace(/Entry$/, "")}${pascal(handle)}Entry`, `blueprint "${collection}.${handle}"`);
    const comment = `Entry of the \`${title}\` collection with the \`${blueprint.title ?? handle}\` blueprint.`;
    return {
      member,
      code: itemInterface(member, blueprint.fields, "HqEntryBase", { blueprint: handle, comment, names }),
    };
  });
  return [
    ...members.map((m) => m.code),
    `/** Entry of the \`${title}\` collection; narrow on \`blueprint.handle\`. */\nexport type ${name} =\n  | ${members
      .map((m) => m.member)
      .join("\n  | ")};`,
  ];
}

/**
 * Term fields across all blueprints of a taxonomy. Terms don't say which blueprint they use,
 * so fields that only some blueprints have are optional and differing types are combined.
 */
function termFields(resource: IrBlueprintResource, names: SetNames): Record<string, ItemField> {
  const blueprints = Object.values(resource.blueprints);
  const handles = [...new Set(blueprints.flatMap((b) => Object.keys(b.fields)))];
  const fields: Record<string, ItemField> = {};
  for (const handle of handles) {
    const defs = blueprints.flatMap((b) => (b.fields[handle] ? [b.fields[handle]] : []));
    const types = [...new Set(defs.map((f) => baseType(f, 1, names)))];
    const nullable = defs.some((f) => !f.required && !neverNull(f));
    fields[handle] = {
      field: defs[0]!,
      type: `${types.join(" | ")}${nullable ? " | null" : ""}`,
      optional: defs.length < blueprints.length,
    };
  }
  return fields;
}

/**
 * A navigation page is either a plain link or an entry of one of the linked collections
 * (the API returns the entry's fields). Nav blueprint fields are on every page.
 */
function navigationTypes(name: string, nav: IrNavigation, schema: IrSchema, names: SetNames): string[] {
  const fieldsName = `${name.replace(/Page$/, "")}Fields`;
  const fieldLines = Object.keys(nav.fields)
    .sort()
    .map((h) => `${doc(nav.fields[h]!, "  ")}  ${key(h)}: ${fieldType(nav.fields[h]!, 1, names)};`);
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

/**
 * Every field map with its owner for set names: `Blog`/`blog` for a collection with one blueprint,
 * `PagesLanding`/`pages.landing` with several (same for taxonomies), then globals, navs and assets.
 */
function setOwners(schema: IrSchema): Array<{ owner: string; where: string; fields: Record<string, IrField> }> {
  const sorted = <T>(map: Record<string, T> | undefined): Array<[string, T]> =>
    Object.entries(map ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const owners: Array<{ owner: string; where: string; fields: Record<string, IrField> }> = [];
  for (const map of [schema.resources.collection, schema.resources.taxonomy]) {
    for (const [handle, resource] of sorted(map)) {
      const blueprints = sorted(resource.blueprints);
      for (const [bp, blueprint] of blueprints) {
        const several = blueprints.length > 1;
        owners.push({
          owner: several ? `${pascal(handle)}${pascal(bp)}` : pascal(handle),
          where: several ? `${handle}.${bp}` : handle,
          fields: blueprint.fields,
        });
      }
    }
  }
  for (const [handle, r] of sorted(schema.resources.global))
    owners.push({ owner: pascal(handle), where: handle, fields: r.fields });
  for (const [handle, r] of sorted(schema.resources.navigation)) {
    owners.push({ owner: `${pascal(handle)}Nav`, where: handle, fields: r.fields });
  }
  for (const [handle, r] of sorted(schema.resources.assetContainer))
    owners.push({ owner: pascal(handle), where: handle, fields: r.fields });
  return owners;
}

/** Blueprint fields marked filterable plus allowed system filters (e.g. `date`, `basename`). */
function filterable(resource: IrResource | IrBlueprintResource): string {
  const handles = new Set(resource.systemFilters ?? []);
  const fieldMaps =
    "blueprints" in resource ? Object.values(resource.blueprints).map((b) => b.fields) : [resource.fields];
  for (const fields of fieldMaps) for (const [h, f] of Object.entries(fields)) if (f.filterable) handles.add(h);
  const sorted = [...handles].sort().map((h) => JSON.stringify(h));
  return sorted.length ? sorted.join(" | ") : "never";
}

/**
 * TypeScript type for a field as the Statamic REST API returns it, including `| null`
 * where an empty value comes back as null.
 */
export function fieldType(field: IrField, depth = 0, names?: SetNames): string {
  const base = baseType(field, depth, names);
  return field.required || neverNull(field) ? base : `${base} | null`;
}

/** Fields whose augmented value is never null, even when empty. */
function neverNull(field: IrField): boolean {
  switch (field.type) {
    case "unknown":
    case "boolean": // toggle casts to bool
    case "blocks": // replicator: []
    case "link": // { url: null } when empty
    case "enum": // multiple: [], single: HqEmptyOption (part of the base type)
      return true;
    case "richtext": // Bard with sets: [], without sets: null
      return field.sets !== undefined;
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

function baseType(field: IrField, depth: number, names?: SetNames): string {
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
        return `Array<${objectType({ ...field.items.fields }, depth, "id: string", names)}>`;
      }
      return `Array<${baseType(field.items, depth, names)}>`;
    case "object":
      return objectType(field.fields, depth, undefined, names);
    case "relation": {
      const t = { entry: "HqRelatedEntry", term: "HqRelatedTerm", user: "HqUser", asset: "HqAsset" }[field.to];
      return field.multiple ? `Array<${t}>` : t;
    }
    case "asset":
      return field.multiple ? "Array<HqAsset>" : "HqAsset";
    case "link": {
      const targets = field.targets ?? ["entry", "asset"];
      return [
        "HqLinkUrl",
        ...(targets.includes("entry") ? ["HqLinkEntry"] : []),
        ...(targets.includes("asset") ? ["HqLinkAsset"] : []),
      ].join(" | ");
    }
    case "richtext":
      // Bard: HTML without sets; with sets, text items between the sets (disabled sets are left out).
      if (!field.sets) return "string";
      return `Array<${["HqBardText", ...setVariants(field.sets, depth, names)].join(" | ")}>`;
    case "blocks": {
      const variants = setVariants(field.sets, depth, names);
      return `Array<${variants.length ? variants.join(" | ") : "{ id: string | null; type: string; [key: string]: unknown }"}>`;
    }
    case "unknown":
      return "unknown";
  }
}

/**
 * One type per set (replicator and Bard sets): the set's interface name when `names` has it,
 * otherwise the inline `{ id; type: "<set>"; …fields }`. Both fieldtypes add `id` (`null` for
 * sets saved without one) and `type`.
 */
function setVariants(sets: Record<string, Record<string, IrField>>, depth: number, names?: SetNames): string[] {
  return Object.keys(sets)
    .sort()
    .map((set) => {
      const inline = inlineSet(set, sets[set]!, depth);
      return names?.get(inline) ?? inline;
    });
}

/** The inline type of a set, also the identity of its shape (equal shapes share an interface). */
function inlineSet(handle: string, fields: Record<string, IrField>, depth: number): string {
  const inner = Object.keys(fields)
    .sort()
    .map((h) => `${key(h)}: ${fieldType(fields[h]!, depth + 1)}`);
  return `{ id: string | null; type: ${JSON.stringify(handle)}${inner.length ? `; ${inner.join("; ")}` : ""} }`;
}

/** Inline set type → name of its exported interface. */
type SetNames = Map<string, string>;

interface SetUse {
  handle: string;
  fields: Record<string, IrField>;
  shape: string;
  /** Owner type and field handles leading to the set, for qualified names. */
  path: string[];
  /** Where it's used, e.g. `Bard blog.body`. */
  where: string;
}

/**
 * Bard and replicator sets as exported interfaces, named `{Handle}Set`. Sets with the same name
 * and shape (a set copied into several fields or imported from a fieldset) share one interface;
 * when the same name has different shapes, every variant gets a name from its location instead
 * (`BlogBodyImageSet`), so the result doesn't depend on which field comes first.
 */
function setTypes(
  owners: Array<{ owner: string; where: string; fields: Record<string, IrField> }>,
  unique: (name: string, what: string) => string,
): { names: SetNames; code: string[] } {
  const uses: SetUse[] = [];
  const visit = (field: IrField, path: string[], where: string) => {
    switch (field.type) {
      case "richtext":
      case "blocks":
        for (const handle of Object.keys(field.sets ?? {}).sort()) {
          const fields = field.sets![handle]!;
          const kind = field.type === "richtext" ? "Bard" : "Replicator";
          uses.push({ handle, fields, shape: inlineSet(handle, fields, 1), path, where: `${kind} \`${where}\`` });
          walk(fields, [...path, handle], `${where}.${handle}`);
        }
        break;
      case "object":
        walk(field.fields, path, where);
        break;
      case "array":
        visit(field.items, path, where);
        break;
    }
  };
  const walk = (fields: Record<string, IrField>, path: string[], where: string) => {
    for (const handle of Object.keys(fields).sort()) visit(fields[handle]!, [...path, handle], `${where}.${handle}`);
  };
  for (const o of owners) walk(o.fields, [o.owner], o.where);

  const shapesByName = new Map<string, Map<string, SetUse[]>>();
  for (const use of uses) {
    const name = `${pascal(use.handle)}Set`;
    const shapes = shapesByName.get(name) ?? new Map<string, SetUse[]>();
    shapes.set(use.shape, [...(shapes.get(use.shape) ?? []), use]);
    shapesByName.set(name, shapes);
  }
  const names: SetNames = new Map();
  const sets: Array<{ name: string; uses: SetUse[] }> = [];
  for (const [plain, shapes] of shapesByName) {
    for (const [shape, list] of shapes) {
      const first = list[0]!;
      const name = shapes.size === 1 ? plain : `${first.path.map(pascal).join("")}${pascal(first.handle)}Set`;
      names.set(shape, unique(name, `set "${first.handle}" (${first.where})`));
      sets.push({ name, uses: list });
    }
  }
  const code = sets
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map(({ name, uses }) => {
      const { handle, fields } = uses[0]!;
      const lines = [
        "  /** `null` for sets saved without an id. */",
        "  id: string | null;",
        `  type: ${JSON.stringify(handle)};`,
        ...Object.keys(fields)
          .sort()
          .map((h) => `${doc(fields[h]!, "  ")}  ${key(h)}: ${fieldType(fields[h]!, 1, names)};`),
      ];
      const where = [...new Set(uses.map((u) => u.where))].join(", ");
      return `/** Set \`${handle}\` (${where}). */\nexport interface ${name} {\n${lines.join("\n")}\n}`;
    });
  return { names, code };
}

function objectType(fields: Record<string, IrField>, depth: number, prefix?: string, names?: SetNames): string {
  const inner = Object.keys(fields)
    .sort()
    .map((h) => `${key(h)}: ${fieldType(fields[h]!, depth + 1, names)}`);
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
