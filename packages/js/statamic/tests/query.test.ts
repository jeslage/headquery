import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createStatamicClient } from "../src";

interface BlogEntry {
  id: string;
  title: string;
  date: string | null;
  featured: boolean | null;
  reading_time: number | null;
}

interface TestSchema {
  collections: { blog: { item: BlogEntry; filterable: "title" | "featured" } };
  taxonomies: { tags: { item: { id: string; title: string }; filterable: "title" } };
  globals: { settings: { site_name: string | null } };
}

const fetch = vi.fn(async () => new Response(JSON.stringify({ data: [], links: {}, meta: {} })));
const cms = createStatamicClient<TestSchema>({ baseUrl: "https://cms.test", fetch });

describe("collection entries", () => {
  it("compiles filters, sort, pagination and fields", () => {
    const q = cms
      .collection("blog")
      .entries()
      .where("title", "contains", "monorepo")
      .where("featured", true)
      .sort("-date", "title")
      .limit(10)
      .page(2)
      .fields(["title", "date"]);

    expect(q.toRequest()).toEqual({
      method: "GET",
      path: "/collections/blog/entries",
      query: {
        "filter[title:contains]": "monorepo",
        "filter[featured:is]": "true",
        sort: ["-date", "title"],
        limit: 10,
        page: 2,
        fields: ["title", "date"],
      },
    });
  });

  it("produces the same URL regardless of call order", () => {
    const a = cms.collection("blog").entries().limit(5).where("title", "is", "x").sort("-date");
    const b = cms.collection("blog").entries().sort("-date").where("title", "is", "x").limit(5);
    expect(a.url()).toBe(b.url());
    expect(a.url()).toBe("https://cms.test/api/collections/blog/entries?filter[title:is]=x&limit=5&sort=-date");
  });

  it("is immutable", () => {
    const base = cms.collection("blog").entries();
    base.limit(3);
    expect(base.toRequest().query).toEqual({});
  });

  it("serialises list and presence conditions", () => {
    const q = cms.collection("blog").entries().where("title", "in", ["a", "b"]).where("featured", "exists");
    expect(q.toRequest().query).toEqual({ "filter[title:in]": "a|b", "filter[featured:exists]": "true" });
  });

  it("narrows result types via fields()", () => {
    const q = cms.collection("blog").entries().fields(["title"]);
    expectTypeOf(q.get).returns.resolves.toEqualTypeOf<{
      data: Array<Pick<BlogEntry, "title">>;
      links: import("../src").PaginationLinks;
      meta: import("../src").PaginationMeta;
    }>();
  });

  it("rejects non-filterable fields and unknown collections at compile time", () => {
    // @ts-expect-error reading_time is not in allowed_filters
    cms.collection("blog").entries().where("reading_time", 3);
    // @ts-expect-error unknown collection
    cms.collection("nope");
  });
});

describe("single resources", () => {
  it("builds entry, term and global paths", () => {
    expect(cms.collection("blog").entry("hello world").toRequest().path).toBe("/collections/blog/entries/hello%20world");
    expect(cms.taxonomy("tags").term("php").site("de").toRequest()).toEqual({
      method: "GET",
      path: "/taxonomies/tags/terms/php",
      query: { site: "de" },
    });
    expect(cms.global("settings").toRequest().path).toBe("/globals/settings");
  });
});

describe("without a registered schema", () => {
  it("still works, loosely typed", () => {
    const loose = createStatamicClient({ baseUrl: "https://cms.test", fetch });
    const q = loose.collection("anything").entries().where("whatever", "x");
    expect(q.toRequest().query).toEqual({ "filter[whatever:is]": "x" });
  });
});
