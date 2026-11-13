// Hints that don't depend on the CMS: network, TLS, files.
import type { SchemaLoadError } from "../../load";
import type { Hint } from "../text";
import type { Cause } from "./cause";

const origin = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
};

export function genericHint(error: SchemaLoadError, cause: Cause | undefined): Hint | undefined {
  switch (cause) {
    case "file-not-found":
      return [`${error.source} doesn't exist. Relative paths in the config resolve against the config file's folder.`];
    case "econnrefused":
      return [
        `Nothing is listening at ${origin(error.source)}. Is the CMS running? Check the host and port in HEADQUERY_BASE_URL.`,
      ];
    case "enotfound":
      return [`The host of ${origin(error.source)} doesn't resolve. Check HEADQUERY_BASE_URL for typos.`];
    case "etimedout":
      return [`${origin(error.source)} didn't answer in time. A firewall, VPN or wrong port?`];
    case "tls":
      return [
        "The connection broke during the TLS handshake. If the CMS serves plain HTTP, use http:// instead of https://.",
      ];
    default:
      return undefined;
  }
}
