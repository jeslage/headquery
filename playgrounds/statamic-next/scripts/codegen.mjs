// Generates lib/cms.ts (typed schema) from the running playground's schema endpoint.
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import { generate, loadSchema } from "@headquery/codegen";

// Same env files Next reads; real env vars win.
for (const f of [".env.local", ".env"]) {
  const path = fileURLToPath(new URL(`../${f}`, import.meta.url));
  if (existsSync(path)) process.loadEnvFile(path);
}
// Trust the OS store so DDEV's mkcert certificate works (Node ≥ 22.19).
if (tls.setDefaultCACertificates) {
  tls.setDefaultCACertificates([
    ...new Set([
      ...tls.getCACertificates("default"),
      ...tls.getCACertificates("system"),
    ]),
  ]);
}

const base = process.env.HEADQUERY_BASE_URL?.replace(/\/+$/, "");
if (!base) {
  console.error(
    "Set HEADQUERY_BASE_URL in playgrounds/statamic-next/.env.local (see .env.example).",
  );
  process.exit(1);
}
const from = `${base}/api/headquery/schema`;
const out = fileURLToPath(new URL("../lib/cms.ts", import.meta.url));
const schema = await loadSchema(from, {
  token: process.env.HEADQUERY_SCHEMA_TOKEN || "dev-schema-token",
});
await writeFile(out, generate(schema));
console.log(`✓ wrote lib/cms.ts from ${from}`);
