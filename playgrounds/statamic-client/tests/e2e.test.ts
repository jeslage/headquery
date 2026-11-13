// End-to-end: @headquery/statamic against the running playground with the seed content
// from playgrounds/statamic/seed. Skipped unless HEADQUERY_BASE_URL is set.
import { HeadqueryHttpError } from "@headquery/statamic";
import { describe, expect, expectTypeOf, it } from "vitest";
import { cms } from "../src/client";
import type { AssetsAsset, BlogEntry, HqAsset, HqAssetBase } from "../src/cms";
import { baseUrl } from "../src/env";

const entries = cms.collections("blog");
// The playground is multi-site: lists without `site` return the entries of every site.
const blog = entries.site("default");

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

  describe("taxonomy filters and extra conditions", () => {
    // Seed: hello-headquery (2026-10-01, javascript+statamic), cacheable-get-requests
    // (2026-10-15, javascript), statamic-addon (2026-11-01, php+statamic).
    const slugs = async (q: { get(): Promise<{ data: Array<{ slug: string | null }> }> }) =>
      (await q.get()).data.map((e) => e.slug);
    const byDate = blog.sort("date").fields(["slug"]);

    it("filters by taxonomy terms: any, all and not", async () => {
      expect(await slugs(byDate.whereTaxonomyIn("tags", ["php", "javascript"]))).toEqual([
        "hello-headquery",
        "cacheable-get-requests",
        "statamic-addon",
      ]);
      expect(await slugs(byDate.whereTaxonomy("tags", "javascript").whereTaxonomy("tags", "statamic"))).toEqual([
        "hello-headquery",
      ]);
      expect(await slugs(byDate.whereTaxonomyNotIn("tags", ["php"]))).toEqual([
        "hello-headquery",
        "cacheable-get-requests",
      ]);
    });

    it("rejects taxonomies outside allowed_filters", async () => {
      const err = await blog
        // @ts-expect-error categories is not in allowed_filters
        .whereTaxonomyIn("categories", ["news"])
        .get()
        .catch((e: unknown) => e);
      expect((err as HeadqueryHttpError).status).toBe(422);
    });

    it("filters dates relative to a date or now", async () => {
      expect(await slugs(byDate.where("date", "is_after", "2026-10-10"))).toEqual([
        "cacheable-get-requests",
        "statamic-addon",
      ]);
      expect(await slugs(byDate.where("date", "is_before", new Date("2026-10-10T00:00:00Z")))).toEqual([
        "hello-headquery",
      ]);
      // Future-dated entries are private in this collection, so every listed entry is in the past.
      expect(await slugs(byDate.where("date", "is_past"))).toHaveLength(3);
      expect(await slugs(byDate.where("date", "is_future"))).toEqual([]);
    });

    it("filters with regex, array overlap and boolean checks", async () => {
      expect(await slugs(byDate.where("title", "matches", "^Hello"))).toEqual(["hello-headquery"]);
      expect(await slugs(byDate.where("title", "doesnt_match", "^Hello"))).toHaveLength(2);
      expect(await slugs(byDate.where("tags", "overlaps", ["php"]))).toEqual(["statamic-addon"]);
      expect(await slugs(byDate.where("tags", "doesnt_overlap", ["php"]))).toHaveLength(2);
      // Slugs contain dashes, so none is purely alphabetic.
      expect(await slugs(byDate.where("slug", "is_alpha"))).toEqual([]);
      expect(await slugs(byDate.where("slug", "is_alpha", false))).toHaveLength(3);
    });
  });

  describe("single entry", () => {
    it("fetches by slug and returns the documented field shapes", async () => {
      const { data } = (await entries.find("hello-headquery").get())!;
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
      const { data } = (await entries.find("statamic-addon").fields(["hero", "related"]).get())!;
      expect(data.hero).toBeNull();
      expect(data.related).toEqual([]);
    });

    it("hides unpublished entries: find() resolves to null on 404", async () => {
      expect(await entries.find("unpublished-draft").get()).toBeNull();
    });
  });

  describe("taxonomies and globals", () => {
    it("lists and fetches terms", async () => {
      const terms = await cms.taxonomies("tags").site("default").fields(["slug"]).get();
      expect(terms.data.map((t) => t.slug).sort()).toEqual(["javascript", "php", "statamic"]);
      const { data } = (await cms.taxonomies("tags").find("php").get())!;
      expect(data).toMatchObject({ slug: "php", title: "PHP" });
    });

    it("fetches a global set", async () => {
      const { data } = await cms.globals("settings").get();
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

  describe("users", () => {
    // Only seed users: a local install may contain real accounts.
    const seedUsers = cms.users().where("email", "ends_with", "@example.com");
    const ada = "5f0c2c1e-7a4b-4d8e-9a51-2b7e6c0d1a01";

    it("lists users with exactly the fixed Statamic user fields", async () => {
      const res = await seedUsers.sort("name").get();
      expect(res.data.map((u) => u.email)).toEqual(["author@example.com", "editor@example.com"]);
      expect(Object.keys(res.data[0]!).sort()).toEqual(["api_url", "email", "id", "is_super", "name"]);
      expect(res.data[0]).toMatchObject({ id: ada, name: "Ada Author", is_super: false });
      expect(res.meta).toMatchObject({ current_page: 1, total: 2 });
    });

    it("narrows list fields and filters on fields the API doesn't return", async () => {
      expect((await seedUsers.sort("-name").fields(["name"]).get()).data).toEqual([
        { name: "Eddie Editor" },
        { name: "Ada Author" },
      ]);
      // Stache stores roles so that only `contains` matches them.
      expect((await seedUsers.where("roles", "contains", "editor").fields(["email"]).get()).data).toEqual([
        { email: "editor@example.com" },
      ]);
    });

    it("rejects password filters", async () => {
      const err = await cms
        .users()
        .where("password", "x")
        .get()
        .catch((e: unknown) => e);
      expect((err as HeadqueryHttpError).status).toBe(422);
    });

    it("finds one user by id, or null", async () => {
      const found = await cms.users().find(ada).get();
      expect(found?.data).toMatchObject({ id: ada, email: "author@example.com" });
      expect(await cms.users().find("nope").get()).toBeNull();
    });
  });

  describe("forms, sites and send()", () => {
    it("lists only the forms enabled in resources.forms", async () => {
      const { data } = await cms.forms().get();
      expect(data.map((f) => f.handle)).toEqual(["contact"]);
    });

    it("returns a form's fields keyed by handle, in blueprint order, without the honeypot", async () => {
      const { data } = await cms.forms("contact").get();
      expect(Object.keys(data).sort()).toEqual(["api_url", "fields", "handle", "title"]);
      expect(Object.keys(data.fields)).toEqual(["name", "email", "topic", "message"]);
      expect(data.fields.email).toMatchObject({
        handle: "email",
        type: "text",
        width: 100,
        display: "Email",
        input_type: "email",
        validate: ["required", "email"],
      });
      expect(data.fields.topic?.options).toEqual({ support: "Support", sales: "Sales" });
      expect(data.fields.message?.validate).toBeUndefined();
    });

    it("throws 404 for unknown forms", async () => {
      const err = await cms
        .forms("nope")
        .get()
        .catch((e: unknown) => e);
      expect((err as HeadqueryHttpError).status).toBe(404);
    });

    it("lists sites", async () => {
      const { data } = await cms.sites().get();
      expect(data).toEqual([
        { handle: "default", name: "English", locale: "en_US", short_locale: "en", url: "/" },
        { handle: "de", name: "Deutsch", locale: "de_DE", short_locale: "de", url: "/de" },
      ]);
    });

    it("reaches metadata endpoints and ping through send()", async () => {
      expect(await cms.send<{ ping: string }>({ method: "GET", path: "/ping" })).toEqual({ ping: "pong" });
      const { data } = await cms.send<{ data: Array<{ handle: string; title: string }> }>({
        method: "GET",
        path: "/collections",
      });
      expect(data.map((c) => c.handle).sort()).toEqual(["blog", "pages"]);
    });
  });

  describe("multi-site", () => {
    // Seed (de): a localization of hello-headquery, the de-only entry nur-auf-deutsch, Startseite and
    // Über uns in the pages tree, a localized php term title and settings.site_name, and a de nav tree.
    const helloId = "0b6d3f4e-1c2a-4b8f-9e7d-3a1f5c6b7d01";
    const halloId = "de000000-0000-4000-8000-000000000001";

    it("lists the entries and terms of every site without `site`, one site with it", async () => {
      const all = await entries.sort("title").fields(["title", "locale"]).get();
      expect(all.data.map((e) => [e.title, e.locale])).toEqual([
        ["Cacheable GET requests", "default"],
        ["Exporting the content model", "default"],
        ["Hallo headquery", "de"],
        ["Hello headquery", "default"],
        ["Nur auf Deutsch", "de"],
      ]);
      const de = await entries.site("de").sort("title").fields(["slug"]).get();
      expect(de.data.map((e) => e.slug)).toEqual(["hallo-headquery", "nur-auf-deutsch"]);
      expect(de.meta).toMatchObject({ total: 2 });
      const terms = await cms.taxonomies("tags").fields(["slug", "locale"]).get();
      expect(terms.data).toHaveLength(6);
    });

    it("combines site with filters", async () => {
      const res = await entries.site("de").where("featured", true).fields(["slug"]).get();
      expect(res.data).toEqual([{ slug: "hallo-headquery" }]);
    });

    it("inherits unlocalized fields from the origin", async () => {
      const { data } = (await entries.find(halloId).get())!;
      expect(data).toMatchObject({
        title: "Hallo headquery",
        locale: "de",
        origin_id: helloId,
        featured: true,
        reading_time: 4,
        url: "/de/blog/hallo-headquery",
      });
      expect(data.tags.map((t) => t.slug)).toEqual(["javascript", "statamic"]);
    });

    it("find(id) with site returns that site's localization; find(slug) looks in one site", async () => {
      expect((await entries.find(helloId).site("de").fields(["id"]).get())?.data).toEqual({ id: halloId });
      expect((await entries.find(halloId).site("default").fields(["id"]).get())?.data).toEqual({ id: helloId });
      // Without site, slugs are looked up in the default site only.
      expect(await entries.find("hallo-headquery").get()).toBeNull();
      expect((await entries.find("hallo-headquery").site("de").fields(["id"]).get())?.data).toEqual({ id: halloId });
      expect(await entries.find("hello-headquery").site("de").get()).toBeNull();
      // Not localized in de.
      expect(await entries.find("0b6d3f4e-1c2a-4b8f-9e7d-3a1f5c6b7d02").site("de").get()).toBeNull();
    });

    it("localizes terms and globals, falling back to the origin", async () => {
      const terms = await cms.taxonomies("tags").site("de").sort("slug").fields(["slug", "title"]).get();
      expect(terms.data).toEqual([
        { slug: "javascript", title: "JavaScript" },
        { slug: "php", title: "PHP (de)" },
        { slug: "statamic", title: "Statamic" },
      ]);
      expect((await cms.taxonomies("tags").find("php").site("de").get())?.data.title).toBe("PHP (de)");
      const { data } = await cms.globals("settings").site("de").get();
      expect(data.site_name).toBe("headquery Spielwiese");
      expect(data.social).toHaveLength(2);
      expect((await cms.globals().site("de").get()).data[0]?.site_name).toBe("headquery Spielwiese");
    });

    it("fetches a site's collection and nav tree; without site, the default site's", async () => {
      const pages = await cms.collections("pages").tree().site("de").fields(["title", "url"]).get();
      expect(pages.data.map((n) => n.page)).toEqual([
        { title: "Startseite", url: "/de" },
        { title: "Über uns", url: "/de/about" },
      ]);
      const nav = await cms.navs("main").tree().site("de").get();
      expect(nav.data.map((i) => [i.page.title, i.page.entry_id])).toEqual([
        ["Hallo headquery", halloId],
        ["GitHub", null],
      ]);
      expect((await cms.navs("main").tree().get()).data[0]?.page.title).toBe("Hello headquery");
    });

    it("404s for unknown sites on site-aware endpoints and ignores site elsewhere", async () => {
      const status = (p: Promise<unknown>) => p.then(() => 200).catch((e: HeadqueryHttpError) => e.status);
      expect(await status(entries.site("xx").get())).toBe(404);
      // find() resolves the 404 to null.
      expect(await cms.taxonomies("tags").find("php").site("xx").get()).toBeNull();
      expect(await status(cms.globals("settings").site("xx").get())).toBe(404);
      expect(await status(cms.collections("pages").tree().site("xx").get())).toBe(404);
      expect(await status(cms.navs("main").tree().site("xx").get())).toBe(404);
      // Statamic bug: an unknown site on the globals list is a 500.
      expect(await status(cms.globals().site("xx").get())).toBe(500);
      expect(await status(cms.navs().site("xx").get())).toBe(200);
      expect(await status(cms.forms().site("xx").get())).toBe(200);
      expect(await status(cms.sites().site("xx").get())).toBe(200);
      expect(await status(cms.users().site("xx").get())).toBe(200);
      expect(await status(cms.assets("assets").site("xx").get())).toBe(200);
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
