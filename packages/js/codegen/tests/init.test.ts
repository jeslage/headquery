import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig, resolveOptions } from "../src";
import {
  clientPath,
  defaultEnvFile,
  detectAdapter,
  detectFramework,
  detectPackageManager,
  envLines,
  type InitContext,
  initDefaults,
  initPrompts,
  isGitignored,
  mergeEnv,
  mergeScripts,
  parseSourceInput,
  renderClient,
  renderConfig,
  renderNextSteps,
} from "../src/cli/init";

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
    expect(initDefaults(ctx({ env }), { baseUrl: "https://flag.test/" }).source).toEqual({
      baseUrl: "https://flag.test",
    });
    expect(initDefaults(ctx({ env }), { from: "schema.json" }).source).toBe("schema.json");
    expect(initDefaults(ctx({ env })).source).toEqual({ baseUrl: "https://env.test" });
    expect(initDefaults(ctx()).source).toBeUndefined();
  });

  it("falls back to HEADQUERY_BASE_URL from a dotenv file and says where defaults come from", () => {
    const dotenv = { file: ".env.local", baseUrl: "https://dotenv.test" };
    const d = initDefaults(ctx({ dotenv, hasSrcDir: true }));
    expect(d.source).toEqual({ baseUrl: "https://dotenv.test" });
    expect(d.sourceOrigin).toBe("HEADQUERY_BASE_URL in .env.local");
    expect(d.outOrigin).toBe("src/ exists");
    // the real environment wins over the file
    expect(initDefaults(ctx({ dotenv, env: { HEADQUERY_BASE_URL: "https://env.test" } })).sourceOrigin).toBe(
      "$HEADQUERY_BASE_URL",
    );
  });

  it("detects the framework unless --framework is given", () => {
    const next = ctx({ packageJson: { dependencies: { next: "15", vite: "6" } } });
    expect(initDefaults(next)).toMatchObject({ framework: "next", frameworkOrigin: "detected from package.json" });
    expect(initDefaults(next, { framework: "vite" })).toMatchObject({
      framework: "vite",
      frameworkOrigin: "--framework",
    });
    expect(initDefaults(ctx()).framework).toBe("node");
  });

  it("rejects conflicting or invalid flags", () => {
    expect(() => initDefaults(ctx(), { baseUrl: "https://a.test", from: "b.json" })).toThrow(/either --from/);
    expect(() => initDefaults(ctx(), { baseUrl: "cms.test" })).toThrow(/http\(s\) URL/);
    expect(() => initDefaults(ctx(), { framework: "nope" })).toThrow(/next, nuxt, vite, node/);
  });
});

describe("initPrompts", () => {
  it("pre-fills the default and says where it comes from, or explains why there is none", () => {
    const withDefault = initPrompts(initDefaults(ctx({ env: { HEADQUERY_BASE_URL: "https://cms.test" } })));
    expect(withDefault.intro).toBe("Creating headquery.config.ts");
    expect(withDefault.source).toEqual({
      message: "CMS base URL or schema file (default from $HEADQUERY_BASE_URL)",
      initialValue: "https://cms.test",
    });
    expect(withDefault.out).toEqual({
      message: "Output file for the generated types (no src/ or lib/ folder)",
      initialValue: "cms.generated.ts",
    });
    const none = initPrompts(initDefaults(ctx())).source;
    expect(none.message).toContain("no default: HEADQUERY_BASE_URL isn't set");
    expect(none.placeholder).toBe("https://cms.example.com or ./schema.json");
    expect(none.initialValue).toBeUndefined();
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
    await writeFile(
      file,
      text.replace(
        `from "@headquery/codegen"`,
        `from ${JSON.stringify(new URL("../dist/index.js", import.meta.url).href)}`,
      ),
    );
    return { file, config: await loadConfig(file) };
  };

  it("renders a loadable base URL config with an env override", async () => {
    const text = renderConfig({ source: { baseUrl: "https://cms.test" }, out: "src/cms.generated.ts" });
    expect(text).toContain(`process.env.HEADQUERY_BASE_URL ?? "https://cms.test"`);

    vi.stubEnv("HEADQUERY_BASE_URL", "");
    delete process.env.HEADQUERY_BASE_URL;
    const loaded = await load(text, "a.mjs");
    expect(resolveOptions({}, { config: loaded.config, path: loaded.file }).from).toBe(
      "https://cms.test/api/headquery/schema",
    );

    vi.stubEnv("HEADQUERY_BASE_URL", "https://override.test");
    const overridden = await load(text, "b.mjs");
    expect(overridden.config.from).toEqual({ baseUrl: "https://override.test" });
  });

  it("loads the env file next to the config, if one was written", async () => {
    const text = renderConfig({ source: { baseUrl: "https://cms.test" }, out: "cms.ts", envFile: ".env.test" });
    expect(text).not.toContain("// process.loadEnvFile");
    vi.stubEnv("HEADQUERY_BASE_URL", "");
    delete process.env.HEADQUERY_BASE_URL;
    // a missing env file is fine
    expect((await load(text, "d.mjs")).config.from).toEqual({ baseUrl: "https://cms.test" });
    await writeFile(join(dir!, ".env.test"), "HEADQUERY_BASE_URL=https://dotenv.test\n");
    const file = join(dir!, "e.mjs");
    await writeFile(file, await readFile(join(dir!, "d.mjs"), "utf8"));
    expect((await loadConfig(file)).from).toEqual({ baseUrl: "https://dotenv.test" });
    delete process.env.HEADQUERY_BASE_URL;
  });

  it("renders a file source without env hints", async () => {
    const text = renderConfig({ source: "./schema.json", out: "cms.ts" });
    expect(text).not.toContain("HEADQUERY_SCHEMA_TOKEN");
    expect((await load(text, "c.mjs")).config).toEqual({ from: "./schema.json", out: "cms.ts" });
  });
});

describe("client file", () => {
  it("finds the adapter and picks a path next to the generated types", () => {
    expect(detectAdapter({ devDependencies: { "@headquery/statamic": "^0.1" } })).toBe("@headquery/statamic");
    expect(detectAdapter({ dependencies: { react: "19" } })).toBeUndefined();
    expect(detectFramework({ dependencies: { nuxt: "4", vite: "7" } })).toBe("nuxt");
    expect(detectFramework({ devDependencies: { vite: "7" } })).toBe("vite");
    expect(clientPath("src/cms.generated.ts")).toBe("src/cms.ts");
    expect(clientPath("cms.generated.ts")).toBe("cms.ts");
    expect(clientPath("lib/cms.ts")).toBe("lib/client.ts");
  });

  const client = (framework: "next" | "nuxt" | "vite" | "node", source: string | { baseUrl: string }) =>
    renderClient({
      adapter: "@headquery/statamic",
      framework,
      source,
      clientPath: "src/cms.ts",
      out: "src/cms.generated.ts",
    });

  it("passes the generated Schema and reads the base URL the framework's way", () => {
    const next = client("next", { baseUrl: "https://cms.test" });
    expect(next).toContain(`import type { Schema } from "./cms.generated";`);
    expect(next).toContain(`export const cms = createStatamicClient<Schema>({`);
    expect(next).toContain(`baseUrl: process.env.NEXT_PUBLIC_HEADQUERY_BASE_URL ?? "https://cms.test",`);
    expect(client("vite", { baseUrl: "https://cms.test" })).toContain(
      `import.meta.env.VITE_HEADQUERY_BASE_URL ?? "https://cms.test"`,
    );
    expect(client("node", { baseUrl: "https://cms.test" })).toContain(
      `process.env.HEADQUERY_BASE_URL ?? "https://cms.test"`,
    );
    const nuxt = client("nuxt", { baseUrl: "https://cms.test" });
    expect(nuxt).toContain(`baseUrl: "https://cms.test",`);
    expect(nuxt).toContain("runtimeConfig");
  });

  it("falls back to a placeholder for file sources and imports across folders", () => {
    expect(client("node", "schema.json")).toContain("// TODO");
    const text = renderClient({
      adapter: "@headquery/statamic",
      framework: "node",
      source: "schema.json",
      clientPath: "app/cms.ts",
      out: "types/cms.generated.ts",
    });
    expect(text).toContain(`from "../types/cms.generated"`);
  });
});

describe("mergeScripts", () => {
  it("adds missing scripts and keeps indentation and the trailing newline", () => {
    const merged = mergeScripts(`{\n    "name": "app",\n    "scripts": { "dev": "next dev" }\n}\n`);
    expect(merged.added).toEqual(["cms:types", "cms:types:check"]);
    expect(merged.text).toContain(
      `\n    "scripts": {\n        "dev": "next dev",\n        "cms:types": "headquery generate",`,
    );
    expect(merged.text.endsWith("}\n")).toBe(true);
  });

  it("never overwrites existing scripts", () => {
    const text = JSON.stringify({ scripts: { "cms:types": "headquery generate", "cms:types:check": "custom" } });
    expect(mergeScripts(text)).toEqual({ text, added: [], skipped: ["cms:types:check"] });
  });
});

describe("env lines", () => {
  const source = { baseUrl: "https://cms.test" };

  it("adds the client's variable only when it differs and a client was written", () => {
    expect(envLines({ source, framework: "next", client: true })).toEqual([
      "HEADQUERY_BASE_URL=https://cms.test",
      "HEADQUERY_SCHEMA_TOKEN=",
      "NEXT_PUBLIC_HEADQUERY_BASE_URL=https://cms.test",
    ]);
    expect(envLines({ source, framework: "next", client: false })).toHaveLength(2);
    expect(envLines({ source, framework: "node", client: true })).toHaveLength(2);
    expect(envLines({ source: "schema.json", framework: "node", client: true })).toEqual([]);
  });

  it("appends only keys that aren't set yet", () => {
    const lines = envLines({ source, framework: "node", client: true });
    expect(mergeEnv(undefined, lines).text).toBe(
      "# headquery\nHEADQUERY_BASE_URL=https://cms.test\nHEADQUERY_SCHEMA_TOKEN=\n",
    );
    const merged = mergeEnv("APP_KEY=1\nexport HEADQUERY_BASE_URL=https://other.test", lines);
    expect(merged).toEqual({
      text: "APP_KEY=1\nexport HEADQUERY_BASE_URL=https://other.test\n\n# headquery\nHEADQUERY_SCHEMA_TOKEN=\n",
      added: ["HEADQUERY_SCHEMA_TOKEN"],
      skipped: ["HEADQUERY_BASE_URL"],
    });
    expect(mergeEnv(merged.text, lines).added).toEqual([]);
  });

  it("picks a default file name and checks .gitignore", () => {
    expect(defaultEnvFile("next")).toBe(".env.local");
    expect(defaultEnvFile("nuxt")).toBe(".env");
    expect(isGitignored("node_modules\n.env*\n", ".env.local")).toBe(true);
    expect(isGitignored("/.env\n", ".env")).toBe(true);
    expect(isGitignored("*.local\n", ".env.local")).toBe(true);
    expect(isGitignored(".env.*\n# .env\n", ".env")).toBe(false);
  });
});

describe("renderNextSteps", () => {
  const base = { out: "src/cms.generated.ts", hasCodegenDependency: true };

  it("prints scripts and env lines when init didn't write them", () => {
    const text = renderNextSteps({ ...base, source: { baseUrl: "https://cms.test" } });
    expect(text).toContain(`"cms:types": "headquery generate"`);
    expect(text).toContain("HEADQUERY_BASE_URL=https://cms.test");
    expect(text).toContain("HEADQUERY_SCHEMA_TOKEN=");
    expect(text).toContain("npx headquery generate");
    expect(text).not.toContain("npm install");
  });

  it("skips what init did and uses the package manager", () => {
    const text = renderNextSteps({
      ...base,
      source: { baseUrl: "https://cms.test" },
      hasCodegenDependency: false,
      packageManager: "pnpm",
      client: "src/cms.ts",
      scripts: true,
      envFile: ".env.local",
    });
    expect(text).toContain("pnpm add -D @headquery/codegen");
    expect(text).toContain("Set HEADQUERY_SCHEMA_TOKEN in .env.local");
    expect(text).toContain("pnpm cms:types");
    expect(text).toContain("Import `cms` from src/cms.ts.");
    expect(text).not.toContain(`"cms:types"`);
    expect(text).not.toContain("HEADQUERY_BASE_URL=");
  });

  it("lists the CMS setup of the adapter", () => {
    const url = renderNextSteps({ ...base, source: { baseUrl: "https://cms.test" }, adapter: "@headquery/statamic" });
    expect(url).toContain(
      [
        "  2. Set up Statamic",
        "     The REST API is a Statamic Pro feature and off by default. Add to the CMS's .env:",
        "",
        "       STATAMIC_PRO_ENABLED=true",
        "       STATAMIC_API_ENABLED=true",
        "       HEADQUERY_SCHEMA_ROUTE=true",
        "       HEADQUERY_SCHEMA_TOKEN=<a long random token>",
      ].join("\n"),
    );
    expect(url).toContain("\n       php artisan config:clear\n");
    const file = renderNextSteps({ ...base, source: "schema.json", adapter: "@headquery/statamic" });
    expect(file).not.toContain("HEADQUERY_SCHEMA_ROUTE");
    expect(file).toContain("\n       php please headquery:schema --out=schema.json");
    expect(renderNextSteps({ ...base, source: "schema.json" })).not.toContain("STATAMIC_API_ENABLED");
  });

  it("skips env lines for files", () => {
    const text = renderNextSteps({ ...base, source: "schema.json", hasCodegenDependency: false });
    expect(text).not.toContain("HEADQUERY_BASE_URL");
    expect(text).toContain("npm install -D @headquery/codegen");
  });
});

describe("detectPackageManager", () => {
  it("prefers the packageManager field, then lockfiles", () => {
    expect(detectPackageManager({ packageManager: "pnpm@9.0.0" }, ["yarn.lock"])).toBe("pnpm");
    expect(detectPackageManager({}, ["yarn.lock"])).toBe("yarn");
    expect(detectPackageManager(undefined, ["bun.lock"])).toBe("bun");
    expect(detectPackageManager(undefined)).toBe("npm");
  });
});
