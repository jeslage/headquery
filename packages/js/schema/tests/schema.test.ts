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
});
