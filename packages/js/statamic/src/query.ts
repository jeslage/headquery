import {
  type Compilable,
  type CoreClient,
  HeadqueryHttpError,
  type QueryParams,
  type RequestSpec,
  type RunOptions,
} from "@headquery/core";
import type {
  DataList,
  KeysOfUnion,
  ListCondition,
  NavTree,
  Paginated,
  PickedUnion,
  PresenceCondition,
  Scalar,
  ScalarCondition,
  Single,
  SortField,
} from "./types";

/**
 * Separator Statamic uses for multiple values in `in` / `not_in` filters.
 * Verified against Statamic 6 (playgrounds/statamic-client e2e tests).
 */
export const LIST_SEPARATOR = "|";

interface ListState {
  filters: Record<string, string>;
  sort?: string[];
  limit?: number;
  page?: number;
  site?: string;
  fields?: string[];
}

type FieldValue<Item, F extends keyof Item> = Item[F] extends Scalar | null | undefined
  ? Exclude<Item[F], null | undefined>
  : Scalar;

/**
 * Immutable list query for collection entries, taxonomy terms and assets.
 * Every builder call returns a new instance, so partial queries can be reused safely.
 */
export class ListQuery<Item, Filterable extends string, Picked extends keyof Item = keyof Item>
  implements Compilable<Paginated<Pick<Item, Picked>>>
{
  declare readonly __result?: Paginated<Pick<Item, Picked>>;

  constructor(
    private readonly client: CoreClient,
    private readonly path: string,
    private readonly state: ListState = { filters: {} },
  ) {}

  /** `filter[field]=value` (condition `is`). */
  where<F extends Filterable & keyof Item>(field: F, value: FieldValue<Item, F>): ListQuery<Item, Filterable, Picked>;
  where<F extends Filterable & keyof Item>(
    field: F,
    condition: ScalarCondition,
    value: FieldValue<Item, F> | Scalar,
  ): ListQuery<Item, Filterable, Picked>;
  where<F extends Filterable & keyof Item>(
    field: F,
    condition: ListCondition,
    values: Array<FieldValue<Item, F> | Scalar>,
  ): ListQuery<Item, Filterable, Picked>;
  where<F extends Filterable & keyof Item>(field: F, condition: PresenceCondition): ListQuery<Item, Filterable, Picked>;
  where(field: string, a?: unknown, b?: unknown): ListQuery<Item, Filterable, Picked> {
    let condition: string;
    let value: unknown;
    // Two arguments mean `is`, unless the second is a presence condition.
    if (b === undefined && !isPresence(a)) {
      condition = "is";
      value = a;
    } else {
      condition = a as string;
      value = b ?? (condition === "exists" || condition === "doesnt_exist" ? true : undefined);
    }
    const serialized = Array.isArray(value) ? value.map(String).join(LIST_SEPARATOR) : String(value);
    return this.with({ filters: { ...this.state.filters, [`filter[${field}:${condition}]`]: serialized } });
  }

  /** `sort=a,-b`. Later calls replace earlier ones. */
  sort(...fields: Array<SortField<Extract<keyof Item, string>>>): ListQuery<Item, Filterable, Picked> {
    return this.with({ sort: fields });
  }

  limit(limit: number): ListQuery<Item, Filterable, Picked> {
    return this.with({ limit });
  }

  page(page: number): ListQuery<Item, Filterable, Picked> {
    return this.with({ page });
  }

  /** Multi-site: `site=<handle>`. */
  site(handle: string): ListQuery<Item, Filterable, Picked> {
    return this.with({ site: handle });
  }

  /** Only return these fields; narrows the result type. */
  fields<P extends keyof Item & string>(fields: P[]): ListQuery<Item, Filterable, P> {
    return new ListQuery<Item, Filterable, P>(this.client, this.path, { ...this.state, fields });
  }

  toRequest(): RequestSpec {
    const query: QueryParams = { ...this.state.filters };
    if (this.state.sort?.length) query.sort = this.state.sort;
    if (this.state.limit !== undefined) query.limit = this.state.limit;
    if (this.state.page !== undefined) query.page = this.state.page;
    if (this.state.site) query.site = this.state.site;
    if (this.state.fields?.length) query.fields = this.state.fields;
    return { method: "GET", path: this.path, query };
  }

  /** Full, deterministic URL — handy as a cache key. */
  url(): string {
    return this.client.url(this.toRequest());
  }

  get(options?: RunOptions): Promise<Paginated<Pick<Item, Picked>>> {
    return this.client.run(this, options);
  }

  /** First matching item or `null` (sends `limit=1`). */
  async first(options?: RunOptions): Promise<Pick<Item, Picked> | null> {
    const res = await this.limit(1).page(1).get(options);
    return res.data[0] ?? null;
  }

  // Always a plain ListQuery: `find()` is only offered before any list option is set.
  private with(patch: Partial<ListState>): ListQuery<Item, Filterable, Picked> {
    return new ListQuery(this.client, this.path, { ...this.state, ...patch });
  }
}

/**
 * Start of a query on one collection, taxonomy or asset container: build a list query,
 * or `find()` a single item. `find()` disappears once a list option is set, because the
 * single-item endpoint ignores filters, sort and pagination.
 */
export class ResourceQuery<Item, Filterable extends string> extends ListQuery<Item, Filterable> {
  constructor(
    private readonly core: CoreClient,
    private readonly base: string,
    private readonly encodeKey: (key: string) => string = encodeURIComponent,
  ) {
    super(core, base);
  }

  /**
   * One item by its key: entry id or slug, term slug, or asset path
   * (`GET {list path}/{key}`). Resolves to `null` instead of throwing when it doesn't exist.
   */
  find(key: string): SingleQuery<Item, keyof Item, true> {
    return new SingleQuery(this.core, `${this.base}/${this.encodeKey(key)}`, { orNull: true });
  }
}

interface SingleState {
  site?: string;
  fields?: string[];
  /** Resolve 404 to `null` (`find()`). */
  orNull?: boolean;
}

/**
 * Single resource (one entry, term, asset or global set). With `OrNull` (from `find()`),
 * `get()` resolves to `null` when the API answers 404.
 */
export class SingleQuery<Item, Picked extends keyof Item = keyof Item, OrNull extends boolean = false>
  implements Compilable<Single<Pick<Item, Picked>>>
{
  declare readonly __result?: Single<Pick<Item, Picked>>;

  constructor(
    private readonly client: CoreClient,
    private readonly path: string,
    private readonly state: SingleState = {},
  ) {}

  /** Multi-site: `site=<handle>`. */
  site(handle: string): SingleQuery<Item, Picked, OrNull> {
    return new SingleQuery(this.client, this.path, { ...this.state, site: handle });
  }

  /** Only return these fields; narrows the result type. */
  fields<P extends keyof Item & string>(fields: P[]): SingleQuery<Item, P, OrNull> {
    return new SingleQuery<Item, P, OrNull>(this.client, this.path, { ...this.state, fields });
  }

  toRequest(): RequestSpec {
    const query: QueryParams = {};
    if (this.state.site) query.site = this.state.site;
    if (this.state.fields?.length) query.fields = this.state.fields;
    return { method: "GET", path: this.path, query };
  }

  url(): string {
    return this.client.url(this.toRequest());
  }

  async get(options?: RunOptions): Promise<Single<Pick<Item, Picked>> | (OrNull extends true ? null : never)> {
    try {
      return await this.client.run(this, options);
    } catch (e) {
      if (this.state.orNull && e instanceof HeadqueryHttpError && e.status === 404) {
        return null as OrNull extends true ? null : never;
      }
      throw e;
    }
  }
}

/**
 * Navigation tree (`GET /navs/{handle}/tree`). Pages are a union of plain links (`entry_id: null`)
 * and linked entries (`entry_id: string`, with the entry's fields).
 */
export class TreeQuery<Page, Picked extends KeysOfUnion<Page> = KeysOfUnion<Page>>
  implements Compilable<NavTree<PickedUnion<Page, Picked>>>
{
  declare readonly __result?: NavTree<PickedUnion<Page, Picked>>;

  constructor(
    private readonly client: CoreClient,
    private readonly path: string,
    private readonly state: { maxDepth?: number; site?: string; fields?: string[] } = {},
  ) {}

  /** `max_depth=n`: only return pages up to this depth (1 = top level). */
  maxDepth(depth: number): TreeQuery<Page, Picked> {
    return new TreeQuery(this.client, this.path, { ...this.state, maxDepth: depth });
  }

  /** Multi-site: `site=<handle>`. */
  site(handle: string): TreeQuery<Page, Picked> {
    return new TreeQuery(this.client, this.path, { ...this.state, site: handle });
  }

  /**
   * Only return these page fields; narrows the page type. Keep `entry_id` to tell
   * links and entries apart.
   */
  fields<P extends KeysOfUnion<Page> & string>(fields: P[]): TreeQuery<Page, P> {
    return new TreeQuery<Page, P>(this.client, this.path, { ...this.state, fields });
  }

  toRequest(): RequestSpec {
    const query: QueryParams = {};
    if (this.state.maxDepth !== undefined) query.max_depth = this.state.maxDepth;
    if (this.state.site) query.site = this.state.site;
    if (this.state.fields?.length) query.fields = this.state.fields;
    return { method: "GET", path: this.path, query };
  }

  url(): string {
    return this.client.url(this.toRequest());
  }

  get(options?: RunOptions): Promise<NavTree<PickedUnion<Page, Picked>>> {
    return this.client.run(this, options);
  }
}

/** Unpaginated list of all resources of a kind (`GET /globals`, `GET /navs`). */
export class IndexQuery<Item> implements Compilable<DataList<Item>> {
  declare readonly __result?: DataList<Item>;

  constructor(
    private readonly client: CoreClient,
    private readonly path: string,
    private readonly state: { site?: string } = {},
  ) {}

  /** Multi-site: `site=<handle>`. */
  site(handle: string): IndexQuery<Item> {
    return new IndexQuery(this.client, this.path, { ...this.state, site: handle });
  }

  toRequest(): RequestSpec {
    const query: QueryParams = {};
    if (this.state.site) query.site = this.state.site;
    return { method: "GET", path: this.path, query };
  }

  url(): string {
    return this.client.url(this.toRequest());
  }

  get(options?: RunOptions): Promise<DataList<Item>> {
    return this.client.run(this, options);
  }
}

function isPresence(v: unknown): v is PresenceCondition {
  return v === "exists" || v === "doesnt_exist";
}
