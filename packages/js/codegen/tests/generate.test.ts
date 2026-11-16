import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fieldType, generate, pascal } from "../src";

const schema = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../../spec/statamic/fixtures/schema.json", import.meta.url)), "utf8"),
);

describe("generate (statamic)", () => {
  it("matches the committed snapshot", async () => {
    // The snapshot is also imported by usage.test.ts, which type-checks it against @headquery/statamic.
    await expect(generate(schema)).toMatchFileSnapshot("./__generated__/statamic.ts");
  });

  it("rejects invalid schemas", () => {
    expect(() => generate({ schemaVersion: 2 })).toThrow(/schemaVersion/);
  });

  it("emits site handles in the CMS's order, and none for schemas without sites", () => {
    const base = { schemaVersion: 1, cms: { name: "statamic" }, resources: {} };
    expect(generate({ ...base, sites: { fr: {}, default: { locale: "en_US" } } })).toContain(
      '  /** Site handles for `.site()`: fr, default (en_US). */\n  sites: "fr" | "default";\n',
    );
    expect(generate(base)).not.toContain("sites:");
    expect(generate({ ...base, sites: {} })).not.toContain("sites:");
  });

  it("merges the blueprints of a taxonomy: fields of some blueprints are optional, types combined", () => {
    const out = generate({
      schemaVersion: 1,
      cms: { name: "statamic" },
      resources: {
        taxonomy: {
          topics: {
            blueprints: {
              topic: { fields: { color: { type: "string" }, rank: { type: "number" } } },
              special: { fields: { color: { type: "string" }, rank: { type: "string" }, badge: { type: "boolean" } } },
            },
          },
        },
      },
    });
    expect(out).toContain("  badge?: boolean;\n");
    expect(out).toContain("  color: string | null;\n");
    expect(out).toContain("  rank: number | string | null;\n");
  });

  it("rejects blueprint type names that clash with another collection", () => {
    const blueprints = (...handles: string[]) => ({
      blueprints: Object.fromEntries(handles.map((h) => [h, { fields: {} }])),
    });
    expect(() =>
      generate({
        schemaVersion: 1,
        cms: { name: "statamic" },
        resources: { collection: { pages: blueprints("page", "landing"), pages_landing: blueprints("x") } },
      }),
    ).toThrow(/PagesLandingEntry/);
  });
});

describe("fieldType", () => {
  it("adds null for optional single values but not for lists", () => {
    expect(fieldType({ type: "string" })).toBe("string | null");
    expect(fieldType({ type: "string", required: true })).toBe("string");
    expect(fieldType({ type: "asset", multiple: true })).toBe("Array<HqAsset>");
    expect(fieldType({ type: "asset", multiple: false })).toBe("HqAsset | null");
  });

  it("matches Statamic's augmented values", () => {
    // select returns { key, value, label }, or the same object with nulls when empty
    expect(fieldType({ type: "enum", values: ["a", "b"] })).toBe('HqOption<"a" | "b"> | HqEmptyOption');
    expect(fieldType({ type: "enum", values: ["a"], required: true })).toBe('HqOption<"a">');
    expect(fieldType({ type: "enum", values: ["a"], multiple: true })).toBe('Array<HqOption<"a">>');
    // toggle is cast to bool
    expect(fieldType({ type: "boolean" })).toBe("boolean");
    // grid returns [] when empty, list/taggable/table return null
    const strings = { type: "string" } as const;
    expect(fieldType({ type: "array", items: strings, cmsType: "grid" })).toBe("Array<string>");
    expect(fieldType({ type: "array", items: strings, cmsType: "list" })).toBe("Array<string> | null");
  });
});

describe("pascal", () => {
  it("converts handles", () => {
    expect(pascal("blog_posts")).toBe("BlogPosts");
    expect(pascal("2024-events")).toBe("_2024Events");
  });
});
