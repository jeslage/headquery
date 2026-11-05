import { createStatamicClient } from "@headquery/statamic";
import { describe, expectTypeOf, it } from "vitest";
// Importing the generated snapshot registers its Schema via module augmentation.
import type { BlogEntry, HqAsset, HqEmptyOption, HqOption, SettingsGlobal, TagsTerm } from "./__generated__/statamic";

describe("generated types work with @headquery/statamic", () => {
  const cms = createStatamicClient({ baseUrl: "https://cms.test", fetch: async () => new Response("{}") });

  it("types collection handles, filters and results from the registered schema", () => {
    const q = cms.collection("blog").entries().where("featured", true).fields(["title", "hero"]);
    expectTypeOf(q.get).returns.resolves.toHaveProperty("data").toEqualTypeOf<Array<Pick<BlogEntry, "title" | "hero">>>();
    expectTypeOf<BlogEntry["hero"]>().toEqualTypeOf<HqAsset | null>();
    expectTypeOf<BlogEntry["stage"]>().toEqualTypeOf<HqOption<"draft" | "review" | "live"> | HqEmptyOption>();
    expectTypeOf<BlogEntry["featured"]>().toEqualTypeOf<boolean>();

    // @ts-expect-error reading_time is not filterable in the fixture
    cms.collection("blog").entries().where("reading_time", 3);
    // @ts-expect-error unknown collection
    cms.collection("pages");
  });

  it("includes Statamic's system fields, with blueprint fields taking precedence", () => {
    expectTypeOf<BlogEntry["status"]>().toEqualTypeOf<"published" | "draft" | "scheduled" | "expired">();
    expectTypeOf<BlogEntry["permalink"]>().toEqualTypeOf<string | null>();
    // `slug` is required in the blueprint, so it is not nullable like the base field
    expectTypeOf<BlogEntry["slug"]>().toEqualTypeOf<string>();
    expectTypeOf<TagsTerm["entries_count"]>().toEqualTypeOf<number>();
    expectTypeOf<SettingsGlobal["handle"]>().toEqualTypeOf<string>();

    const q = cms.collection("blog").entries().fields(["title", "url"]).sort("-date");
    expectTypeOf(q.get).returns.resolves.toHaveProperty("data").toEqualTypeOf<Array<Pick<BlogEntry, "title" | "url">>>();
  });

  it("types globals", () => {
    expectTypeOf(cms.global("settings").get).returns.resolves.toHaveProperty("data").toHaveProperty("site_name").toEqualTypeOf<string | null>();
    expectTypeOf<SettingsGlobal["social"][number]["network"]>().toEqualTypeOf<HqOption<"mastodon" | "github"> | HqEmptyOption>();
  });
});
