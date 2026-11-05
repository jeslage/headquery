import { HeadqueryHttpError, HeadqueryNetworkError } from "./errors";
import type { ClientOptions, Compilable, CoreClient, FetchOptions, RequestSpec, ResultOf, RunOptions } from "./types";
import { joinUrl } from "./url";

export function createCoreClient(options: ClientOptions): CoreClient {
  const opts: ClientOptions = { apiPrefix: "/api", ...options };
  const doFetch = opts.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function") {
    throw new Error("headquery: no fetch implementation found. Pass `fetch` in the client options.");
  }

  const url = (spec: RequestSpec) => joinUrl(opts.baseUrl, opts.apiPrefix ?? "", spec.path, spec.query);

  async function send<T>(spec: RequestSpec, run?: RunOptions): Promise<T> {
    const target = url(spec);
    const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (spec.body !== undefined) headers["Content-Type"] = "application/json";

    const init: FetchOptions = {
      ...opts.fetchOptions,
      ...run?.fetchOptions,
      method: spec.method,
      headers: { ...headers, ...toRecord(opts.fetchOptions?.headers), ...toRecord(run?.fetchOptions?.headers) },
    };
    if (spec.body !== undefined) init.body = JSON.stringify(spec.body);
    if (run?.signal) init.signal = run.signal;

    let res: Response;
    try {
      res = await doFetch(target, init);
    } catch (cause) {
      throw new HeadqueryNetworkError(target, cause);
    }

    const text = await res.text();
    const body = parseJson(text);

    if (!res.ok) throw new HeadqueryHttpError(res.status, target, body ?? text);
    if (body === undefined && text.length > 0) {
      throw new HeadqueryNetworkError(target, new Error("Response was not valid JSON"));
    }
    return body as T;
  }

  return {
    options: opts,
    url,
    send,
    run<Q extends Compilable<unknown>>(query: Q, run?: RunOptions) {
      return send<ResultOf<Q>>(query.toRequest(), run);
    },
  };
}

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toRecord(h: HeadersInit | undefined): Record<string, string> {
  if (!h) return {};
  if (typeof Headers !== "undefined" && h instanceof Headers) return Object.fromEntries(h.entries());
  if (Array.isArray(h)) return Object.fromEntries(h);
  return h as Record<string, string>;
}
