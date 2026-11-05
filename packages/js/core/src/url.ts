import type { QueryParams, QueryValue } from "./types";

/**
 * Serialise query params deterministically so that the same logical query always
 * produces the exact same URL, regardless of builder call order. This is what makes
 * responses cacheable by browsers, CDNs and reverse proxies.
 *
 * Rules:
 * - keys are sorted (plain code-unit order)
 * - `undefined` / `null` values are dropped
 * - arrays are joined with "," in the given order (order can be meaningful, e.g. sort)
 * - keys and values are encoded with encodeURIComponent, then `[`, `]`, `:` and `,`
 *   are decoded back for readability; servers accept both forms
 */
export function serializeQuery(params: QueryParams | undefined): string {
  if (!params) return "";
  const parts: string[] = [];
  for (const key of Object.keys(params).sort()) {
    const raw = params[key];
    if (raw === undefined || raw === null) continue;
    const value = Array.isArray(raw) ? raw.map(stringify).join(",") : stringify(raw);
    parts.push(`${encode(key)}=${encode(value)}`);
  }
  return parts.join("&");
}

export function joinUrl(baseUrl: string, apiPrefix: string, path: string, query?: QueryParams): string {
  const base = baseUrl.replace(/\/+$/, "");
  const prefix = apiPrefix ? "/" + apiPrefix.replace(/^\/+|\/+$/g, "") : "";
  const p = "/" + path.replace(/^\/+/, "");
  const qs = serializeQuery(query);
  return `${base}${prefix}${p}${qs ? `?${qs}` : ""}`;
}

function stringify(v: QueryValue): string {
  return typeof v === "string" ? v : String(v);
}

function encode(s: string): string {
  return encodeURIComponent(s)
    .replace(/%5B/gi, "[")
    .replace(/%5D/gi, "]")
    .replace(/%3A/gi, ":")
    .replace(/%2C/gi, ",");
}
