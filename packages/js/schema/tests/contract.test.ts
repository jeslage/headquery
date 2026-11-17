import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

/**
 * Cross-language contract: the shared fixtures must validate against
 * spec/ir/schema-v1.json. The PHP package runs the same check (ContractTest.php)
 * against its own mapper output.
 */
const spec = (path: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../spec/${path}`, import.meta.url)), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: false });
(addFormats as unknown as (a: Ajv2020) => void)(ajv);
const validate = ajv.compile(spec("ir/schema-v1.json"));

describe("spec/ir/schema-v1.json", () => {
  it("accepts the Statamic fixture", () => {
    const ok = validate(spec("statamic/fixtures/schema.json"));
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it("accepts sites with name and locale only", () => {
    const base = { schemaVersion: 1, cms: { name: "statamic" }, resources: {} };
    expect(validate({ ...base, sites: { default: { name: "English", locale: "en_US" }, de: {} } })).toBe(true);
    expect(validate({ ...base, sites: { de: { url: "/de" } } })).toBe(false);
    expect(validate({ ...base, sites: ["default"] })).toBe(false);
  });

  it("accepts assetKeys as unique non-empty strings", () => {
    const base = { schemaVersion: 1, cms: { name: "statamic" }, resources: {} };
    expect(validate({ ...base, assetKeys: ["width", "focus_css"] })).toBe(true);
    expect(validate({ ...base, assetKeys: ["width", "width"] })).toBe(false);
    expect(validate({ ...base, assetKeys: [""] })).toBe(false);
  });

  it("rejects an enum field without values", () => {
    const ok = validate({
      schemaVersion: 1,
      cms: { name: "statamic" },
      resources: { collection: { blog: { blueprints: { blog: { fields: { state: { type: "enum" } } } } } } },
    });
    expect(ok).toBe(false);
  });

  it("requires blueprints on collections and taxonomies, and fields on the other kinds", () => {
    const base = { schemaVersion: 1, cms: { name: "statamic" } };
    const bp = { blueprints: { page: { title: "Page", fields: {} } } };
    expect(validate({ ...base, resources: { collection: { pages: bp }, taxonomy: { tags: bp } } })).toBe(true);
    expect(validate({ ...base, resources: { collection: { pages: { fields: {} } } } })).toBe(false);
    expect(validate({ ...base, resources: { collection: { pages: { blueprints: {} } } } })).toBe(false);
    expect(validate({ ...base, resources: { global: { settings: bp } } })).toBe(false);
  });

  it("rejects the old flat resources shape and unknown navigation properties", () => {
    const base = { schemaVersion: 1, cms: { name: "statamic" } };
    expect(validate({ ...base, resources: { blog: { kind: "collection", fields: {} } } })).toBe(false);
    expect(validate({ ...base, resources: { navigation: { main: { fields: {}, depth: 2 } } } })).toBe(false);
    expect(
      validate({ ...base, resources: { navigation: { main: { fields: {}, collections: ["blog"], maxDepth: 2 } } } }),
    ).toBe(true);
  });
});
