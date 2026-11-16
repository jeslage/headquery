import { createStatamicClient, isBlueprint, type SiteHandle, type StatamicSite } from "@headquery/statamic";
import { describe, expectTypeOf, it } from "vitest";
// Importing the generated snapshot registers its Schema via module augmentation.
import type {
  AssetsAsset,
  BlogEntry,
  HqAsset,
  HqBardText,
  HqEmptyOption,
  HqLinkAsset,
  HqLinkEntry,
  HqLinkUrl,
  HqNavEntry,
  HqOption,
  MainNavFields,
  MainNavPage,
  PagesEntry,
  PagesLandingEntry,
  PagesPageEntry,
  PagesTreePage,
  SettingsGlobal,
  TagsTerm,
} from "./__generated__/statamic";

describe("generated types work with @headquery/statamic", () => {
  const cms = createStatamicClient({ baseUrl: "https://cms.test", fetch: async () => new Response("{}") });

  it("types collection handles, filters and results from the registered schema", () => {
    const q = cms.collections("blog").where("featured", true).fields(["title", "hero"]);
    expectTypeOf(q.get)
      .returns.resolves.toHaveProperty("data")
      .toEqualTypeOf<Array<Pick<BlogEntry, "title" | "hero">>>();
    expectTypeOf<BlogEntry["hero"]>().toEqualTypeOf<HqAsset | null>();
    expectTypeOf<BlogEntry["stage"]>().toEqualTypeOf<HqOption<"draft" | "review" | "live"> | HqEmptyOption>();
    expectTypeOf<BlogEntry["featured"]>().toEqualTypeOf<boolean>();

    // @ts-expect-error reading_time is not filterable in the fixture
    cms.collections("blog").where("reading_time", 3);
    // @ts-expect-error unknown collection
    cms.collections("products");
  });

  it("types Bard as HTML without sets and as text items and sets with sets", () => {
    expectTypeOf<BlogEntry["content"]>().toEqualTypeOf<string | null>();

    type Item = BlogEntry["body"][number];
    expectTypeOf<Item["type"]>().toEqualTypeOf<"text" | "callout" | "image">();
    expectTypeOf<Extract<Item, { type: "text" }>>().toEqualTypeOf<HqBardText>();
    expectTypeOf<Extract<Item, { type: "callout" }>["text"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Extract<Item, { type: "image" }>["image"]>().toEqualTypeOf<HqAsset | null>();
    expectTypeOf<Extract<Item, { type: "image" }>["id"]>().toEqualTypeOf<string | null>();

    const render = (item: Item): string => {
      switch (item.type) {
        case "text":
          return item.text;
        case "callout":
          return item.text ?? "";
        case "image":
          // @ts-expect-error image sets have no text
          return item.text;
      }
    };
    expectTypeOf(render).returns.toEqualTypeOf<string>();
  });

  it("types link fields as a URL, an entry or an asset, never null", () => {
    expectTypeOf<BlogEntry["source"]>().toEqualTypeOf<HqLinkUrl | HqLinkEntry | HqLinkAsset>();
    expectTypeOf<PagesPageEntry["cta"]>().toEqualTypeOf<HqLinkUrl | HqLinkEntry>();
    expectTypeOf<BlogEntry["source"]["url"]>().toEqualTypeOf<string | null>();

    (link: BlogEntry["source"]) => {
      if ("title" in link) expectTypeOf(link).toEqualTypeOf<HqLinkEntry>();
      else if ("alt" in link) expectTypeOf(link).toEqualTypeOf<HqLinkAsset>();
      else expectTypeOf(link).toEqualTypeOf<HqLinkUrl>();
    };
  });

  it("includes Statamic's system fields, with blueprint fields taking precedence", () => {
    expectTypeOf<BlogEntry["status"]>().toEqualTypeOf<"published" | "draft" | "scheduled" | "expired">();
    expectTypeOf<BlogEntry["permalink"]>().toEqualTypeOf<string | null>();
    // `slug` is required in the blueprint, so it is not nullable like the base field
    expectTypeOf<BlogEntry["slug"]>().toEqualTypeOf<string>();
    expectTypeOf<TagsTerm["entries_count"]>().toEqualTypeOf<number>();
    expectTypeOf<SettingsGlobal["handle"]>().toEqualTypeOf<"settings">();

    const q = cms.collections("blog").fields(["title", "url"]).sort("-date");
    expectTypeOf(q.get)
      .returns.resolves.toHaveProperty("data")
      .toEqualTypeOf<Array<Pick<BlogEntry, "title" | "url">>>();
  });

  it("types globals", () => {
    expectTypeOf(cms.globals("settings").get)
      .returns.resolves.toHaveProperty("data")
      .toHaveProperty("site_name")
      .toEqualTypeOf<string | null>();
    expectTypeOf<SettingsGlobal["social"][number]["network"]>().toEqualTypeOf<
      HqOption<"mastodon" | "github"> | HqEmptyOption
    >();
    expectTypeOf(cms.globals().get).returns.resolves.toHaveProperty("data").toEqualTypeOf<SettingsGlobal[]>();
  });

  it("types navigation trees as links or linked entries", () => {
    const main = cms.navs("main").tree();
    type Item = Awaited<ReturnType<typeof main.get>>["data"][number];
    // expectTypeOf expands unions of intersections; compare type identity instead.
    type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
    expectTypeOf<Equal<Item["page"], MainNavPage>>().toEqualTypeOf<true>();
    expectTypeOf<Item["children"]>().toEqualTypeOf<Item[]>();

    const page = {} as MainNavPage;
    expectTypeOf(page.icon).toEqualTypeOf<MainNavFields["icon"]>();
    expectTypeOf(page.id).toEqualTypeOf<string>();
    if (page.entry_id === null) {
      // @ts-expect-error links don't have entry fields
      page.reading_time;
    } else {
      expectTypeOf(page.reading_time).toEqualTypeOf<BlogEntry["reading_time"]>();
      expectTypeOf(page.title).toEqualTypeOf<string | null>();
    }

    // @ts-expect-error unknown navigation
    cms.navs("footer").tree();
  });

  it("types assets, filterable by blueprint and system fields", () => {
    // Asset::query()->where('container', 'assets')->where('basename', 'hero.svg')->first()
    const q = cms.assets("assets").where("basename", "hero.svg").fields(["url", "alt", "width"]);
    expectTypeOf(q.first).returns.resolves.toEqualTypeOf<Pick<AssetsAsset, "url" | "alt" | "width"> | null>();
    expectTypeOf(cms.assets("assets").find("hero.svg").get).returns.resolves.toEqualTypeOf<{
      data: AssetsAsset;
    } | null>();
    expectTypeOf<AssetsAsset["alt"]>().toEqualTypeOf<string | null>();
    expectTypeOf<AssetsAsset["width"]>().toEqualTypeOf<number | null>();
    cms.assets("assets").where("folder", "2026").where("alt", "exists");

    // @ts-expect-error extension is not in allowed_filters in the fixture
    cms.assets("assets").where("extension", "svg");
    // @ts-expect-error unknown asset container
    cms.assets("videos");
  });

  it("types collections with several blueprints as a union that isBlueprint() narrows", () => {
    expectTypeOf<PagesEntry>().toEqualTypeOf<PagesLandingEntry | PagesPageEntry>();
    expectTypeOf<PagesEntry["blueprint"]["handle"]>().toEqualTypeOf<"landing" | "page">();
    expectTypeOf<BlogEntry["blueprint"]>().toEqualTypeOf<{ handle: "blog"; title: string }>();

    const find = cms.collections("pages").find("contact");
    expectTypeOf(find.get).returns.resolves.toEqualTypeOf<{ data: PagesEntry } | null>();
    // Type checks only (never called):
    (entry: PagesEntry) => {
      // @ts-expect-error show_hero only exists on landing entries
      entry.show_hero;
      if (isBlueprint(entry, "landing")) {
        expectTypeOf(entry.show_hero).toEqualTypeOf<boolean>();
        expectTypeOf(entry.summary).toEqualTypeOf<number | null>();
      } else {
        expectTypeOf(entry.summary).toEqualTypeOf<string | null>();
      }
    };

    // fields() offers the fields of every blueprint; entries without one get it as null
    const picked = cms.collections("pages").fields(["title", "show_hero"]);
    type Picked = Awaited<ReturnType<typeof picked.get>>["data"][number];
    expectTypeOf<Picked>().toEqualTypeOf<
      Pick<PagesLandingEntry, "title" | "show_hero"> | (Pick<PagesPageEntry, "title"> & { show_hero: null })
    >();
    cms.collections("pages").sort("-show_hero", "title").where("title", "contains", "a");

    // whereBlueprint() filters by blueprint and narrows the result
    const landing = cms.collections("pages").whereBlueprint("landing");
    expectTypeOf(landing.get).returns.resolves.toHaveProperty("data").toEqualTypeOf<PagesLandingEntry[]>();
    const both = cms.collections("pages").whereBlueprint(["landing", "page"]).fields(["title"]);
    type Both = Awaited<ReturnType<typeof both.get>>["data"][number];
    expectTypeOf<Both>().toEqualTypeOf<Pick<PagesLandingEntry, "title"> | Pick<PagesPageEntry, "title">>();
    // @ts-expect-error unknown blueprint
    cms.collections("pages").whereBlueprint("article");
    // @ts-expect-error blueprint is not in the blog's allowed_filters
    cms.collections("blog").whereBlueprint("blog");

    // Navigations that link such a collection keep the union.
    (page: HqNavEntry<PagesEntry, MainNavFields>) => {
      if (isBlueprint(page, "landing")) expectTypeOf(page.show_hero).toEqualTypeOf<boolean>();
    };
  });

  it("types collection trees for structured collections only", () => {
    const tree = cms.collections("pages").tree().where("title", "contains", "About").maxDepth(2);
    type Item = Awaited<ReturnType<typeof tree.get>>["data"][number];
    expectTypeOf<Item["page"]>().toEqualTypeOf<PagesTreePage>();
    expectTypeOf<PagesTreePage["entry_id"]>().toEqualTypeOf<string>();
    // summary is a textarea on `page` and an integer on `landing`
    expectTypeOf<PagesTreePage["summary"]>().toEqualTypeOf<string | number | null>();
    (page: PagesTreePage) => {
      if (isBlueprint(page, "landing")) expectTypeOf(page.show_hero).toEqualTypeOf<boolean>();
    };

    // @ts-expect-error blog is not a structured collection
    cms.collections("blog").tree;
  });

  it("types taxonomy filters and the extra conditions", () => {
    const q = cms
      .collections("blog")
      .whereTaxonomyIn("tags", ["php", "statamic"])
      .whereTaxonomyNotIn("tags", ["drafts"])
      .where("date", "is_past")
      .where("tags", "overlaps", ["php"])
      .where("title", "matches", "^Hello");
    expectTypeOf(q.get).returns.resolves.toHaveProperty("data").toEqualTypeOf<BlogEntry[]>();

    // @ts-expect-error only taxonomies listed in allowed_filters (taxonomy:tags)
    cms.collections("blog").whereTaxonomy("categories", "news");
    // @ts-expect-error the pages collection doesn't allow taxonomy filters
    cms.collections("pages").whereTaxonomyIn("tags", ["php"]);
  });

  it("types users with the fixed Statamic user fields", () => {
    const q = cms.users().where("roles", "contains", "editor").fields(["email", "is_super"]);
    expectTypeOf(q.first).returns.resolves.toEqualTypeOf<{ email: string; is_super: boolean } | null>();
  });

  it("only accepts the registered site handles in site()", () => {
    expectTypeOf<SiteHandle>().toEqualTypeOf<"default" | "de">();
    expectTypeOf<StatamicSite["handle"]>().toEqualTypeOf<"default" | "de">();

    cms.collections("blog").site("de").where("featured", true);
    cms.collections("blog").find("hello").site("default");
    cms.collections("pages").tree().site("de");
    cms.taxonomies("tags").site("de");
    cms.globals("settings").site("de");
    cms.globals().site("de");
    cms.navs("main").tree().site("de");

    // @ts-expect-error typo in the site handle
    cms.collections("blog").site("dee");
    // @ts-expect-error site handles, not languages
    cms.globals("settings").site("en");
    // @ts-expect-error unknown site on a tree
    cms.navs("main").tree().site("fr");
  });
});
