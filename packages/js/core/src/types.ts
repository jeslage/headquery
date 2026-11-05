export type QueryValue = string | number | boolean;

/** Query parameters. Arrays are joined with commas (e.g. `fields=title,date`). */
export type QueryParams = Record<string, QueryValue | QueryValue[] | undefined | null>;

/**
 * What every CMS adapter produces. The core turns it into a fetch call.
 * Keep it plain data so it can be snapshot-tested and serialised.
 */
export interface RequestSpec {
  method: "GET" | "POST";
  /** Path relative to the client's `baseUrl` + `apiPrefix`, e.g. `/collections/blog/entries`. */
  path: string;
  query?: QueryParams;
  body?: unknown;
}

/** Anything that can be compiled to a request. `TResult` is a phantom type for inference. */
export interface Compilable<TResult> {
  toRequest(): RequestSpec;
  /** Never set at runtime; only carries the result type. */
  readonly __result?: TResult;
}

export type ResultOf<Q> = Q extends Compilable<infer R> ? R : never;

export interface ClientOptions {
  /** Origin of the CMS, e.g. `https://cms.example.com`. */
  baseUrl: string;
  /** Path prefix of the CMS API, e.g. `/api`. Defaults to `/api`. */
  apiPrefix?: string;
  /** Sent as `Authorization: Bearer <token>`. */
  token?: string;
  headers?: Record<string, string>;
  /** Custom fetch (SSR frameworks, tests, polyfills). Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
  /**
   * Extra options merged into every fetch call, e.g. `{ cache: "force-cache" }`
   * or framework-specific keys like Next's `{ next: { revalidate: 60 } }`.
   */
  fetchOptions?: FetchOptions;
}

/** RequestInit plus arbitrary framework-specific keys (Next.js `next`, etc.). */
export type FetchOptions = RequestInit & Record<string, unknown>;

export interface RunOptions {
  signal?: AbortSignal;
  /** Per-call fetch options, merged over the client's `fetchOptions`. */
  fetchOptions?: FetchOptions;
}

export interface CoreClient {
  readonly options: Readonly<ClientOptions>;
  /** Build the full URL for a spec (useful for cache keys and debugging). */
  url(spec: RequestSpec): string;
  /** Send a raw request spec and parse JSON. */
  send<T = unknown>(spec: RequestSpec, options?: RunOptions): Promise<T>;
  /** Run a compiled query from any adapter. */
  run<Q extends Compilable<unknown>>(query: Q, options?: RunOptions): Promise<ResultOf<Q>>;
}
