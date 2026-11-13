import { createStatamicClient } from "@headquery/statamic";
import { describe, expectTypeOf, it } from "vitest";
// Importing the generated snapshot registers its Schema via module augmentation.
import type {
  AssetsAsset,
  BlogEntry,
  HqAsset,
  HqEmptyOption,
  HqOption,
  MainNavFields,
  MainNavPage,
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

  it("types collection trees for structured collections only", () => {
    const tree = cms.collections("pages").tree().where("title", "contains", "About").maxDepth(2);
    type Item = Awaited<ReturnType<typeof tree.get>>["data"][number];
    expectTypeOf<Item["page"]>().toEqualTypeOf<PagesTreePage>();
    expectTypeOf<PagesTreePage["entry_id"]>().toEqualTypeOf<string>();
    expectTypeOf<PagesTreePage["summary"]>().toEqualTypeOf<string | null>();

    // @ts-expect-error blog is not a structured collection
    cms.collections("blog").tree;
  });
});
