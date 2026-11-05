import { createStatamicClient } from "@headquery/statamic";
// Registers the generated schema (module augmentation). Run `pnpm types` to (re)create it.
import type {} from "./cms";
import { baseUrl } from "./env";

/** Client for the playground. Fully typed once `src/cms.ts` has been generated. */
export const cms = createStatamicClient({ baseUrl: baseUrl ?? "http://127.0.0.1:8000" });
