import { isUrl } from "./url";

export interface LoadOptions {
  token?: string;
  fetch?: typeof fetch;
}

/** Why `loadSchema()` failed: CMS not reachable, HTTP error, not JSON, or the file couldn't be read. */
export class SchemaLoadError extends Error {
  override readonly name = "SchemaLoadError";
  readonly kind: "network" | "http" | "json" | "file";
  /** URL or file path that was loaded. */
  readonly source: string;
  /** HTTP status and status text (kinds "http" and "json"). */
  readonly status?: number;
  readonly statusText?: string;
  /** Response content type and the start of the body, whitespace collapsed (kinds "http" and "json"). */
  readonly contentType?: string;
  readonly body?: string;
  /** System error code, e.g. ECONNREFUSED or SELF_SIGNED_CERT_IN_CHAIN, and its message (kinds "network" and "file"). */
  readonly code?: string;
  readonly reason?: string;
  /** Whether a bearer token was sent. */
  readonly sentToken: boolean;

  constructor(
    message: string,
    details: {
      kind: SchemaLoadError["kind"];
      source: string;
      status?: number;
      statusText?: string;
      contentType?: string;
      body?: string;
      code?: string;
      reason?: string;
      sentToken?: boolean;
    },
    options?: { cause?: unknown },
  ) {
    super(`headquery codegen: ${message}`, options);
    this.kind = details.kind;
    this.source = details.source;
    for (const key of ["status", "statusText", "contentType", "body", "code", "reason"] as const) {
      if (details[key] !== undefined) Object.assign(this, { [key]: details[key] });
    }
    this.sentToken = details.sentToken ?? false;
  }
}

/** Load a schema from a URL (http/https) or a local JSON file. Throws `SchemaLoadError`. */
export function loadSchema(from: string, options: LoadOptions = {}): Promise<unknown> {
  return isUrl(from) ? fetchSchema(from, options) : readSchemaFile(from);
}

async function fetchSchema(url: string, options: LoadOptions): Promise<unknown> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const base = { source: url, sentToken: Boolean(options.token) };

  let res: Response;
  try {
    res = await doFetch(url, { headers });
  } catch (error) {
    const { code, message } = rootCause(error);
    throw new SchemaLoadError(
      `couldn't reach ${url}: ${message}`,
      { ...base, kind: "network", reason: message, ...(code !== undefined ? { code } : {}) },
      { cause: error },
    );
  }

  const body = await res.text().catch(() => "");
  const response = {
    ...base,
    status: res.status,
    ...(res.statusText ? { statusText: res.statusText } : {}),
    ...(res.headers.get("content-type") ? { contentType: res.headers.get("content-type")! } : {}),
    ...(body.trim() ? { body: excerpt(body) } : {}),
  };
  if (!res.ok) {
    const status = `${res.status}${res.statusText ? ` ${res.statusText}` : ""}`;
    throw new SchemaLoadError(`${url} responded ${status}`, { ...response, kind: "http" });
  }
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new SchemaLoadError(
      `${url} didn't return JSON (${response.contentType ?? "no content type"})`,
      { ...response, kind: "json" },
      { cause: error },
    );
  }
}

async function readSchemaFile(path: string): Promise<unknown> {
  const { readFile } = await import("node:fs/promises");
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    const { code, message } = rootCause(error);
    throw new SchemaLoadError(
      `couldn't read ${path}: ${message}`,
      { source: path, kind: "file", reason: message, ...(code !== undefined ? { code } : {}) },
      { cause: error },
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new SchemaLoadError(
      `${path} isn't valid JSON: ${(error as Error).message}`,
      { source: path, kind: "json" },
      { cause: error },
    );
  }
}

/** Start of a response body on one line, for error messages. */
const excerpt = (body: string, max = 200) => {
  const text = body.trim().replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

type SystemError = { code?: unknown; message?: unknown; errors?: unknown; cause?: unknown };

/** Code and message of the system error behind fetch's generic "fetch failed". */
function rootCause(error: unknown): { code?: string; message: string } {
  let current = error as SystemError | undefined;
  // undici: TypeError("fetch failed") → cause (Error or AggregateError of per-address errors)
  while (current?.cause) current = current.cause as SystemError;
  if (Array.isArray(current?.errors) && current.errors.length > 0) current = current.errors[0] as SystemError;
  const code = typeof current?.code === "string" ? current.code : undefined;
  let message = typeof current?.message === "string" && current.message ? current.message : String(error);
  // OpenSSL errors are multi-line internals ("…:SSL routines:…:packet length too long:…"); the code says it all.
  if (code?.startsWith("ERR_SSL_")) message = `TLS error ${code}`;
  return { ...(code !== undefined ? { code } : {}), message };
}
