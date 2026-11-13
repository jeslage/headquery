import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertIrSchema, IrSchemaError } from "../src";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../../spec/statamic/fixtures/${name}`, import.meta.url)), "utf8"),
  );

describe("assertIrSchema", () => {
  it("accepts the shared Statamic fixture", () => {
    expect(() => assertIrSchema(fixture("schema.json"))).not.toThrow();
  });

  it("rejects unknown schema versions", () => {
    expect(() => assertIrSchema({ schemaVersion: 99, cms: { name: "x" }, resources: {} })).toThrow(IrSchemaError);
  });

  it("accepts schemas without sites and rejects malformed ones", () => {
    const base = { schemaVersion: 1, cms: { name: "x" }, resources: {} };
    expect(() => assertIrSchema(base)).not.toThrow();
    expect(() => assertIrSchema({ ...base, sites: { default: { locale: "en_US" } } })).not.toThrow();
    expect(() => assertIrSchema({ ...base, sites: ["default"] })).toThrow(/sites/);
    expect(() => assertIrSchema({ ...base, sites: { de: "de_DE" } })).toThrow(/Site "de"/);
  });

  it("rejects fields without a type", () => {
    expect(() =>
      assertIrSchema({
        schemaVersion: 1,
        cms: { name: "x" },
        resources: { collection: { blog: { fields: { title: {} } } } },
      }),
    ).toThrow(/collection\.blog\.title/);
  });

  it("rejects unknown resource kinds", () => {
    expect(() =>
      assertIrSchema({ schemaVersion: 1, cms: { name: "x" }, resources: { blog: { kind: "collection", fields: {} } } }),
    ).toThrow(/Unknown resource kind "blog"/);
  });

  it("rejects systemFilters that are not a list of handles", () => {
    expect(() =>
      assertIrSchema({
        schemaVersion: 1,
        cms: { name: "x" },
        resources: { assetContainer: { assets: { fields: {}, systemFilters: "basename" } } },
      }),
    ).toThrow(/"assetContainer\.assets" systemFilters/);
  });
});
