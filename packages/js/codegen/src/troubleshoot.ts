// What `headquery generate` prints when the schema can't be loaded (bundled into dist/cli.js only).
import type { SchemaLoadError, Target } from "./index";

/**
 * Paragraphs of a hint. Entries starting with "$ " are code (commands, env lines): printed unwrapped
 * and indented, without the "$ " so they can be copied as they are.
 */
export type Hint = string[];

export interface CommonProblem {
  label: string;
  text: string;
  /** Whether this is the problem at hand. */
  matches: (error: SchemaLoadError) => boolean;
}

export interface Troubleshooting {
  /** What most likely went wrong for this error, if it's recognisable. */
  likely?: Hint;
  title: string;
  /** Common problems with this CMS, as a checklist (empty for file errors). */
  common: CommonProblem[];
}

const CERT_CODES = new Set([
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

const isCertError = (error: SchemaLoadError) => error.kind === "network" && CERT_CODES.has(error.code ?? "");
const isTlsMismatch = (error: SchemaLoadError) =>
  error.kind === "network" && /^(EPROTO|ECONNRESET|ERR_SSL_)/.test(error.code ?? "");

const origin = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
};

/** Causes that don't depend on the CMS: network, TLS, files. */
function genericCause(error: SchemaLoadError): Hint | undefined {
  const code = error.code ?? "";
  if (error.kind === "file") {
    return code === "ENOENT"
      ? [`${error.source} doesn't exist. Relative paths in the config resolve against the config file's folder.`]
      : undefined;
  }
  if (error.kind !== "network") return undefined;
  if (code === "ECONNREFUSED") {
    return [
      `Nothing is listening at ${origin(error.source)}. Is the CMS running? Check the host and port in HEADQUERY_BASE_URL.`,
    ];
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return [`The host of ${origin(error.source)} doesn't resolve. Check HEADQUERY_BASE_URL for typos.`];
  }
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return [`${origin(error.source)} didn't answer in time. A firewall, VPN or wrong port?`];
  }
  if (isTlsMismatch(error)) {
    return [
      "The connection broke during the TLS handshake. If the CMS serves plain HTTP, use http:// instead of https://.",
    ];
  }
  return undefined;
}

const statamic = (error: SchemaLoadError): Troubleshooting => {
  let likely = genericCause(error);
  if (isCertError(error)) {
    likely = [
      "Node doesn't trust the HTTPS certificate. Local Herd/Valet sites use their own CA, which is in the system keychain but not in Node's list. Let Node use the system CAs (Node ≥ 22.15):",
      "$ NODE_OPTIONS=--use-system-ca npx headquery generate",
      "or point it at the CA file (Valet: ~/.config/valet/CA/LaravelValetCASelfSigned.pem):",
      `$ NODE_EXTRA_CA_CERTS="$HOME/Library/Application Support/Herd/config/valet/CA/LaravelValetCASelfSigned.pem" npx headquery generate`,
      "or use the http:// URL.",
    ];
  } else if (error.kind === "network" && error.code === "ENOTFOUND") {
    likely?.push("*.test domains from Herd/Valet only resolve on the machine that serves them.");
  } else if (error.kind === "http" && error.status === 404) {
    likely = [
      "The schema route doesn't answer. The CMS's .env needs the schema route (without a token it stays 404) and Statamic's REST API, which is a Pro feature:",
      "$ HEADQUERY_SCHEMA_ROUTE=true",
      "$ HEADQUERY_SCHEMA_TOKEN=<same value as in the frontend>",
      "$ STATAMIC_API_ENABLED=true",
      "$ STATAMIC_PRO_ENABLED=true",
      "Then clear the cached config on the CMS:",
      "$ php artisan config:clear",
      "If you changed statamic.api.route or headquery.schema.path, set `from.apiPrefix` / `from.schemaPath` in the config.",
    ];
  } else if (error.kind === "http" && error.status === 401) {
    likely = [
      error.sentToken
        ? "The token was rejected: HEADQUERY_SCHEMA_TOKEN here doesn't match HEADQUERY_SCHEMA_TOKEN in the CMS's .env."
        : "No token was sent. Set HEADQUERY_SCHEMA_TOKEN (same value as on the CMS) in your env file, the config's `token`, or pass --token.",
    ];
  } else if (error.kind === "http" && (error.status ?? 0) >= 500) {
    likely = ["The CMS failed while exporting the schema. Check storage/logs/laravel.log on the CMS."];
  } else if (error.kind === "json" && error.source.startsWith("http")) {
    likely = [
      "That's not the schema endpoint (often an HTML page or a redirect to one). Check the base URL and the API prefix (statamic.api.route, default /api).",
    ];
  } else if (error.kind === "file" && error.code === "ENOENT") {
    likely?.push("Export it on the CMS:", "$ php please headquery:schema --out=schema.json");
  }

  return {
    ...(likely !== undefined ? { likely } : {}),
    title: "Common problems with Statamic",
    // The checklist is about the schema endpoint; file problems have their own hint.
    common:
      error.kind === "file"
        ? []
        : [
            {
              label: "404",
              text: "Schema route or REST API off: the CMS needs HEADQUERY_SCHEMA_ROUTE=true, HEADQUERY_SCHEMA_TOKEN, STATAMIC_API_ENABLED=true and STATAMIC_PRO_ENABLED=true, then `php artisan config:clear`.",
              matches: (e) => e.kind === "http" && e.status === 404,
            },
            {
              label: "401",
              text: "HEADQUERY_SCHEMA_TOKEN in the frontend is missing or differs from the CMS.",
              matches: (e) => e.kind === "http" && e.status === 401,
            },
            {
              label: "ECONNREFUSED",
              text: "The CMS isn't running, or the host, port or http/https in HEADQUERY_BASE_URL is wrong.",
              matches: (e) => e.kind === "network" && !isCertError(e),
            },
            {
              label: "Certificate",
              text: "Node doesn't trust local Herd/Valet HTTPS: NODE_OPTIONS=--use-system-ca, NODE_EXTRA_CA_CERTS or http://.",
              matches: isCertError,
            },
            {
              label: "HTML",
              text: "Not JSON: wrong base URL or API prefix (statamic.api.route).",
              matches: (e) => e.kind === "json",
            },
          ],
  };
};

const TARGETS: Record<Target, (error: SchemaLoadError) => Troubleshooting> = { statamic };

export function troubleshoot(error: SchemaLoadError, target: Target): Troubleshooting {
  return TARGETS[target](error);
}

// --- formatting ---

type Format = "red" | "yellow" | "dim" | "bold" | "cyan";
export type Style = (format: Format | Format[], text: string) => string;

/** Word-wrap `text` to `width` columns, every line indented by `indent`. */
function wrap(text: string, width: number, indent: string): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && indent.length + line.length + 1 + word.length > width) {
      lines.push(indent + line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(indent + line);
  return lines;
}

const headline = (error: SchemaLoadError) => {
  const status = `${error.status ?? ""}${error.statusText ? ` ${error.statusText}` : ""}`;
  switch (error.kind) {
    case "network":
      return `Couldn't reach the CMS${error.code ? `: ${error.code}` : ""}`;
    case "http":
      return `The schema endpoint responded ${status}`;
    case "json":
      return error.status !== undefined
        ? `The schema endpoint didn't return JSON (${status})`
        : "The schema file isn't valid JSON";
    case "file":
      return `Couldn't read the schema file${error.code ? `: ${error.code}` : ""}`;
  }
};

/** The full error report: headline, details, likely cause and checklist. */
export function formatLoadError(
  error: SchemaLoadError,
  target: Target,
  options: { width?: number; style?: Style } = {},
): string {
  const width = Math.max(60, Math.min(options.width ?? 100, 110));
  const style: Style = options.style ?? ((_, text) => text);
  const { likely, title, common } = troubleshoot(error, target);
  const http = error.status !== undefined;

  const details: [string, string][] = [
    [error.kind === "file" || (error.kind === "json" && !http) ? "File" : "URL", error.source],
    ...(http
      ? [["Status", `${error.status}${error.statusText ? ` ${error.statusText}` : ""}`] as [string, string]]
      : []),
    ...(error.contentType ? [["Type", error.contentType] as [string, string]] : []),
    ...(error.reason ? [["Error", error.reason] as [string, string]] : []),
    ...(error.kind !== "file" && error.source.startsWith("http")
      ? [["Token", error.sentToken ? "sent" : "not sent"] as [string, string]]
      : []),
    ...(error.body ? [["Response", error.body] as [string, string]] : []),
  ];
  const keyWidth = Math.max(...details.map(([key]) => key.length)) + 2;
  const out = [`${style("red", "✗")} ${style("bold", headline(error))}`, ""];
  for (const [key, value] of details) {
    const [first = "", ...rest] = wrap(value, width, " ".repeat(2 + keyWidth));
    out.push(`  ${style("dim", key.padEnd(keyWidth))}${first.trimStart()}`, ...rest);
  }

  if (likely) {
    out.push("", `  ${style("bold", "Likely cause")}`);
    for (const paragraph of likely) {
      if (paragraph.startsWith("$ ")) out.push(`      ${style("cyan", paragraph.slice(2))}`);
      else out.push(...wrap(paragraph, width, "    "));
    }
  }

  if (common.length > 0) {
    const labelWidth = Math.max(...common.map((p) => p.label.length)) + 2;
    out.push("", `  ${style("bold", title)}`);
    for (const problem of common) {
      const hit = problem.matches(error);
      const indent = " ".repeat(4 + labelWidth);
      const [first = "", ...rest] = wrap(problem.text, width, indent);
      const marker = hit ? style("yellow", "› ") : "  ";
      const label = problem.label.padEnd(labelWidth);
      const line = `  ${marker}${hit ? style(["bold", "yellow"], label) : label}${first.trimStart()}`;
      out.push(hit ? line : style("dim", line), ...rest.map((l) => (hit ? l : style("dim", l))));
    }
  }
  return out.join("\n");
}
