import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createStatamicClient } from "../src";

interface BlogEntry {
  id: string;
  title: string;
  date: string | null;
  featured: boolean | null;
  reading_time: number | null;
}

interface NavPageBase {
  id: string;
  title: string | null;
  url: string | null;
}
type LinkPage = NavPageBase & { icon: string | null; entry_id: null };
type EntryPage = Omit<BlogEntry, keyof NavPageBase> & NavPageBase & { icon: string | null; entry_id: string };

interface TestSchema {
  collections: { blog: { item: BlogEntry; filterable: "title" | "featured" } };
  taxonomies: { tags: { item: { id: string; title: string }; filterable: "title" } };
  globals: {
    settings: { handle: "settings"; site_name: string | null };
    footer: { handle: "footer"; copyright: string | null };
  };
  navigations: { main: { page: LinkPage | EntryPage } };
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
    expect(cms.collection("blog").entry("hello world").toRequest().path).toBe(
      "/collections/blog/entries/hello%20world",
    );
    expect(cms.taxonomy("tags").term("php").site("de").toRequest()).toEqual({
      method: "GET",
      path: "/taxonomies/tags/terms/php",
      query: { site: "de" },
    });
    expect(cms.global("settings").toRequest().path).toBe("/globals/settings");
  });
});

describe("navigation trees", () => {
  it("compiles max_depth, site and fields into a deterministic URL", () => {
    const a = cms.nav("main").tree().maxDepth(2).fields(["title", "url", "entry_id"]).site("de");
    const b = cms.nav("main").tree().site("de").fields(["title", "url", "entry_id"]).maxDepth(2);
    expect(a.toRequest()).toEqual({
      method: "GET",
      path: "/navs/main/tree",
      query: { max_depth: 2, site: "de", fields: ["title", "url", "entry_id"] },
    });
    expect(a.url()).toBe(b.url());
    expect(a.url()).toBe("https://cms.test/api/navs/main/tree?fields=title,url,entry_id&max_depth=2&site=de");
  });

  it("is immutable", () => {
    const base = cms.nav("main").tree();
    base.maxDepth(1);
    expect(base.toRequest().query).toEqual({});
  });

  it("types pages as links or entries, also after fields()", () => {
    type Item = Awaited<ReturnType<ReturnType<ReturnType<typeof cms.nav<"main">>["tree"]>["get"]>>["data"][number];
    expectTypeOf<Item["page"]>().toEqualTypeOf<LinkPage | EntryPage>();
    expectTypeOf<Item["children"]>().toEqualTypeOf<Item[]>();

    const picked = cms.nav("main").tree().fields(["title", "entry_id", "reading_time"]);
    type Page = Awaited<ReturnType<typeof picked.get>>["data"][number]["page"];
    // reading_time only exists on entry pages, so link pages don't get it
    expectTypeOf<Page>().toEqualTypeOf<
      Pick<LinkPage, "title" | "entry_id"> | Pick<EntryPage, "title" | "entry_id" | "reading_time">
    >();
    const page = {} as Page;
    if (page.entry_id !== null) expectTypeOf(page.reading_time).toEqualTypeOf<number | null>();

    // @ts-expect-error unknown field
    cms.nav("main").tree().fields(["nope"]);
    // @ts-expect-error unknown navigation
    cms.nav("footer");
  });
});

describe("lists", () => {
  it("builds the globals and navs list requests", () => {
    expect(cms.globals().toRequest()).toEqual({ method: "GET", path: "/globals", query: {} });
    expect(cms.globals().site("de").url()).toBe("https://cms.test/api/globals?site=de");
    expect(cms.navs().toRequest().path).toBe("/navs");
  });

  it("types globals() as a union told apart by handle", async () => {
    const { data } = await cms.globals().get();
    expectTypeOf(data).toEqualTypeOf<Array<TestSchema["globals"]["settings"] | TestSchema["globals"]["footer"]>>();
    type Nav = Awaited<ReturnType<ReturnType<typeof cms.navs>["get"]>>["data"][number];
    expectTypeOf<Nav["max_depth"]>().toEqualTypeOf<number | null>();
  });
});

describe("without a registered schema", () => {
  it("still works, loosely typed", () => {
    const loose = createStatamicClient({ baseUrl: "https://cms.test", fetch });
    const q = loose.collection("anything").entries().where("whatever", "x");
    expect(q.toRequest().query).toEqual({ "filter[whatever:is]": "x" });
    const tree = loose.nav("any").tree().fields(["title", "custom"]);
    expect(tree.toRequest().path).toBe("/navs/any/tree");
    expectTypeOf<Awaited<ReturnType<typeof tree.get>>["data"][number]["page"]>().toHaveProperty("custom");
  });
});
