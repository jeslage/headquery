import { describe, expect, it } from "vitest";
import { loadSchema, SchemaLoadError } from "../src";
import { formatLoadError, troubleshoot } from "../src/cli/troubleshoot";

const URL_ = "https://cms.test/api/headquery/schema";

const failWith = async (fetchImpl: typeof fetch, token?: string): Promise<SchemaLoadError> => {
  const error = await loadSchema(URL_, { fetch: fetchImpl, ...(token ? { token } : {}) }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SchemaLoadError);
  return error as SchemaLoadError;
};

// What undici throws: TypeError("fetch failed") with the system error as cause.
const networkError = (code: string, message: string) =>
  (async () => {
    throw new TypeError("fetch failed", { cause: Object.assign(new Error(message), { code }) });
  }) as unknown as typeof fetch;

const respond = (body: string, init: ResponseInit) => (async () => new Response(body, init)) as unknown as typeof fetch;

describe("loadSchema errors", () => {
  it("shows the system error behind 'fetch failed'", async () => {
    const error = await failWith(networkError("ECONNREFUSED", "connect ECONNREFUSED 127.0.0.1:8000"));
    expect(error.message).toBe(`headquery codegen: couldn't reach ${URL_}: connect ECONNREFUSED 127.0.0.1:8000`);
    expect(error).toMatchObject({ kind: "network", code: "ECONNREFUSED", source: URL_, sentToken: false });
  });

  it("unwraps AggregateErrors (one error per address)", async () => {
    const fetchImpl = (async () => {
      const inner = Object.assign(new Error("connect ECONNREFUSED ::1:8000"), { code: "ECONNREFUSED" });
      throw new TypeError("fetch failed", {
        cause: Object.assign(new AggregateError([inner]), { code: "ECONNREFUSED" }),
      });
    }) as unknown as typeof fetch;
    expect((await failWith(fetchImpl)).message).toContain("connect ECONNREFUSED ::1:8000");
  });

  it("reports HTTP status and whether a token was sent", async () => {
    const error = await failWith(respond("", { status: 401, statusText: "Unauthorized" }), "abc");
    expect(error.message).toBe(`headquery codegen: ${URL_} responded 401 Unauthorized`);
    expect(error).toMatchObject({ kind: "http", status: 401, statusText: "Unauthorized", sentToken: true });
    expect(error.body).toBeUndefined();
  });

  it("reports non-JSON responses with their start", async () => {
    const error = await failWith(respond("<!doctype html><html>", { headers: { "content-type": "text/html" } }));
    expect(error.message).toContain("didn't return JSON (text/html)");
    expect(error).toMatchObject({ kind: "json", status: 200, contentType: "text/html", body: "<!doctype html><html>" });
  });

  it("reports missing files", async () => {
    const error = (await loadSchema("does-not-exist.json").catch((e: unknown) => e)) as SchemaLoadError;
    expect(error).toMatchObject({ kind: "file", code: "ENOENT" });
  });
});

describe("troubleshoot (statamic)", () => {
  const hint = async (fetchImpl: typeof fetch, token?: string) =>
    troubleshoot(await failWith(fetchImpl, token), "statamic");

  it("names the likely cause", async () => {
    const likely = async (fetchImpl: typeof fetch, token?: string) => (await hint(fetchImpl, token)).likely?.join(" ");
    expect(await likely(respond("", { status: 404 }))).toContain("HEADQUERY_SCHEMA_ROUTE=true");
    expect(await likely(respond("", { status: 401 }))).toContain("No token was sent");
    expect(await likely(respond("", { status: 401 }), "abc")).toContain("doesn't match");
    expect(await likely(respond("", { status: 500 }))).toContain("laravel.log");
    expect(await likely(networkError("ECONNREFUSED", "x"))).toContain("Is the CMS running?");
    expect(await likely(networkError("SELF_SIGNED_CERT_IN_CHAIN", "x"))).toContain("--use-system-ca");
    expect(await likely(networkError("ERR_SSL_PACKET_LENGTH_TOO_LONG", "x"))).toContain("use http://");
  });

  it("links the troubleshooting docs, also without a likely cause", async () => {
    const { likely, docs } = troubleshoot(await failWith(networkError("EWHATEVER", "x")), "statamic");
    expect(likely).toBeUndefined();
    expect(docs).toMatch(/\/cms\/statamic\/troubleshooting$/);
  });

  it("links the section of the likely cause", async () => {
    const anchor = async (fetchImpl: typeof fetch) => (await hint(fetchImpl)).docs.split("#")[1];
    expect(await anchor(respond("", { status: 404 }))).toBe("404-not-found");
    expect(await anchor(respond("", { status: 401 }))).toBe("401-unauthorized");
    expect(await anchor(respond("", { status: 503 }))).toBe("500-internal-server-error");
    expect(await anchor(respond("<html>", { status: 200 }))).toBe("not-json");
    expect(await anchor(networkError("ECONNREFUSED", "x"))).toBe("econnrefused");
    expect(await anchor(networkError("EAI_AGAIN", "x"))).toBe("enotfound");
    expect(await anchor(networkError("SELF_SIGNED_CERT_IN_CHAIN", "x"))).toBe("certificate");
    expect(await anchor(networkError("ERR_SSL_PACKET_LENGTH_TOO_LONG", "x"))).toBe("tls");
    expect(await anchor(respond("", { status: 418 }))).toBeUndefined();
    const file = (await loadSchema("does-not-exist.json").catch((e: unknown) => e)) as SchemaLoadError;
    expect(troubleshoot(file, "statamic").likely?.join(" ")).toContain("php please headquery:schema");
  });
});

describe("formatLoadError", () => {
  it("leads with the status and shows the response, the cause and the docs link", async () => {
    const error = await failWith(
      respond(`{"message":"Not Found"}`, {
        status: 404,
        statusText: "Not Found",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(formatLoadError(error, "statamic", { width: 80 })).toMatchInlineSnapshot(`
      "✗ The schema endpoint responded 404 Not Found

        URL       https://cms.test/api/headquery/schema
        Status    404 Not Found
        Type      application/json
        Token     not sent
        Response  {"message":"Not Found"}

        ● Likely cause
          The schema route doesn't answer. The CMS's .env needs the schema route
          (without a token it stays 404) and Statamic's REST API, which is a Pro
          feature:

            HEADQUERY_SCHEMA_ROUTE=true
            HEADQUERY_SCHEMA_TOKEN=<same value as in the frontend>
            STATAMIC_API_ENABLED=true
            STATAMIC_PRO_ENABLED=true

          Then clear the cached config on the CMS:

            php artisan config:clear

          If you changed statamic.api.route or headquery.schema.path, set
          \`from.apiPrefix\` / \`from.schemaPath\` in the config.

        ╭─ → More help ───────────────────────────────────────────────────────────╮
        │ The troubleshooting docs explain this error step by step, with the      │
        │ commands to fix it:                                                     │
        │ https://headquery.vercel.app/cms/statamic/troubleshooting#404-not-found │
        ╰─────────────────────────────────────────────────────────────────────────╯"
    `);
  });

  it("shows the system error for network failures", async () => {
    const text = formatLoadError(
      await failWith(networkError("ECONNREFUSED", "connect ECONNREFUSED 127.0.0.1:8000")),
      "statamic",
    );
    expect(text).toContain("✗ Couldn't reach the CMS: ECONNREFUSED");
    expect(text).toMatch(/Error\s+connect ECONNREFUSED 127\.0\.0\.1:8000/);
    expect(text).toContain("Is the CMS running?");
  });

  it("renders the docs URL through the link option, on its own line in the box", async () => {
    const text = formatLoadError(await failWith(respond("", { status: 401 })), "statamic", {
      link: (url) => `<${url}>`,
    });
    expect(text).toMatch(
      /\n {2}│ <https:\/\/headquery\.vercel\.app\/cms\/statamic\/troubleshooting#401-unauthorized> +│\n/,
    );
  });
});
