// End-to-end: @headquery/statamic against the running playground with the seed content
// from playgrounds/statamic/seed. Skipped unless HEADQUERY_BASE_URL is set.
import { HeadqueryHttpError } from "@headquery/statamic";
import { describe, expect, expectTypeOf, it } from "vitest";
import { cms } from "../src/client";
import type { BlogEntry, HqAsset } from "../src/cms";
import { baseUrl } from "../src/env";

const blog = cms.collection("blog");

describe.skipIf(!baseUrl)(`Statamic playground (${baseUrl})`, () => {
  describe("collection entries", () => {
    it("lists published entries only, with pagination meta", async () => {
      const res = await blog.entries().fields(["slug"]).get();
      expect(res.data.map((e) => e.slug).sort()).toEqual(["cacheable-get-requests", "hello-headquery", "statamic-addon"]);
      expect(res.meta).toMatchObject({ current_page: 1, total: 3 });
      expect(res.links).toHaveProperty("next", null);
    });

    it("narrows the response to the requested fields", async () => {
      const res = await blog.entries().fields(["title", "slug"]).limit(1).get();
      expect(Object.keys(res.data[0] ?? {}).sort()).toEqual(["slug", "title"]);
      expectTypeOf(res.data).toEqualTypeOf<Array<Pick<BlogEntry, "title" | "slug">>>();
    });

    it("sorts descending", async () => {
      const res = await blog.entries().sort("-date").fields(["slug"]).get();
      expect(res.data.map((e) => e.slug)).toEqual(["statamic-addon", "cacheable-get-requests", "hello-headquery"]);
    });

    it("filters with `is` on a boolean", async () => {
      const res = await blog.entries().where("featured", true).fields(["slug", "featured"]).get();
      expect(res.data.map((e) => e.slug).sort()).toEqual(["hello-headquery", "statamic-addon"]);
      expect(res.data.every((e) => e.featured === true)).toBe(true);
    });

    it("filters with `contains`", async () => {
      const res = await blog.entries().where("title", "contains", "GET").fields(["title"]).get();
      expect(res.data.map((e) => e.title)).toEqual(["Cacheable GET requests"]);
    });

    it("filters with `in` (verifies LIST_SEPARATOR)", async () => {
      const res = await blog.entries().where("slug", "in", ["hello-headquery", "statamic-addon"]).fields(["slug"]).get();
      expect(res.data.map((e) => e.slug).sort()).toEqual(["hello-headquery", "statamic-addon"]);
    });

    it("paginates", async () => {
      const page2 = await blog.entries().sort("date").limit(2).page(2).fields(["slug"]).get();
      expect(page2.data.map((e) => e.slug)).toEqual(["statamic-addon"]);
      expect(page2.meta).toMatchObject({ current_page: 2, per_page: 2, total: 3 });
    });

    it("first() returns one item or null", async () => {
      expect(await blog.entries().sort("date").fields(["slug"]).first()).toEqual({ slug: "hello-headquery" });
      expect(await blog.entries().where("slug", "nope").first()).toBeNull();
    });

    it("rejects filters on fields that are not in allowed_filters", async () => {
      // @ts-expect-error reading_time is not filterable
      const err = await blog.entries().where("reading_time", 3).get().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HeadqueryHttpError);
      expect((err as HeadqueryHttpError).status).toBe(422);
    });
  });

  describe("single entry", () => {
    it("fetches by slug and returns the documented field shapes", async () => {
      const { data } = await blog.entry("hello-headquery").get();
      expect(data).toMatchObject({ title: "Hello headquery", slug: "hello-headquery", featured: true, reading_time: 4 });
      expect(data.stage).toEqual({ key: "live", value: "live", label: "Live" });
      expect(data.tags.map((t) => t.slug)).toEqual(["javascript", "statamic"]);
      expect(data.hero).toMatchObject({ url: expect.stringContaining("hero.svg") });
      expectTypeOf(data.hero).toEqualTypeOf<HqAsset | null>();
    });

    it("returns empty relations as null (single) and [] (multiple)", async () => {
      const { data } = await blog.entry("statamic-addon").fields(["hero", "related"]).get();
      expect(data.hero).toBeNull();
      expect(data.related).toEqual([]);
    });

    it("hides unpublished entries (404)", async () => {
      const err = await blog.entry("unpublished-draft").get().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HeadqueryHttpError);
      expect((err as HeadqueryHttpError).status).toBe(404);
    });
  });

  describe("taxonomies and globals", () => {
    it("lists and fetches terms", async () => {
      const terms = await cms.taxonomy("tags").terms().fields(["slug"]).get();
      expect(terms.data.map((t) => t.slug).sort()).toEqual(["javascript", "php", "statamic"]);
      const { data } = await cms.taxonomy("tags").term("php").get();
      expect(data).toMatchObject({ slug: "php", title: "PHP" });
    });

    it("fetches a global set", async () => {
      const { data } = await cms.global("settings").get();
      expect(data.site_name).toBe("headquery playground");
      expect(data.social.map((s) => s.network)).toEqual([
        { key: "github", value: "github", label: "GitHub" },
        { key: "mastodon", value: "mastodon", label: "Mastodon" },
      ]);
    });
  });
});
