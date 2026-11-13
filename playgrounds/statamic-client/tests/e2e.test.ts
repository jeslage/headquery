// End-to-end: @headquery/statamic against the running playground with the seed content
// from playgrounds/statamic/seed. Skipped unless HEADQUERY_BASE_URL is set.
import { HeadqueryHttpError } from "@headquery/statamic";
import { describe, expect, expectTypeOf, it } from "vitest";
import { cms } from "../src/client";
import type { AssetsAsset, BlogEntry, HqAsset, HqAssetBase } from "../src/cms";
import { baseUrl } from "../src/env";

const blog = cms.collections("blog");

describe.skipIf(!baseUrl)(`Statamic playground (${baseUrl})`, () => {
  describe("collection entries", () => {
    it("lists published entries only, with pagination meta", async () => {
      const res = await blog.fields(["slug"]).get();
      expect(res.data.map((e) => e.slug).sort()).toEqual([
        "cacheable-get-requests",
        "hello-headquery",
        "statamic-addon",
      ]);
      expect(res.meta).toMatchObject({ current_page: 1, total: 3 });
      expect(res.links).toHaveProperty("next", null);
    });

    it("narrows the response to the requested fields", async () => {
      const res = await blog.fields(["title", "slug"]).limit(1).get();
      expect(Object.keys(res.data[0] ?? {}).sort()).toEqual(["slug", "title"]);
      expectTypeOf(res.data).toEqualTypeOf<Array<Pick<BlogEntry, "title" | "slug">>>();
    });

    it("sorts descending", async () => {
      const res = await blog.sort("-date").fields(["slug"]).get();
      expect(res.data.map((e) => e.slug)).toEqual(["statamic-addon", "cacheable-get-requests", "hello-headquery"]);
    });

    it("filters with `is` on a boolean", async () => {
      const res = await blog.where("featured", true).fields(["slug", "featured"]).get();
      expect(res.data.map((e) => e.slug).sort()).toEqual(["hello-headquery", "statamic-addon"]);
      expect(res.data.every((e) => e.featured === true)).toBe(true);
    });

    it("filters with `contains`", async () => {
      const res = await blog.where("title", "contains", "GET").fields(["title"]).get();
      expect(res.data.map((e) => e.title)).toEqual(["Cacheable GET requests"]);
    });

    it("filters with `in` (verifies LIST_SEPARATOR)", async () => {
      const res = await blog.where("slug", "in", ["hello-headquery", "statamic-addon"]).fields(["slug"]).get();
      expect(res.data.map((e) => e.slug).sort()).toEqual(["hello-headquery", "statamic-addon"]);
    });

    it("paginates", async () => {
      const page2 = await blog.sort("date").limit(2).page(2).fields(["slug"]).get();
      expect(page2.data.map((e) => e.slug)).toEqual(["statamic-addon"]);
      expect(page2.meta).toMatchObject({ current_page: 2, per_page: 2, total: 3 });
    });

    it("first() returns one item or null", async () => {
      expect(await blog.sort("date").fields(["slug"]).first()).toEqual({ slug: "hello-headquery" });
      expect(await blog.where("slug", "nope").first()).toBeNull();
    });

    it("rejects filters on fields that are not in allowed_filters", async () => {
      const err = await blog
        // @ts-expect-error reading_time is not filterable
        .where("reading_time", 3)
        .get()
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HeadqueryHttpError);
      expect((err as HeadqueryHttpError).status).toBe(422);
    });
  });

  describe("single entry", () => {
    it("fetches by slug and returns the documented field shapes", async () => {
      const { data } = (await blog.find("hello-headquery").get())!;
      expect(data).toMatchObject({
        title: "Hello headquery",
        slug: "hello-headquery",
        featured: true,
        reading_time: 4,
      });
      expect(data.stage).toEqual({ key: "live", value: "live", label: "Live" });
      expect(data.tags.map((t) => t.slug)).toEqual(["javascript", "statamic"]);
      expect(data.hero).toMatchObject({ url: expect.stringContaining("hero.svg") });
      expectTypeOf(data.hero).toEqualTypeOf<HqAsset | null>();
    });

    it("returns empty relations as null (single) and [] (multiple)", async () => {
      const { data } = (await blog.find("statamic-addon").fields(["hero", "related"]).get())!;
      expect(data.hero).toBeNull();
      expect(data.related).toEqual([]);
    });

    it("hides unpublished entries: find() resolves to null on 404", async () => {
      expect(await blog.find("unpublished-draft").get()).toBeNull();
    });
  });

  describe("taxonomies and globals", () => {
    it("lists and fetches terms", async () => {
      const terms = await cms.taxonomies("tags").fields(["slug"]).get();
      expect(terms.data.map((t) => t.slug).sort()).toEqual(["javascript", "php", "statamic"]);
      const { data } = (await cms.taxonomies("tags").find("php").get())!;
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

    it("lists all global sets, told apart by handle", async () => {
      const { data } = await cms.globals().get();
      expect(data.map((g) => g.handle)).toEqual(["settings"]);
      const settings = data.find((g) => g.handle === "settings");
      expect(settings?.site_name).toBe("headquery playground");
    });
  });

  describe("navigation", () => {
    const main = cms.navs("main").tree();

    it("returns entry pages with the entry's fields and link pages with entry_id null", async () => {
      const { data } = await main.get();
      expect(data.map((i) => [i.page.title, i.depth])).toEqual([
        ["Hello headquery", 1],
        ["GitHub", 1],
      ]);
      const [entry, link] = data.map((i) => i.page);
      if (!entry || entry.entry_id === null) throw new Error("expected an entry page first");
      // id is the nav item's id; the entry id is in entry_id
      expect(entry.id).not.toBe(entry.entry_id);
      expect(entry.slug).toBe("hello-headquery");
      expect(entry.icon).toBeNull();
      expect(link).toMatchObject({ entry_id: null, url: "https://github.com/headquery", icon: "github" });
      expect(data[0]?.children.map((c) => [c.page.title, c.depth])).toEqual([["Cacheable GET requests", 2]]);
    });

    it("limits the depth", async () => {
      const { data } = await main.maxDepth(1).get();
      expect(data.every((i) => i.children.length === 0)).toBe(true);
    });

    it("narrows pages to the requested fields", async () => {
      const { data } = await main.fields(["title", "entry_id"]).get();
      expect(Object.keys(data[0]?.page ?? {}).sort()).toEqual(["entry_id", "title"]);
    });

    it("lists navigations", async () => {
      const { data } = await cms.navs().get();
      expect(data).toEqual([expect.objectContaining({ handle: "main", title: "Main", max_depth: 2 })]);
    });
  });

  describe("collection trees", () => {
    const pages = cms.collections("pages");
    type Node = { page: { title: string }; children: Node[] };
    const titles = (nodes: Node[]): unknown[] =>
      nodes.map((n) => (n.children.length ? [n.page.title, titles(n.children)] : n.page.title));

    it("returns published entries as pages, with id equal to entry_id", async () => {
      const { data } = await pages.tree().get();
      expect(titles(data)).toEqual(["Home", ["About", ["Team"]], "Contact"]);
      const about = data[1]!;
      expect(about.depth).toBe(1);
      expect(about.children[0]?.depth).toBe(2);
      expect(about.page).toMatchObject({ slug: "about", url: "/about", summary: "About headquery" });
      expect(about.page.id).toBe(about.page.entry_id);
      expectTypeOf(about.page.entry_id).toEqualTypeOf<string>();
    });

    it("limits the depth and narrows the fields", async () => {
      const { data } = await pages.tree().maxDepth(1).fields(["title", "url"]).get();
      expect(data.map((n) => n.page)).toEqual([
        { title: "Home", url: "/" },
        { title: "About", url: "/about" },
        { title: "Contact", url: "/contact" },
      ]);
      expect(data.every((n) => n.children.length === 0)).toBe(true);
    });

    it("filters per level: a non-matching parent drops its subtree", async () => {
      expect(titles((await pages.tree().where("title", "contains", "About").get()).data)).toEqual(["About"]);
      expect((await pages.tree().where("title", "Team").get()).data).toEqual([]);
    });

    it("rejects filters outside allowed_filters and unstructured collections", async () => {
      const forbidden = await pages
        .tree()
        // @ts-expect-error summary is not filterable
        .where("summary", "x")
        .get()
        .catch((e: unknown) => e);
      expect((forbidden as HeadqueryHttpError).status).toBe(422);

      // @ts-expect-error blog is not structured, so the generated types have no tree()
      cms.collections("blog").tree;
      const blog = cms.collections("blog") as unknown as ReturnType<typeof cms.collections<"pages">>;
      const unstructured = await blog
        .tree()
        .get()
        .catch((e: unknown) => e);
      expect((unstructured as HeadqueryHttpError).status).toBe(404);
    });
  });

  describe("assets", () => {
    const assets = cms.assets("assets");

    it("lists assets with pagination meta and narrows to the requested fields", async () => {
      const res = await assets.sort("path").fields(["path", "folder"]).get();
      expect(res.data).toEqual([
        { path: "files/notes.txt", folder: "files" },
        { path: "gallery-1.svg", folder: "/" },
        { path: "gallery-2.svg", folder: "/" },
        { path: "hero.svg", folder: "/" },
        { path: "icons/logo mark.svg", folder: "icons" },
      ]);
      expect(res.meta).toMatchObject({ current_page: 1, total: 5 });
    });

    it("filters on system fields like Asset::query()->where('basename', …)->first()", async () => {
      // find() ignores filters, so it is not offered after where()
      // @ts-expect-error find() only exists before list options
      assets.where("folder", "icons").find;
      const hero = await assets.where("basename", "hero.svg").fields(["path", "alt"]).first();
      expect(hero).toEqual({ path: "hero.svg", alt: null });
      expect(await assets.where("folder", "icons").fields(["basename"]).first()).toEqual({ basename: "logo mark.svg" });
    });

    it("rejects filters that are not in allowed_filters", async () => {
      const err = await assets
        // @ts-expect-error extension is not filterable
        .where("extension", "svg")
        .get()
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HeadqueryHttpError);
      expect((err as HeadqueryHttpError).status).toBe(422);
    });

    it("fetches one asset by path with every documented system field", async () => {
      const { data } = (await cms.assets("assets").find("hero.svg").get())!;
      expectTypeOf(data).toEqualTypeOf<AssetsAsset>();
      expect(data).toMatchObject({
        id: "assets::hero.svg",
        path: "hero.svg",
        basename: "hero.svg",
        folder: "/",
        url: "/assets/hero.svg",
        is_asset: true,
        is_image: false,
        is_svg: true,
        width: 1200,
        height: 630,
        orientation: "landscape",
        mime_type: "image/svg+xml",
        duration: null,
        alt: null,
        container: expect.objectContaining({ handle: "assets" }),
      });
      expect(Object.keys(data).sort()).toEqual([...ASSET_KEYS, "alt"].sort());
    });

    it("fetches nested paths and keeps their slashes in the URL", async () => {
      const q = cms.assets("assets").find("icons/logo mark.svg").fields(["id", "api_url"]);
      expect(q.url()).toBe(`${baseUrl}/api/assets/assets/icons/logo%20mark.svg?fields=id,api_url`);
      const { data } = (await q.get())!;
      expect(data).toEqual({
        id: "assets::icons/logo mark.svg",
        api_url: expect.stringMatching(/icons\/logo%20mark\.svg$/),
      });
    });

    it("returns null dimensions for non-images", async () => {
      const { data } = (await cms
        .assets("assets")
        .find("files/notes.txt")
        .fields(["width", "height", "ratio", "orientation"])
        .get())!;
      expect(data).toEqual({ width: null, height: null, ratio: null, orientation: "square" });
    });

    it("find() resolves to null for a missing asset", async () => {
      expect(await cms.assets("assets").find("nope.svg").get()).toBeNull();
    });
  });
});

/** Keys of HqAssetBase, checked against a real response. */
const ASSET_KEYS = [
  "id",
  "title",
  "path",
  "filename",
  "basename",
  "extension",
  "folder",
  "url",
  "permalink",
  "api_url",
  "edit_url",
  "is_asset",
  "is_audio",
  "is_previewable",
  "is_image",
  "is_svg",
  "is_video",
  "is_pdf",
  "blueprint",
  "container",
  "size",
  "size_bytes",
  "size_kilobytes",
  "size_megabytes",
  "size_gigabytes",
  "size_b",
  "size_kb",
  "size_mb",
  "size_gb",
  "last_modified",
  "last_modified_timestamp",
  "last_modified_instance",
  "focus",
  "has_focus",
  "focus_css",
  "height",
  "width",
  "orientation",
  "ratio",
  "mime_type",
  "duration",
  "duration_seconds",
  "duration_minutes",
  "duration_sec",
  "duration_min",
  "playtime",
] satisfies Array<keyof HqAssetBase>;
