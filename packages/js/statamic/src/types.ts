/**
 * Shape a (generated) schema must have. `@headquery/codegen` emits a type that
 * satisfies this and registers it via the `Register` interface below.
 */
export interface StatamicSchemaShape {
  collections: Record<string, ResourceShape>;
  taxonomies: Record<string, ResourceShape>;
  // `object` rather than Record<string, unknown> so plain interfaces (no index signature) fit.
  globals: Record<string, object>;
}

export interface ResourceShape {
  /** One item as returned by the API (entry or term). */
  item: object;
  /** Field handles allowed in `filter[...]` (Statamic `allowed_filters`). */
  filterable: string;
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
  collections: Record<string, { item: LooseItem; filterable: string }>;
  taxonomies: Record<string, { item: LooseItem; filterable: string }>;
  globals: Record<string, LooseItem>;
}

export type LooseItem = { id: string } & Record<string, unknown>;

export type RegisteredSchema = Register extends { schema: infer S extends StatamicSchemaShape } ? S : LooseSchema;

/** Conditions supported by Statamic's API filters (same as the collection tag). */
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
  | "lte";

export type ListCondition = "in" | "not_in";
export type PresenceCondition = "exists" | "doesnt_exist";
export type Condition = ScalarCondition | ListCondition | PresenceCondition;

export type Scalar = string | number | boolean;

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
