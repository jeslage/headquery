import { type ClientOptions, type CoreClient, createCoreClient } from "@headquery/core";
import { IndexQuery, ResourceQuery, SingleQuery, TreeQuery } from "./query";
import type {
  AssetContainersOf,
  NavInfo,
  RegisteredSchema,
  ResourceShape,
  SiteHandleOf,
  StatamicForm,
  StatamicSchemaShape,
  StatamicSite,
  StatamicUser,
} from "./types";

type Handle<T> = Extract<keyof T, string>;

export interface StatamicClientOptions<S extends StatamicSchemaShape = RegisteredSchema> extends ClientOptions {
  /**
   * Default site (`site=<handle>`) for every query that supports it: entries, terms, globals,
   * collection and nav trees. `.site()` overrides it per query. Navs, forms, users, assets and
   * `/sites` ignore `site` in Statamic, so they don't get it.
   *
   * Suggests the schema's site handles but accepts any string, so runtime values (a route param,
   * Next's `await locale()`) fit without narrowing. An unknown handle is a 404 from Statamic.
   *
   * A function (`site: () => locale()`) is called for every request instead, so the client can be
   * created once, synchronously. Its site is added when the request is sent, so it is not part of
   * `query.url()` / `toRequest()`.
   */
  site?: SiteOption<S> | (() => SiteOption<S> | Promise<SiteOption<S>>);
}

type SiteOption<S extends StatamicSchemaShape> = SiteHandleOf<S> | (string & {});

/** API paths that honor `site=`: entries, terms, globals, collection and nav trees. */
const SITE_PATH = /^\/(collections|taxonomies|globals|navs\/[^/]+\/tree)(\/|$)/;

/** Adds the lazily resolved site to every request that honors it and doesn't set one. */
function withLazySite(core: CoreClient, site: () => string | Promise<string>): CoreClient {
  const send: CoreClient["send"] = async (spec, run) =>
    core.send(
      SITE_PATH.test(spec.path) && spec.query?.site == null
        ? { ...spec, query: { ...spec.query, site: await site() } }
        : spec,
      run,
    );
  return { ...core, send, run: (query, run) => send(query.toRequest(), run) };
}

/** `ResourceQuery` without `tree()`: taxonomies, asset containers and unstructured collections. */
export type FlatResourceQuery<Item, Filterable extends string> = Omit<ResourceQuery<Item, Filterable>, "tree">;

/**
 * Users: a list query plus `find(id)`. A single user has no `fields()`, because Statamic ignores
 * `fields` there and always returns all of `StatamicUser`.
 */
export type UsersQuery = Omit<FlatResourceQuery<StatamicUser, string>, "find"> & {
  find(id: string): Omit<SingleQuery<StatamicUser, keyof StatamicUser, true>, "fields">;
};

/** Query on one collection; `tree()` only exists for structured collections. */
export type CollectionQuery<R extends ResourceShape> = R extends { tree: infer Page }
  ? ResourceQuery<R["item"], R["filterable"], Page>
  : FlatResourceQuery<R["item"], R["filterable"]>;

export interface StatamicClient<S extends StatamicSchemaShape> {
  /** The underlying CMS-agnostic client (use for framework adapters or raw requests). */
  readonly core: CoreClient;
  readonly run: CoreClient["run"];
  readonly send: CoreClient["send"];

  /**
   * Entries of a collection: `GET /collections/{collection}/entries`, like
   * `Entry::query()->where('collection', …)`. `.find(idOrSlug)` fetches one entry
   * (`GET /collections/{collection}/entries/{idOrSlug}`), `.tree()` the page tree of a
   * structured collection (`GET /collections/{collection}/tree`).
   */
  collections<K extends Handle<S["collections"]>>(collection: K): CollectionQuery<S["collections"][K]>;

  /**
   * Terms of a taxonomy: `GET /taxonomies/{taxonomy}/terms`. `.find(slug)` fetches one term
   * (`GET /taxonomies/{taxonomy}/terms/{slug}`).
   */
  taxonomies<K extends Handle<S["taxonomies"]>>(
    taxonomy: K,
  ): FlatResourceQuery<S["taxonomies"][K]["item"], S["taxonomies"][K]["filterable"]>;

  /**
   * `GET /assets/{container}`, like `Asset::query()->where('container', …)`. `.find(path)` fetches
   * one asset by its path relative to the container root (`GET /assets/{container}/{path}`).
   */
  assets<K extends Handle<AssetContainersOf<S>>>(
    container: K,
  ): FlatResourceQuery<AssetContainersOf<S>[K]["item"], AssetContainersOf<S>[K]["filterable"]>;

  /** `GET /globals/{handle}`: one global set. Throws on 404 (a missing set is a config error). */
  globals<K extends Handle<S["globals"]>>(handle: K): SingleQuery<S["globals"][K]>;
  /** `GET /globals`: all global sets; tell them apart by `handle`. */
  globals(): IndexQuery<S["globals"][keyof S["globals"]]>;

  /** `GET /forms/{handle}`: one form with its fields. Throws on 404 (a missing form is a config error). */
  forms(handle: string): SingleQuery<StatamicForm>;
  /** `GET /forms`: all forms enabled in `resources.forms`. */
  forms(): IndexQuery<StatamicForm>;

  /** `GET /sites`: all sites (handle, name, locale, url). Off unless `resources.sites` is enabled. */
  sites(): IndexQuery<StatamicSite>;

  /**
   * Users: `GET /users`, filterable with `resources.users.allowed_filters` (also on fields the
   * API doesn't return, like `roles`). `.find(id)` fetches one user (`GET /users/{id}`) or `null`.
   */
  users(): UsersQuery;

  /** One navigation; `.tree()` fetches its page tree (`GET /navs/{handle}/tree`). */
  navs<K extends Handle<S["navigations"]>>(handle: K): { tree(): TreeQuery<S["navigations"][K]["page"]> };
  /** `GET /navs`: all navigations (handle, title, max depth). */
  navs(): IndexQuery<NavInfo>;
}

/**
 * Create a Statamic REST client.
 *
 * Types come from the registered schema (see `@headquery/codegen`), or pass one explicitly:
 * `createStatamicClient<Schema>({ ... })`.
 */
export function createStatamicClient<S extends StatamicSchemaShape = RegisteredSchema>(
  options: StatamicClientOptions<S>,
): StatamicClient<S> {
  const lazy = typeof options.site === "function" ? options.site : undefined;
  const site = lazy ? undefined : (options.site as string | undefined);
  const core = lazy ? withLazySite(createCoreClient(options), lazy) : createCoreClient(options);
  const seg = encodeURIComponent;
  // Asset paths keep their folder slashes, like Statamic's own `api_url`.
  const assetPath = (path: string) => path.replace(/^\/+/, "").split("/").map(seg).join("/");
  // `globals()` / `forms()`: the list without a handle, one item with it.
  const listOrOne = (path: string, state?: { site?: string }) => (handle?: string) =>
    handle === undefined ? new IndexQuery(core, path, state) : new SingleQuery(core, `${path}/${seg(handle)}`, state);

  return {
    core,
    run: core.run,
    send: core.send,
    collections: ((collection: string) => {
      const base = `/collections/${seg(collection)}`;
      return new ResourceQuery(core, `${base}/entries`, seg, `${base}/tree`, site);
    }) as never,
    taxonomies: (taxonomy) => new ResourceQuery(core, `/taxonomies/${seg(taxonomy)}/terms`, seg, undefined, site),
    assets: (container) => new ResourceQuery(core, `/assets/${seg(container)}`, assetPath),
    globals: listOrOne("/globals", { site }) as never,
    users: () => new ResourceQuery(core, "/users"),
    forms: listOrOne("/forms") as never,
    sites: () => new IndexQuery(core, "/sites"),
    navs: ((handle?: string) =>
      handle === undefined
        ? new IndexQuery(core, "/navs")
        : { tree: () => new TreeQuery(core, `/navs/${seg(handle)}/tree`, { filters: {}, site }) }) as never,
  };
}
