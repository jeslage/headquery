import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createStatamicClient, HeadqueryHttpError } from "../src";

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
  assetContainers: { images: { item: ImageAsset; filterable: "alt" | "basename" } };
}

interface ImageAsset {
  id: string;
  path: string;
  basename: string;
  width: number | null;
  alt: string | null;
}

/** A schema generated before asset support (no `assetContainers`). */
type LegacySchema = Omit<TestSchema, "assetContainers">;

const fetch = vi.fn(async () => new Response(JSON.stringify({ data: [], links: {}, meta: {} })));
const cms = createStatamicClient<TestSchema>({ baseUrl: "https://cms.test", fetch });

describe("collection entries", () => {
  it("compiles filters, sort, pagination and fields", () => {
    const q = cms
      .collections("blog")
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
    const a = cms.collections("blog").limit(5).where("title", "is", "x").sort("-date");
    const b = cms.collections("blog").sort("-date").where("title", "is", "x").limit(5);
    expect(a.url()).toBe(b.url());
    expect(a.url()).toBe("https://cms.test/api/collections/blog/entries?filter[title:is]=x&limit=5&sort=-date");
  });

  it("is immutable", () => {
    const base = cms.collections("blog");
    base.limit(3);
    expect(base.toRequest().query).toEqual({});
  });

  it("serialises list and presence conditions", () => {
    const q = cms.collections("blog").where("title", "in", ["a", "b"]).where("featured", "exists");
    expect(q.toRequest().query).toEqual({ "filter[title:in]": "a|b", "filter[featured:exists]": "true" });
  });

  it("narrows result types via fields()", () => {
    const q = cms.collections("blog").fields(["title"]);
    expectTypeOf(q.get).returns.resolves.toEqualTypeOf<{
      data: Array<Pick<BlogEntry, "title">>;
      links: import("../src").PaginationLinks;
      meta: import("../src").PaginationMeta;
    }>();
  });

  it("rejects non-filterable fields and unknown collections at compile time", () => {
    // @ts-expect-error reading_time is not in allowed_filters
    cms.collections("blog").where("reading_time", 3);
    // @ts-expect-error unknown collection
    cms.collections("nope");
  });
});

describe("single resources", () => {
  it("builds entry, term and global paths", () => {
    expect(cms.collections("blog").find("hello world").toRequest().path).toBe(
      "/collections/blog/entries/hello%20world",
    );
    expect(cms.taxonomies("tags").find("php").site("de").toRequest()).toEqual({
      method: "GET",
      path: "/taxonomies/tags/terms/php",
      query: { site: "de" },
    });
    expect(cms.global("settings").toRequest().path).toBe("/globals/settings");
  });
});

describe("find()", () => {
  const status = (code: number) =>
    createStatamicClient<TestSchema>({
      baseUrl: "https://cms.test",
      fetch: async () => new Response(JSON.stringify({ message: "x" }), { status: code }),
    });

  it("resolves to the item, or null on 404", async () => {
    const found = await cms.collections("blog").find("hello").get();
    expectTypeOf(found).toEqualTypeOf<{ data: BlogEntry } | null>();
    expect(found).not.toBeNull();
    expect(await status(404).collections("blog").find("missing").get()).toBeNull();
    expect(await status(404).assets("images").find("missing.jpg").fields(["path"]).get()).toBeNull();
  });

  it("still throws other HTTP errors", async () => {
    await expect(status(500).taxonomies("tags").find("php").get()).rejects.toBeInstanceOf(HeadqueryHttpError);
  });

  it("keeps global() throwing on 404", async () => {
    await expect(status(404).global("settings").get()).rejects.toBeInstanceOf(HeadqueryHttpError);
    expectTypeOf(cms.global("settings").get).returns.resolves.not.toBeNullable();
  });

  it("is only offered before list options, which it would ignore", () => {
    const blog = cms.collections("blog");
    expect(blog.find("x").fields(["title"]).toRequest()).toEqual({
      method: "GET",
      path: "/collections/blog/entries/x",
      query: { fields: ["title"] },
    });
    // @ts-expect-error find() would drop the filter
    blog.where("featured", true).find;
    // @ts-expect-error find() would drop the sort
    blog.sort("-date").find;
    expect("find" in blog.where("featured", true)).toBe(false);
  });
});

describe("navigation trees", () => {
  it("compiles max_depth, site and fields into a deterministic URL", () => {
    const a = cms.navTree("main").maxDepth(2).fields(["title", "url", "entry_id"]).site("de");
    const b = cms.navTree("main").site("de").fields(["title", "url", "entry_id"]).maxDepth(2);
    expect(a.toRequest()).toEqual({
      method: "GET",
      path: "/navs/main/tree",
      query: { max_depth: 2, site: "de", fields: ["title", "url", "entry_id"] },
    });
    expect(a.url()).toBe(b.url());
    expect(a.url()).toBe("https://cms.test/api/navs/main/tree?fields=title,url,entry_id&max_depth=2&site=de");
  });

  it("is immutable", () => {
    const base = cms.navTree("main");
    base.maxDepth(1);
    expect(base.toRequest().query).toEqual({});
  });

  it("types pages as links or entries, also after fields()", () => {
    type Item = Awaited<ReturnType<ReturnType<typeof cms.navTree<"main">>["get"]>>["data"][number];
    expectTypeOf<Item["page"]>().toEqualTypeOf<LinkPage | EntryPage>();
    expectTypeOf<Item["children"]>().toEqualTypeOf<Item[]>();

    const picked = cms.navTree("main").fields(["title", "entry_id", "reading_time"]);
    type Page = Awaited<ReturnType<typeof picked.get>>["data"][number]["page"];
    // reading_time only exists on entry pages, so link pages don't get it
    expectTypeOf<Page>().toEqualTypeOf<
      Pick<LinkPage, "title" | "entry_id"> | Pick<EntryPage, "title" | "entry_id" | "reading_time">
    >();
    const page = {} as Page;
    if (page.entry_id !== null) expectTypeOf(page.reading_time).toEqualTypeOf<number | null>();

    // @ts-expect-error unknown field
    cms.navTree("main").fields(["nope"]);
    // @ts-expect-error unknown navigation
    cms.navTree("footer");
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

describe("assets", () => {
  it("compiles a filtered asset list like entries", () => {
    const q = cms.assets("images").where("basename", "hero.jpg").sort("-basename").fields(["path", "alt"]);
    expect(q.toRequest()).toEqual({
      method: "GET",
      path: "/assets/images",
      query: { "filter[basename:is]": "hero.jpg", sort: ["-basename"], fields: ["path", "alt"] },
    });
    expect(q.limit(1).page(1).url()).toBe(
      "https://cms.test/api/assets/images?fields=path,alt&filter[basename:is]=hero.jpg&limit=1&page=1&sort=-basename",
    );
  });

  it("fetches one asset by path, keeping folder slashes", () => {
    expect(cms.assets("images").find("hero.jpg").toRequest().path).toBe("/assets/images/hero.jpg");
    expect(cms.assets("images").find("/2026/my photo#1.jpg").fields(["path"]).url()).toBe(
      "https://cms.test/api/assets/images/2026/my%20photo%231.jpg?fields=path",
    );
  });

  it("types assets from the schema", async () => {
    const { data } = (await cms.assets("images").find("hero.jpg").get())!;
    expectTypeOf(data).toEqualTypeOf<ImageAsset>();
    const first = await cms.assets("images").fields(["path", "width"]).first();
    expectTypeOf(first).toEqualTypeOf<Pick<ImageAsset, "path" | "width"> | null>();

    // @ts-expect-error width is not in allowed_filters
    cms.assets("images").where("width", 100);
    // @ts-expect-error unknown container
    cms.assets("videos");
  });

  it("stays loosely typed for schemas without asset containers", () => {
    const legacy = createStatamicClient<LegacySchema>({ baseUrl: "https://cms.test", fetch });
    const q = legacy.assets("anything").where("folder", "2026");
    expect(q.toRequest().path).toBe("/assets/anything");
    expectTypeOf<Awaited<ReturnType<typeof q.get>>["data"][number]>().toHaveProperty("path");
  });
});

describe("without a registered schema", () => {
  it("still works, loosely typed", () => {
    const loose = createStatamicClient({ baseUrl: "https://cms.test", fetch });
    const q = loose.collections("anything").where("whatever", "x");
    expect(q.toRequest().query).toEqual({ "filter[whatever:is]": "x" });
    const tree = loose.navTree("any").fields(["title", "custom"]);
    expect(tree.toRequest().path).toBe("/navs/any/tree");
    expectTypeOf<Awaited<ReturnType<typeof tree.get>>["data"][number]["page"]>().toHaveProperty("custom");
  });
});
