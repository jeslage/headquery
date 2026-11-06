import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineConfig, findConfig, loadConfig, resolveOptions, schemaEndpointUrl } from "../src";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "headquery-config-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("findConfig", () => {
  it("returns undefined without a config file", async () => {
    expect(await findConfig(dir)).toBeUndefined();
  });

  it("prefers .ts over .mjs over .js", async () => {
    await writeFile(join(dir, "headquery.config.js"), "");
    expect(await findConfig(dir)).toBe(join(dir, "headquery.config.js"));
    await writeFile(join(dir, "headquery.config.mjs"), "");
    expect(await findConfig(dir)).toBe(join(dir, "headquery.config.mjs"));
    await writeFile(join(dir, "headquery.config.ts"), "");
    expect(await findConfig(dir)).toBe(join(dir, "headquery.config.ts"));
  });
});

describe("loadConfig", () => {
  // Unique names: ESM caches modules by URL.
  let n = 0;
  const write = async (body: string) => {
    const file = join(dir, `config-${n++}.mjs`);
    await writeFile(file, body);
    return file;
  };

  it("loads the default export", async () => {
    const file = await write(`export default { from: "./schema.json", out: "src/cms.ts", target: "statamic" };`);
    expect(await loadConfig(file)).toEqual({ from: "./schema.json", out: "src/cms.ts", target: "statamic" });
  });

  it("rejects missing or mistyped fields", async () => {
    await expect(loadConfig(await write(`export default { out: "x.ts" };`))).rejects.toThrow(/`from` must be/);
    await expect(loadConfig(await write(`export default { from: "a", out: "b", token: 1 };`))).rejects.toThrow(
      /`token` must be a string/,
    );
    await expect(loadConfig(await write(`export const config = {};`))).rejects.toThrow(/export default/);
    await expect(loadConfig(await write(`export default { from: { baseUrl: "cms.test" }, out: "b" };`))).rejects.toThrow(
      /`from.baseUrl` must be an http\(s\) URL/,
    );
    await expect(
      loadConfig(await write(`export default { from: { baseUrl: "https://cms.test", apiPrefix: 1 }, out: "b" };`)),
    ).rejects.toThrow(/`from.apiPrefix` must be a string/);
  });

  it("reports a missing file", async () => {
    await expect(loadConfig(join(dir, "nope.mjs"))).rejects.toThrow(/config file not found/);
  });
});

describe("resolveOptions", () => {
  const config = (c: Parameters<typeof defineConfig>[0]) => ({ config: c, path: join(dir, "headquery.config.ts") });

  it("resolves config paths against the config file's directory, URLs untouched", () => {
    expect(resolveOptions({}, config({ from: "./schema.json", out: "src/cms.ts" }))).toEqual({
      from: join(dir, "schema.json"),
      out: join(dir, "src/cms.ts"),
    });
    expect(resolveOptions({}, config({ from: "https://cms.test/api/headquery/schema", out: "a.ts" })).from).toBe(
      "https://cms.test/api/headquery/schema",
    );
  });

  it("lets flags override the config and keeps flag paths as given", () => {
    const resolved = resolveOptions(
      { out: "other.ts", module: "my-module" },
      config({ from: "schema.json", out: "cms.ts", module: "@headquery/statamic" }),
    );
    expect(resolved).toEqual({ from: join(dir, "schema.json"), out: "other.ts", module: "my-module" });
  });

  it("takes the token from flag, then config, then env", () => {
    const env = { HEADQUERY_SCHEMA_TOKEN: "env" };
    const c = config({ from: "a", out: "b", token: "config" });
    expect(resolveOptions({ token: "flag" }, c, env).token).toBe("flag");
    expect(resolveOptions({}, c, env).token).toBe("config");
    expect(resolveOptions({}, config({ from: "a", out: "b" }), env).token).toBe("env");
    expect(resolveOptions({}, undefined, { HEADQUERY_SCHEMA_TOKEN: "" }).token).toBeUndefined();
  });

  it("builds the endpoint URL from `from: { baseUrl }`", () => {
    expect(resolveOptions({}, config({ from: { baseUrl: "https://cms.test/" }, out: "a.ts" })).from).toBe(
      "https://cms.test/api/headquery/schema",
    );
    const custom = config({ from: { baseUrl: "https://cms.test", apiPrefix: "rest/", schemaPath: "/types" }, out: "a" });
    expect(resolveOptions({}, custom).from).toBe("https://cms.test/rest/types");
    // flags override single keys of the endpoint
    expect(resolveOptions({ apiPrefix: "/v2" }, custom).from).toBe("https://cms.test/v2/types");
    expect(resolveOptions({ baseUrl: "http://localhost:8000" }, custom).from).toBe("http://localhost:8000/rest/types");
  });

  it("lets --from and --base-url replace any config source", () => {
    const fileConfig = config({ from: "schema.json", out: "a.ts" });
    expect(resolveOptions({ baseUrl: "https://cms.test" }, fileConfig).from).toBe("https://cms.test/api/headquery/schema");
    const endpointConfig = config({ from: { baseUrl: "https://cms.test" }, out: "a.ts" });
    expect(resolveOptions({ from: "local.json" }, endpointConfig).from).toBe("local.json");
  });

  it("rejects conflicting or incomplete source flags", () => {
    expect(() => resolveOptions({ from: "a.json", baseUrl: "https://cms.test" }, undefined)).toThrow(/either --from/);
    expect(() => resolveOptions({ apiPrefix: "/x" }, undefined)).toThrow(/need --base-url/);
    expect(() => resolveOptions({ baseUrl: "cms.test" }, undefined)).toThrow(/http\(s\) URL/);
  });

  it("works with flags only", () => {
    expect(resolveOptions({ from: "s.json", out: "o.ts" }, undefined)).toEqual({ from: "s.json", out: "o.ts" });
  });
});

describe("schemaEndpointUrl", () => {
  it("joins base URL, prefix and path without double slashes", () => {
    expect(schemaEndpointUrl({ baseUrl: "https://cms.test" })).toBe("https://cms.test/api/headquery/schema");
    expect(schemaEndpointUrl({ baseUrl: "https://cms.test//", apiPrefix: "//api//", schemaPath: "headquery/schema/" })).toBe(
      "https://cms.test/api/headquery/schema",
    );
    expect(schemaEndpointUrl({ baseUrl: "https://cms.test/sub", apiPrefix: "" })).toBe("https://cms.test/sub/headquery/schema");
  });
});

describe("defineConfig", () => {
  it("is typed", () => {
    defineConfig({ from: "a", out: "b", target: "statamic" });
    // @ts-expect-error unknown target
    defineConfig({ from: "a", out: "b", target: "kirby" });
    // @ts-expect-error `out` is required
    defineConfig({ from: "a" });
    defineConfig({ from: { baseUrl: "https://cms.test", apiPrefix: "/api" }, out: "b" });
    // @ts-expect-error `baseUrl` is required in the object form
    defineConfig({ from: { apiPrefix: "/api" }, out: "b" });
  });
});
