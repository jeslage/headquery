// Codegen config: `pnpm types` (also runs before `dev` and `build`) writes lib/cms.ts
// from the running playground's schema endpoint.
import { existsSync } from "node:fs";
import tls from "node:tls";
import { defineConfig } from "@headquery/codegen";

// Same env files Next reads; real env vars win.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// Trust the OS store so DDEV's mkcert certificate works (Node ≥ 22.19; older versions skip this).
const tlsCa = tls as typeof tls & {
  setDefaultCACertificates?: (certs: string[]) => void;
  getCACertificates?: (type: "default" | "system") => string[];
};
if (tlsCa.setDefaultCACertificates && tlsCa.getCACertificates) {
  tlsCa.setDefaultCACertificates([
    ...new Set([...tlsCa.getCACertificates("default"), ...tlsCa.getCACertificates("system")]),
  ]);
}

if (!process.env.HEADQUERY_BASE_URL) {
  console.error("Set HEADQUERY_BASE_URL in playgrounds/statamic-next/.env.local (see .env.example).");
  process.exit(1);
}

export default defineConfig({
  from: { baseUrl: process.env.HEADQUERY_BASE_URL },
  out: "lib/cms.ts",
  token: process.env.HEADQUERY_SCHEMA_TOKEN || "dev-schema-token",
});
