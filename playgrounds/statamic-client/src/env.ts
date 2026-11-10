import { existsSync } from "node:fs";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

// Trust the OS certificate store as well, so local HTTPS (DDEV's mkcert certificate) works
// without NODE_OPTIONS=--use-system-ca. Needs Node ≥ 22.19; older versions skip this.
const tlsCa = tls as typeof tls & {
  setDefaultCACertificates?: (certs: string[]) => void;
  getCACertificates?: (type: "default" | "system") => string[];
};
if (tlsCa.setDefaultCACertificates && tlsCa.getCACertificates) {
  const certs = new Set([...tlsCa.getCACertificates("default"), ...tlsCa.getCACertificates("system")]);
  tlsCa.setDefaultCACertificates([...certs]);
}

// Load playgrounds/statamic-client/.env if present; real env vars win.
const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

/** Origin of the playground, e.g. `http://127.0.0.1:8000`. Undefined when not configured. */
export const baseUrl = process.env.HEADQUERY_BASE_URL?.replace(/\/+$/, "") || undefined;
export const schemaToken = process.env.HEADQUERY_SCHEMA_TOKEN || "dev-schema-token";

export function requireBaseUrl(): string {
  if (!baseUrl) {
    console.error("Set HEADQUERY_BASE_URL (e.g. in playgrounds/statamic-client/.env, see .env.example).");
    process.exit(1);
  }
  return baseUrl;
}
