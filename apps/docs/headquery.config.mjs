// Types for the twoslash snippets, generated from the shared test fixture.
import { defineConfig } from "@headquery/codegen";

export default defineConfig({
  from: "../../spec/statamic/fixtures/schema.json",
  out: "generated/cms.generated.ts",
});
