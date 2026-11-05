// Generates src/cms.ts from the running playground's schema endpoint.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generate, loadSchema } from "@headquery/codegen";
import { requireBaseUrl, schemaToken } from "./env";

const from = `${requireBaseUrl()}/api/headquery/schema`;
const out = fileURLToPath(new URL("./cms.ts", import.meta.url));

const schema = await loadSchema(from, { token: schemaToken });
await writeFile(out, generate(schema));
console.log(`✓ wrote ${out} from ${from}`);
