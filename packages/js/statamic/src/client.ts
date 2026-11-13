import { type ClientOptions, type CoreClient, createCoreClient } from "@headquery/core";
import { IndexQuery, ResourceQuery, SingleQuery, TreeQuery } from "./query";
import type { AssetContainersOf, NavInfo, RegisteredSchema, StatamicSchemaShape } from "./types";

type Handle<T> = Extract<keyof T, string>;

export interface StatamicClient<S extends StatamicSchemaShape> {
  /** The underlying CMS-agnostic client (use for framework adapters or raw requests). */
  readonly core: CoreClient;
  readonly run: CoreClient["run"];
  readonly send: CoreClient["send"];

  /**
   * Entries of a collection: `GET /collections/{collection}/entries`, like
   * `Entry::query()->where('collection', …)`. `.find(idOrSlug)` fetches one entry
   * (`GET /collections/{collection}/entries/{idOrSlug}`).
   */
  collections<K extends Handle<S["collections"]>>(
    collection: K,
  ): ResourceQuery<S["collections"][K]["item"], S["collections"][K]["filterable"]>;

  /**
   * Terms of a taxonomy: `GET /taxonomies/{taxonomy}/terms`. `.find(slug)` fetches one term
   * (`GET /taxonomies/{taxonomy}/terms/{slug}`).
   */
  taxonomies<K extends Handle<S["taxonomies"]>>(
    taxonomy: K,
  ): ResourceQuery<S["taxonomies"][K]["item"], S["taxonomies"][K]["filterable"]>;

  /**
   * `GET /assets/{container}`, like `Asset::query()->where('container', …)`. `.find(path)` fetches
   * one asset by its path relative to the container root (`GET /assets/{container}/{path}`).
   */
  assets<K extends Handle<AssetContainersOf<S>>>(
    container: K,
  ): ResourceQuery<AssetContainersOf<S>[K]["item"], AssetContainersOf<S>[K]["filterable"]>;

  /** `GET /globals/{handle}` */
  global<K extends Handle<S["globals"]>>(handle: K): SingleQuery<S["globals"][K]>;

  /** `GET /globals`: all global sets; tell them apart by `handle`. */
  globals(): IndexQuery<S["globals"][keyof S["globals"]]>;

  /** `GET /navs/{handle}/tree` */
  navTree<K extends Handle<S["navigations"]>>(handle: K): TreeQuery<S["navigations"][K]["page"]>;

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
    collections: (collection) => new ResourceQuery(core, `/collections/${seg(collection)}/entries`),
    taxonomies: (taxonomy) => new ResourceQuery(core, `/taxonomies/${seg(taxonomy)}/terms`),
    assets: (container) => new ResourceQuery(core, `/assets/${seg(container)}`, assetPath),
    global: (handle) => new SingleQuery(core, `/globals/${seg(handle)}`),
    globals: () => new IndexQuery(core, "/globals"),
    navTree: (handle) => new TreeQuery(core, `/navs/${seg(handle)}/tree`),
    navs: () => new IndexQuery(core, "/navs"),
  };
}
