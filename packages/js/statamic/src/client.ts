import { type ClientOptions, type CoreClient, createCoreClient } from "@headquery/core";
import { IndexQuery, ResourceQuery, SingleQuery, TreeQuery } from "./query";
import type { AssetContainersOf, NavInfo, RegisteredSchema, ResourceShape, StatamicSchemaShape } from "./types";

type Handle<T> = Extract<keyof T, string>;

/** `ResourceQuery` without `tree()`: taxonomies, asset containers and unstructured collections. */
export type FlatResourceQuery<Item, Filterable extends string> = Omit<ResourceQuery<Item, Filterable>, "tree">;

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
  options: ClientOptions,
): StatamicClient<S> {
  const core = createCoreClient(options);
  const seg = encodeURIComponent;
  // Asset paths keep their folder slashes, like Statamic's own `api_url`.
  const assetPath = (path: string) => path.replace(/^\/+/, "").split("/").map(seg).join("/");

  return {
    core,
    run: core.run,
    send: core.send,
    collections: ((collection: string) => {
      const base = `/collections/${seg(collection)}`;
      return new ResourceQuery(core, `${base}/entries`, seg, `${base}/tree`);
    }) as never,
    taxonomies: (taxonomy) => new ResourceQuery(core, `/taxonomies/${seg(taxonomy)}/terms`),
    assets: (container) => new ResourceQuery(core, `/assets/${seg(container)}`, assetPath),
    globals: ((handle?: string) =>
      handle === undefined
        ? new IndexQuery(core, "/globals")
        : new SingleQuery(core, `/globals/${seg(handle)}`)) as never,
    navs: ((handle?: string) =>
      handle === undefined
        ? new IndexQuery(core, "/navs")
        : { tree: () => new TreeQuery(core, `/navs/${seg(handle)}/tree`) }) as never,
  };
}
