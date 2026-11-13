import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createStatamicClient,
  HeadqueryHttpError,
  type SiteHandle,
  type StatamicForm,
  type StatamicSite,
  type StatamicUser,
} from "../src";

interface BlogEntry {
  id: string;
  title: string;
  date: string | null;
  featured: boolean | null;
  reading_time: number | null;
  tags: Array<{ slug: string }>;
  website: string | null;
}

interface NavPageBase {
  id: string;
  title: string | null;
  url: string | null;
}
type LinkPage = NavPageBase & { icon: string | null; entry_id: null };
type EntryPage = Omit<BlogEntry, keyof NavPageBase> & NavPageBase & { icon: string | null; entry_id: string };

interface TestSchema {
  collections: {
    blog: { item: BlogEntry; filterable: "title" | "featured" | "date" | "tags" | "website" | "taxonomy:tags" };
    pages: { item: PageEntry; filterable: "title"; tree: PageEntry & { entry_id: string } };
  };
  taxonomies: { tags: { item: { id: string; title: string }; filterable: "title" } };
  globals: {
    settings: { handle: "settings"; site_name: string | null };
    footer: { handle: "footer"; copyright: string | null };
  };
  navigations: { main: { page: LinkPage | EntryPage } };
  assetContainers: { images: { item: ImageAsset; filterable: "alt" | "basename" } };
}

interface PageEntry {
  id: string;
  title: string;
  summary: string | null;
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
    expect(cms.globals("settings").toRequest().path).toBe("/globals/settings");
  });
});

describe("conditions", () => {
  const blog = cms.collections("blog");
  const query = (q: { toRequest(): { query?: unknown } }) => q.toRequest().query;

  it("sends boolean conditions without a value as true, and accepts false", () => {
    expect(query(blog.where("date", "is_future"))).toEqual({ "filter[date:is_future]": "true" });
    expect(query(blog.where("website", "is_url", false))).toEqual({ "filter[website:is_url]": "false" });
    expect(query(blog.where("title", "is_alpha"))).toEqual({ "filter[title:is_alpha]": "true" });
  });

  it("serialises dates, regex and array conditions", () => {
    expect(query(blog.where("date", "is_after", new Date("2026-10-10T00:00:00Z")))).toEqual({
      "filter[date:is_after]": "2026-10-10T00:00:00.000Z",
    });
    expect(query(blog.where("date", "is_before", "2026-10-10"))).toEqual({ "filter[date:is_before]": "2026-10-10" });
    expect(query(blog.where("title", "matches", "^Hello"))).toEqual({ "filter[title:matches]": "^Hello" });
    expect(query(blog.where("tags", "overlaps", ["php", "javascript"]))).toEqual({
      "filter[tags:overlaps]": "php|javascript",
    });
  });

  it("works on collection trees too", () => {
    expect(query(cms.collections("pages").tree().where("title", "matches", "^A"))).toEqual({
      "filter[title:matches]": "^A",
    });
  });

  it("rejects wrong condition shapes at compile time", () => {
    // @ts-expect-error overlaps takes a list
    blog.where("tags", "overlaps", "php");
    // @ts-expect-error boolean conditions take a boolean
    blog.where("website", "is_url", "yes");
  });
});

describe("taxonomy filters", () => {
  const blog = cms.collections("blog");

  it("compiles any, not and all (merged) with comma-separated terms", () => {
    const q = blog
      .whereTaxonomyIn("tags", ["php", "statamic"])
      .whereTaxonomyNotIn("tags", ["drafts"])
      .whereTaxonomy("tags", "javascript")
      .whereTaxonomy("tags", ["statamic", "vue"]);
    expect(q.toRequest().query).toEqual({
      "filter[taxonomy:tags:any]": "php,statamic",
      "filter[taxonomy:tags:not]": "drafts",
      "filter[taxonomy:tags:all]": "javascript,statamic,vue",
    });
    expect(blog.whereTaxonomyIn("tags", ["php"]).url()).toBe(
      "https://cms.test/api/collections/blog/entries?filter[taxonomy:tags:any]=php",
    );
  });

  it("combines with other options and keeps find() away", () => {
    const q = blog.where("featured", true).whereTaxonomyIn("tags", ["php"]).limit(2);
    expect(q.toRequest().query).toEqual({
      "filter[featured:is]": "true",
      "filter[taxonomy:tags:any]": "php",
      limit: 2,
    });
    expect("find" in blog.whereTaxonomyIn("tags", ["php"])).toBe(false);
  });

  it("only allows taxonomies in allowed_filters, and only on entries", () => {
    // @ts-expect-error categories is not in allowed_filters
    blog.whereTaxonomyIn("categories", ["a"]);
    // @ts-expect-error terms have no taxonomy filters
    cms.taxonomies("tags").whereTaxonomyIn("tags", ["a"]);
    // @ts-expect-error assets have no taxonomy filters
    cms.assets("images").whereTaxonomy("tags", "a");
    // @ts-expect-error taxonomy filters are not plain fields
    blog.where("taxonomy:tags", "php");
  });

  it("allows any taxonomy without a schema", () => {
    const loose = createStatamicClient({ baseUrl: "https://cms.test", fetch });
    expect(loose.collections("x").whereTaxonomy("anything", "a").toRequest().query).toEqual({
      "filter[taxonomy:anything:all]": "a",
    });
  });
});

describe("users", () => {
  it("compiles the list with open filters, sort and fields", () => {
    const q = cms
      .users()
      .where("email", "ends_with", "@acme.com")
      .where("roles", "contains", "editor") // not a returned field, still filterable
      .sort("name")
      .fields(["name", "email"]);
    expect(q.toRequest()).toEqual({
      method: "GET",
      path: "/users",
      query: {
        "filter[email:ends_with]": "@acme.com",
        "filter[roles:contains]": "editor",
        sort: ["name"],
        fields: ["name", "email"],
      },
    });
    expectTypeOf(q.get)
      .returns.resolves.toHaveProperty("data")
      .toEqualTypeOf<Array<Pick<StatamicUser, "name" | "email">>>();
  });

  it("finds one user by id, without fields() (Statamic ignores it there)", () => {
    const one = cms.users().find("abc 1");
    expect(one.toRequest().path).toBe("/users/abc%201");
    expectTypeOf(one.get).returns.resolves.toEqualTypeOf<{ data: StatamicUser } | null>();
    // @ts-expect-error single users always return all fields
    one.fields;
    // @ts-expect-error users only return the fixed StatamicUser fields
    cms.users().fields(["roles"]);
  });
});

describe("site handles", () => {
  it("accept any string without a registered schema", () => {
    expectTypeOf<SiteHandle>().toEqualTypeOf<string>();
    expectTypeOf<StatamicSite["handle"]>().toEqualTypeOf<string>();
  });
});

describe("forms and sites", () => {
  it("builds the list and single-form requests", () => {
    expect(cms.forms().toRequest()).toEqual({ method: "GET", path: "/forms", query: {} });
    expect(cms.forms("contact us").toRequest().path).toBe("/forms/contact%20us");
    expect(cms.sites().url()).toBe("https://cms.test/api/sites");
  });

  it("types forms and sites", () => {
    expectTypeOf(cms.forms().get).returns.resolves.toEqualTypeOf<{ data: StatamicForm[] }>();
    expectTypeOf(cms.forms("contact").get).returns.resolves.toEqualTypeOf<{ data: StatamicForm }>();
    expectTypeOf(cms.sites().get).returns.resolves.toEqualTypeOf<{ data: StatamicSite[] }>();
    expectTypeOf<StatamicForm["fields"][string]["validate"]>().toEqualTypeOf<string[] | undefined>();
  });

  it("throws on a missing form instead of resolving to null", async () => {
    const missing = createStatamicClient({
      baseUrl: "https://cms.test",
      fetch: async () => new Response("{}", { status: 404 }),
    });
    await expect(missing.forms("nope").get()).rejects.toBeInstanceOf(HeadqueryHttpError);
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

  it("keeps globals(handle) throwing on 404", async () => {
    await expect(status(404).globals("settings").get()).rejects.toBeInstanceOf(HeadqueryHttpError);
    expectTypeOf(cms.globals("settings").get).returns.resolves.not.toBeNullable();
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
    const a = cms.navs("main").tree().maxDepth(2).fields(["title", "url", "entry_id"]).site("de");
    const b = cms.navs("main").tree().site("de").fields(["title", "url", "entry_id"]).maxDepth(2);
    expect(a.toRequest()).toEqual({
      method: "GET",
      path: "/navs/main/tree",
      query: { max_depth: 2, site: "de", fields: ["title", "url", "entry_id"] },
    });
    expect(a.url()).toBe(b.url());
    expect(a.url()).toBe("https://cms.test/api/navs/main/tree?fields=title,url,entry_id&max_depth=2&site=de");
  });

  it("is immutable", () => {
    const base = cms.navs("main").tree();
    base.maxDepth(1);
    expect(base.toRequest().query).toEqual({});
  });

  it("types pages as links or entries, also after fields()", () => {
    const main = cms.navs("main").tree();
    type Item = Awaited<ReturnType<typeof main.get>>["data"][number];
    expectTypeOf<Item["page"]>().toEqualTypeOf<LinkPage | EntryPage>();
    expectTypeOf<Item["children"]>().toEqualTypeOf<Item[]>();

    const picked = cms.navs("main").tree().fields(["title", "entry_id", "reading_time"]);
    type Page = Awaited<ReturnType<typeof picked.get>>["data"][number]["page"];
    // reading_time only exists on entry pages, so link pages don't get it
    expectTypeOf<Page>().toEqualTypeOf<
      Pick<LinkPage, "title" | "entry_id"> | Pick<EntryPage, "title" | "entry_id" | "reading_time">
    >();
    const page = {} as Page;
    if (page.entry_id !== null) expectTypeOf(page.reading_time).toEqualTypeOf<number | null>();

    // @ts-expect-error unknown field
    cms.navs("main").tree().fields(["nope"]);
    // @ts-expect-error unknown navigation
    cms.navs("footer").tree();
  });
});

describe("collection trees", () => {
  it("compiles filters, max_depth, site and fields like nav trees", () => {
    const q = cms.collections("pages").tree().where("title", "contains", "About").maxDepth(2).fields(["title"]);
    expect(q.toRequest()).toEqual({
      method: "GET",
      path: "/collections/pages/tree",
      query: { "filter[title:contains]": "About", max_depth: 2, fields: ["title"] },
    });
    expect(q.url()).toBe(
      "https://cms.test/api/collections/pages/tree?fields=title&filter[title:contains]=About&max_depth=2",
    );
  });

  it("types pages as entries with entry_id", () => {
    const tree = cms.collections("pages").tree();
    expectTypeOf<Awaited<ReturnType<typeof tree.get>>["data"][number]["page"]>().toEqualTypeOf<
      PageEntry & { entry_id: string }
    >();
    const picked = cms.collections("pages").tree().fields(["title", "entry_id"]);
    expectTypeOf<Awaited<ReturnType<typeof picked.get>>["data"][number]["page"]>().toEqualTypeOf<
      Pick<PageEntry & { entry_id: string }, "title" | "entry_id">
    >();
  });

  it("only exists for structured collections, before list options", () => {
    // @ts-expect-error blog is not structured
    cms.collections("blog").tree;
    // @ts-expect-error taxonomies have no tree endpoint
    cms.taxonomies("tags").tree;
    // @ts-expect-error tree() ignores list options
    cms.collections("pages").limit(2).tree;
    // @ts-expect-error summary is not in allowed_filters
    cms.collections("pages").tree().where("summary", "x");
    // @ts-expect-error nav trees don't accept filters
    cms.navs("main").tree().where("title", "x");
  });

  it("is offered on every collection without a schema", () => {
    const loose = createStatamicClient({ baseUrl: "https://cms.test", fetch });
    expect(loose.collections("anything").tree().where("x", "y").toRequest().path).toBe("/collections/anything/tree");
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
    const tree = loose.navs("any").tree().fields(["title", "custom"]);
    expect(tree.toRequest().path).toBe("/navs/any/tree");
    expectTypeOf<Awaited<ReturnType<typeof tree.get>>["data"][number]["page"]>().toHaveProperty("custom");
  });
});
