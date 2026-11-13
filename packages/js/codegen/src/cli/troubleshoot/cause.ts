import type { SchemaLoadError } from "../../load";

/**
 * A known reason why the schema couldn't be loaded. Each one is also the heading ID of its section
 * in the CMS's troubleshooting docs (e.g. `/cms/statamic/troubleshooting#401-unauthorized`).
 */
export type Cause =
  | "404-not-found"
  | "401-unauthorized"
  | "500-internal-server-error"
  | "econnrefused"
  | "enotfound"
  | "etimedout"
  | "certificate"
  | "tls"
  | "not-json"
  | "file-not-found";

const CERT_CODES = new Set([
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

/** Which known problem `error` is, if any. */
export function causeOf(error: SchemaLoadError): Cause | undefined {
  const code = error.code ?? "";
  switch (error.kind) {
    case "network":
      if (CERT_CODES.has(code)) return "certificate";
      if (code === "ECONNREFUSED") return "econnrefused";
      if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "enotfound";
      if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") return "etimedout";
      if (/^(EPROTO|ECONNRESET|ERR_SSL_)/.test(code)) return "tls";
      return undefined;
    case "http":
      if (error.status === 404) return "404-not-found";
      if (error.status === 401) return "401-unauthorized";
      if ((error.status ?? 0) >= 500) return "500-internal-server-error";
      return undefined;
    case "json":
      // Only responses; an invalid local file has no section.
      return error.status !== undefined ? "not-json" : undefined;
    case "file":
      return code === "ENOENT" ? "file-not-found" : undefined;
  }
}
