import { describe, expect, it, vi } from "vitest";
import { createCoreClient, HeadqueryHttpError, HeadqueryNetworkError } from "../src";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
}

describe("createCoreClient", () => {
  it("sends GET with auth header and parses JSON", async () => {
    const fetch = mockFetch(200, { data: [1] });
    const client = createCoreClient({ baseUrl: "https://cms.test", token: "secret", fetch });

    const res = await client.send({ method: "GET", path: "/collections/blog/entries", query: { limit: 1 } });

    expect(res).toEqual({ data: [1] });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://cms.test/api/collections/blog/entries?limit=1");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    expect(init!.method).toBe("GET");
  });

  it("merges client and per-call fetchOptions (e.g. Next.js revalidate)", async () => {
    const fetch = mockFetch(200, {});
    const client = createCoreClient({ baseUrl: "https://cms.test", fetch, fetchOptions: { cache: "force-cache" } });

    await client.send({ method: "GET", path: "/x" }, { fetchOptions: { next: { revalidate: 60 } } });

    const init = fetch.mock.calls[0]![1] as Record<string, unknown>;
    expect(init.cache).toBe("force-cache");
    expect(init.next).toEqual({ revalidate: 60 });
  });

  it("throws HeadqueryHttpError with parsed body on non-2xx", async () => {
    const client = createCoreClient({ baseUrl: "https://cms.test", fetch: mockFetch(404, { message: "Not found" }) });
    const err = (await client.send({ method: "GET", path: "/x" }).catch((e: unknown) => e)) as HeadqueryHttpError;
    expect(err).toBeInstanceOf(HeadqueryHttpError);
    expect(err.status).toBe(404);
    expect(err.body).toEqual({ message: "Not found" });
  });

  it("wraps network failures", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("offline");
    });
    const client = createCoreClient({ baseUrl: "https://cms.test", fetch });
    await expect(client.send({ method: "GET", path: "/x" })).rejects.toBeInstanceOf(HeadqueryNetworkError);
  });
});
