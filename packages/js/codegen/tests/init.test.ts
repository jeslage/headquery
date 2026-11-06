import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig, resolveOptions } from "../src";
import { initDefaults, parseSourceInput, renderConfig, renderNextSteps, type InitContext } from "../src/init";

const ctx = (overrides: Partial<InitContext> = {}): InitContext => ({
  env: {},
  hasSrcDir: false,
  hasLibDir: false,
  hasTsconfig: true,
  packageJson: { type: "module" },
  nodeStripsTypes: true,
  ...overrides,
});

describe("initDefaults", () => {
  it("picks the output directory", () => {
    expect(initDefaults(ctx({ hasSrcDir: true, hasLibDir: true })).out).toBe("src/cms.generated.ts");
    expect(initDefaults(ctx({ hasLibDir: true })).out).toBe("lib/cms.generated.ts");
    expect(initDefaults(ctx()).out).toBe("cms.generated.ts");
    expect(initDefaults(ctx({ hasSrcDir: true }), { out: "types/cms.ts" }).out).toBe("types/cms.ts");
  });

  it("picks a config format Node can load", () => {
    expect(initDefaults(ctx()).format).toBe("ts");
    expect(initDefaults(ctx({ packageJson: {} })).format).toBe("mts");
    expect(initDefaults(ctx({ hasTsconfig: false })).format).toBe("mjs");
    expect(initDefaults(ctx({ nodeStripsTypes: false })).format).toBe("mjs");
  });

  it("takes the source from flags, then $HEADQUERY_BASE_URL", () => {
    const env = { HEADQUERY_BASE_URL: "https://env.test/" };
    expect(initDefaults(ctx({ env }), { baseUrl: "https://flag.test/" }).source).toEqual({ baseUrl: "https://flag.test" });
    expect(initDefaults(ctx({ env }), { from: "schema.json" }).source).toBe("schema.json");
    expect(initDefaults(ctx({ env })).source).toEqual({ baseUrl: "https://env.test" });
    expect(initDefaults(ctx()).source).toBeUndefined();
  });

  it("rejects conflicting or invalid flags", () => {
    expect(() => initDefaults(ctx(), { baseUrl: "https://a.test", from: "b.json" })).toThrow(/either --from/);
    expect(() => initDefaults(ctx(), { baseUrl: "cms.test" })).toThrow(/http\(s\) URL/);
  });
});

describe("parseSourceInput", () => {
  it("treats http(s) answers as base URL and the rest as files", () => {
    expect(parseSourceInput(" https://cms.test/ ")).toEqual({ baseUrl: "https://cms.test" });
    expect(parseSourceInput("./schema.json")).toBe("./schema.json");
  });
});

describe("renderConfig", () => {
  let dir: string | undefined;
  afterEach(async () => {
    vi.unstubAllEnvs();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  // The rendered file imports @headquery/codegen, which resolves from this package's own tests.
  const load = async (text: string, name: string) => {
    dir = await mkdtemp(join(tmpdir(), "headquery-init-"));
    const file = join(dir, name);
    await writeFile(file, text.replace(`from "@headquery/codegen"`, `from ${JSON.stringify(new URL("../dist/index.js", import.meta.url).href)}`));
    return { file, config: await loadConfig(file) };
  };

  it("renders a loadable base URL config with an env override", async () => {
    const text = renderConfig({ source: { baseUrl: "https://cms.test" }, out: "src/cms.generated.ts" });
    expect(text).toContain(`process.env.HEADQUERY_BASE_URL ?? "https://cms.test"`);

    vi.stubEnv("HEADQUERY_BASE_URL", "");
    delete process.env.HEADQUERY_BASE_URL;
    const loaded = await load(text, "a.mjs");
    expect(resolveOptions({}, { config: loaded.config, path: loaded.file }).from).toBe("https://cms.test/api/headquery/schema");

    vi.stubEnv("HEADQUERY_BASE_URL", "https://override.test");
    const overridden = await load(text, "b.mjs");
    expect(overridden.config.from).toEqual({ baseUrl: "https://override.test" });
  });

  it("renders a file source without env hints", async () => {
    const text = renderConfig({ source: "./schema.json", out: "cms.ts" });
    expect(text).not.toContain("HEADQUERY_SCHEMA_TOKEN");
    expect((await load(text, "c.mjs")).config).toEqual({ from: "./schema.json", out: "cms.ts" });
  });
});

describe("renderNextSteps", () => {
  const base = { out: "src/cms.generated.ts", configFile: "headquery.config.ts", hasCodegenDependency: true };

  it("prints scripts and env lines for a CMS source", () => {
    const text = renderNextSteps({ ...base, source: { baseUrl: "https://cms.test" } });
    expect(text).toContain(`"cms:types": "headquery generate"`);
    expect(text).toContain("HEADQUERY_BASE_URL=https://cms.test");
    expect(text).toContain("HEADQUERY_SCHEMA_TOKEN=");
    expect(text).not.toContain("npm install");
  });

  it("skips env lines for files and suggests installing the CLI", () => {
    const text = renderNextSteps({ ...base, source: "schema.json", hasCodegenDependency: false });
    expect(text).not.toContain("HEADQUERY_BASE_URL");
    expect(text).toContain("npm install -D @headquery/codegen");
  });
});
