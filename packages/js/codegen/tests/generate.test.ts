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

  it("adds extra shallow asset keys (assetKeys) to HqAsset and HqLinkAsset", () => {
    const base = { schemaVersion: 1, cms: { name: "statamic" }, resources: {} };
    const out = generate({ ...base, assetKeys: ["width", "caption", "alt", "my-key"] });
    const expected =
      '  alt: string | null;\n  width: HqAssetBase["width"];\n  caption: unknown;\n  "my-key": unknown;\n';
    expect(out.split(expected)).toHaveLength(3);
    expect(generate(base)).not.toContain("width: HqAssetBase");
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

describe("set types", () => {
  const text = { type: "string", cmsType: "text" } as const;
  const asset = { type: "asset", multiple: false } as const;
  const collection = (fields: Record<string, unknown>) => ({ blueprints: { [Object.keys(fields)[0]!]: { fields } } });
  const gen = (resources: Record<string, unknown>) =>
    generate({ schemaVersion: 1, cms: { name: "statamic" }, resources });

  it("names sets after their handle and shares one interface between fields with the same set", () => {
    const sets = { text_image: { text, image: asset }, cta: { label: text } };
    const out = gen({
      collection: {
        pages: { blueprints: { page: { fields: { body: { type: "richtext", sets } } } } },
        blog: { blueprints: { blog: { fields: { sections: { type: "blocks", sets } } } } },
      },
    });
    expect(out.match(/export interface TextImageSet \{/g)).toHaveLength(1);
    expect(out).toContain(
      "/** Set `cta` (Replicator `blog.sections`, Bard `pages.body`). */\nexport interface CtaSet {",
    );
    expect(out).toContain("  body: Array<HqBardText | CtaSet | TextImageSet>;");
    expect(out).toContain("  sections: Array<CtaSet | TextImageSet>;");
  });

  it("names sets with the same handle but different fields after their location", () => {
    const out = gen({
      collection: {
        blog: collection({ body: { type: "richtext", sets: { image: { image: asset } } } }),
        pages: {
          blueprints: {
            page: { fields: { title: text } },
            landing: { fields: { blocks: { type: "blocks", sets: { image: { image: asset, caption: text } } } } },
          },
        },
      },
    });
    expect(out).not.toContain("interface ImageSet ");
    expect(out).toContain("export interface BlogBodyImageSet {");
    expect(out).toContain("export interface PagesLandingBlocksImageSet {");
    expect(out).toContain("  blocks: Array<PagesLandingBlocksImageSet>;");
  });

  it("names nested sets and references them from the outer set", () => {
    const out = gen({
      global: {
        settings: {
          fields: {
            footer: {
              type: "blocks",
              sets: { columns: { items: { type: "blocks", sets: { link: { label: text } } } } },
            },
          },
        },
      },
    });
    expect(out).toContain("export interface LinkSet {");
    expect(out).toContain("  items: Array<LinkSet>;");
    expect(out).toContain("  footer: Array<ColumnsSet>;");
  });

  it("rejects a set name that is also another set's location name", () => {
    expect(() =>
      gen({
        collection: {
          blog: collection({ body: { type: "richtext", sets: { image: { image: asset } } } }),
          pages: collection({
            blocks: { type: "blocks", sets: { image: { image: asset, caption: text }, blog_body_image: { text } } },
          }),
        },
      }),
    ).toThrow(/BlogBodyImageSet, which is already taken/);
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
