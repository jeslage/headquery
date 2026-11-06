// Codegen config: `pnpm types` writes src/cms.ts from the running playground's schema endpoint.
import { defineConfig } from "@headquery/codegen";
import { requireBaseUrl, schemaToken } from "./src/env.ts";

export default defineConfig({
  from: { baseUrl: requireBaseUrl() },
  out: "src/cms.ts",
  token: schemaToken,
});
