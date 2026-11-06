import { type ClientOptions, type CoreClient, createCoreClient } from "@headquery/core";
import { IndexQuery, ListQuery, SingleQuery, TreeQuery } from "./query";
import type { NavInfo, RegisteredSchema, StatamicSchemaShape } from "./types";

export interface StatamicClient<S extends StatamicSchemaShape> {
  /** The underlying CMS-agnostic client (use for framework adapters or raw requests). */
  readonly core: CoreClient;
  readonly run: CoreClient["run"];
  readonly send: CoreClient["send"];

  collection<K extends Extract<keyof S["collections"], string>>(
    handle: K,
  ): {
    /** `GET /collections/{handle}/entries` */
    entries(): ListQuery<S["collections"][K]["item"], S["collections"][K]["filterable"]>;
    /** `GET /collections/{handle}/entries/{id}` — id or slug */
    entry(idOrSlug: string): SingleQuery<S["collections"][K]["item"]>;
  };

  taxonomy<K extends Extract<keyof S["taxonomies"], string>>(
    handle: K,
  ): {
    /** `GET /taxonomies/{handle}/terms` */
    terms(): ListQuery<S["taxonomies"][K]["item"], S["taxonomies"][K]["filterable"]>;
    /** `GET /taxonomies/{handle}/terms/{slug}` */
    term(slug: string): SingleQuery<S["taxonomies"][K]["item"]>;
  };

  /** `GET /globals/{handle}` */
  global<K extends Extract<keyof S["globals"], string>>(handle: K): SingleQuery<S["globals"][K]>;

  /** `GET /globals`: all global sets; tell them apart by `handle`. */
  globals(): IndexQuery<S["globals"][keyof S["globals"]]>;

  nav<K extends Extract<keyof S["navigations"], string>>(
    handle: K,
  ): {
    /** `GET /navs/{handle}/tree` */
    tree(): TreeQuery<S["navigations"][K]["page"]>;
  };

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

  return {
    core,
    run: core.run,
    send: core.send,
    collection(handle) {
      const base = `/collections/${seg(handle)}/entries`;
      return {
        entries: () => new ListQuery(core, base),
        entry: (id: string) => new SingleQuery(core, `${base}/${seg(id)}`),
      };
    },
    taxonomy(handle) {
      const base = `/taxonomies/${seg(handle)}/terms`;
      return {
        terms: () => new ListQuery(core, base),
        term: (slug: string) => new SingleQuery(core, `${base}/${seg(slug)}`),
      };
    },
    global(handle) {
      return new SingleQuery(core, `/globals/${seg(handle)}`);
    },
    globals: () => new IndexQuery(core, "/globals"),
    nav(handle) {
      return { tree: () => new TreeQuery(core, `/navs/${seg(handle)}/tree`) };
    },
    navs: () => new IndexQuery(core, "/navs"),
  };
}
