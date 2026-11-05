import type { Compilable, CoreClient, QueryParams, RequestSpec, RunOptions } from "@headquery/core";
import type {
  ListCondition,
  Paginated,
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

type FieldValue<Item, F extends keyof Item> = Item[F] extends Scalar | null | undefined ? Exclude<Item[F], null | undefined> : Scalar;

/**
 * Immutable list query for collection entries and taxonomy terms.
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
  where<F extends Filterable & keyof Item>(field: F, value: FieldValue<Item, F>): this;
  where<F extends Filterable & keyof Item>(field: F, condition: ScalarCondition, value: FieldValue<Item, F> | Scalar): this;
  where<F extends Filterable & keyof Item>(field: F, condition: ListCondition, values: Array<FieldValue<Item, F> | Scalar>): this;
  where<F extends Filterable & keyof Item>(field: F, condition: PresenceCondition): this;
  where(field: string, a?: unknown, b?: unknown): this {
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
  sort(...fields: Array<SortField<Extract<keyof Item, string>>>): this {
    return this.with({ sort: fields });
  }

  limit(limit: number): this {
    return this.with({ limit });
  }

  page(page: number): this {
    return this.with({ page });
  }

  /** Multi-site: `site=<handle>`. */
  site(handle: string): this {
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

  private with(patch: Partial<ListState>): this {
    const Ctor = this.constructor as new (c: CoreClient, p: string, s: ListState) => this;
    return new Ctor(this.client, this.path, { ...this.state, ...patch });
  }
}

/** Single resource (one entry, one term, one global set). */
export class SingleQuery<Item, Picked extends keyof Item = keyof Item> implements Compilable<Single<Pick<Item, Picked>>> {
  declare readonly __result?: Single<Pick<Item, Picked>>;

  constructor(
    private readonly client: CoreClient,
    private readonly path: string,
    private readonly state: { site?: string; fields?: string[] } = {},
  ) {}

  site(handle: string): SingleQuery<Item, Picked> {
    return new SingleQuery(this.client, this.path, { ...this.state, site: handle });
  }

  fields<P extends keyof Item & string>(fields: P[]): SingleQuery<Item, P> {
    return new SingleQuery<Item, P>(this.client, this.path, { ...this.state, fields });
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

  get(options?: RunOptions): Promise<Single<Pick<Item, Picked>>> {
    return this.client.run(this, options);
  }
}

function isPresence(v: unknown): v is PresenceCondition {
  return v === "exists" || v === "doesnt_exist";
}
