/**
 * Shape a (generated) schema must have. `@headquery/codegen` emits a type that
 * satisfies this and registers it via the `Register` interface below.
 */
export interface StatamicSchemaShape {
  collections: Record<string, ResourceShape>;
  taxonomies: Record<string, ResourceShape>;
  // `object` rather than Record<string, unknown> so plain interfaces (no index signature) fit.
  globals: Record<string, object>;
  navigations: Record<string, NavigationShape>;
  /** Optional so schemas generated before asset support still match. */
  assetContainers?: Record<string, ResourceShape>;
}

export interface NavigationShape {
  /** One page of the tree as returned by the API (link page or entry page). */
  page: object;
}

export interface ResourceShape {
  /** One item as returned by the API (entry, term or asset). */
  item: object;
  /** Field handles allowed in `filter[...]` (Statamic `allowed_filters`). */
  filterable: string;
  /** Structured collections only: one page of `collections(handle).tree()`. */
  tree?: object;
}

/**
 * Module augmentation hook. Generated types do:
 *
 *   declare module "@headquery/statamic" {
 *     interface Register { schema: Schema }
 *   }
 *
 * after which `createStatamicClient()` is fully typed without passing generics.
 */
// biome-ignore lint: intentionally empty, filled via declaration merging
export interface Register {}

/** Used when no schema is registered: everything works, loosely typed. */
export interface LooseSchema {
  collections: Record<string, { item: LooseItem; filterable: string; tree: LooseTreePage }>;
  taxonomies: Record<string, { item: LooseItem; filterable: string }>;
  globals: Record<string, LooseItem>;
  navigations: Record<string, { page: LooseNavPage }>;
  assetContainers: Record<string, { item: LooseAsset; filterable: string }>;
}

export type LooseItem = { id: string } & Record<string, unknown>;

/** Page of a collection tree without generated types: the entry plus `entry_id`. */
export type LooseTreePage = LooseItem & { entry_id: string };

/** Asset without generated types. `path` is relative to the container root. */
export type LooseAsset = { id: string; path: string } & Record<string, unknown>;

/** Asset containers of a schema; loosely typed when the schema has none (generated before asset support). */
export type AssetContainersOf<S extends StatamicSchemaShape> = S extends {
  assetContainers: infer A extends Record<string, ResourceShape>;
}
  ? A
  : LooseSchema["assetContainers"];

/** Nav page without generated types: `entry_id` is null for plain links, the entry id otherwise. */
export type LooseNavPage = { id: string; entry_id: string | null } & Record<string, unknown>;

export type RegisteredSchema = Register extends { schema: infer S extends StatamicSchemaShape } ? S : LooseSchema;

/** Conditions with one value (Statamic's API filters, same as the collection tag). */
export type ScalarCondition =
  | "is"
  | "not"
  | "contains"
  | "doesnt_contain"
  | "starts_with"
  | "doesnt_start_with"
  | "ends_with"
  | "doesnt_end_with"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  /** Regular expression, without delimiters. */
  | "matches"
  | "doesnt_match"
  /** Dates: pass a date string or a `Date`. Numeric strings like `"2026"` are read as "now" by Statamic. */
  | "is_after"
  | "is_before";

/** Conditions with several values, sent joined with `|`. `overlaps` is for array fields. */
export type ListCondition = "in" | "not_in" | "overlaps" | "doesnt_overlap";

export type PresenceCondition = "exists" | "doesnt_exist";

/**
 * Conditions that are true or false for a field: `.where(field, "is_future")` sends `true`,
 * `.where(field, "is_url", false)` negates.
 */
export type BooleanCondition =
  | PresenceCondition
  | "is_future"
  | "is_past"
  | "is_alpha"
  | "is_alpha_numeric"
  | "is_numeric"
  | "is_url"
  | "is_embeddable"
  | "is_email"
  | "is_numberwang";

export type Condition = ScalarCondition | ListCondition | BooleanCondition;

export type Scalar = string | number | boolean;

/**
 * Taxonomies usable in `whereTaxonomy*()`: the `T` of `"taxonomy:T"` entries in the filterable
 * union (Statamic `allowed_filters: ['taxonomy:tags']`). Any taxonomy without generated types.
 */
export type TaxonomyFilter<Filterable extends string> = string extends Filterable
  ? string
  : Filterable extends `taxonomy:${infer T}`
    ? T
    : never;

/** `"title"` sorts ascending, `"-title"` descending. Nested fields use `->` in Statamic. */
export type SortField<F extends string> = F | `-${F}`;

export interface PaginationLinks {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
}

export interface PaginationMeta {
  current_page: number;
  from: number | null;
  to: number | null;
  total: number;
  per_page: number;
  path: string;
  last_page?: number;
}

export interface Paginated<T> {
  data: T[];
  links: PaginationLinks;
  meta: PaginationMeta;
}

export interface Single<T> {
  data: T;
}

/** One node of a navigation tree (`GET /navs/{handle}/tree`). */
export interface NavTreeItem<P> {
  page: P;
  /** 1 for top-level pages. */
  depth: number;
  children: Array<NavTreeItem<P>>;
}

export interface NavTree<P> {
  data: Array<NavTreeItem<P>>;
}

/**
 * A user from `GET /users` or `GET /users/{id}`. Statamic always returns exactly these fields,
 * whatever the user blueprint contains.
 */
export interface StatamicUser {
  id: string;
  email: string;
  name: string | null;
  is_super: boolean;
  api_url: string;
}

/** A form from `GET /forms` or `GET /forms/{handle}`. Submissions go through Statamic's form routes. */
export interface StatamicForm {
  handle: string;
  title: string;
  /** Keyed by field handle, in blueprint order. */
  fields: Record<string, StatamicFormField>;
  api_url: string;
}

/** A form field: its handle, fieldtype and blueprint config (only the keys that are set). */
export interface StatamicFormField {
  handle: string;
  /** Fieldtype, e.g. `text`, `textarea`, `select`, `checkboxes`, `assets`. */
  type: string;
  /** Width in percent (`100`, `50`, …). */
  width: number;
  display?: string;
  instructions?: string;
  /** Laravel validation rules, e.g. `["required", "email"]`. */
  validate?: string[];
  /** Fieldtype config such as `options`, `input_type` or `placeholder`. */
  [key: string]: unknown;
}

/** A site from `GET /sites` (off unless `resources.sites` is enabled). */
export interface StatamicSite {
  handle: string;
  name: string;
  locale: string;
  short_locale: string;
  url: string;
}

/** One navigation as listed by `GET /navs`. */
export interface NavInfo {
  handle: string;
  title: string;
  max_depth: number | null;
  expects_root: boolean;
  api_url: string;
}

/** Unpaginated list response (`GET /globals`, `GET /navs`). */
export interface DataList<T> {
  data: T[];
}

/** Keys of any member of a union (`keyof` of a union only has the shared keys). */
export type KeysOfUnion<T> = T extends unknown ? keyof T : never;

/** `Pick` applied to each union member, so e.g. nav link and entry pages stay distinguishable. */
export type PickFromUnion<T, K extends PropertyKey> = T extends unknown ? Pick<T, Extract<K, keyof T>> : never;

/** `T` itself while all keys are picked (readable hovers), otherwise `PickFromUnion`. */
export type PickedUnion<T, K extends PropertyKey> = [KeysOfUnion<T>] extends [K] ? T : PickFromUnion<T, K>;
