import { describe, expect, it } from "vitest";
import { joinUrl, serializeQuery } from "../src";

describe("serializeQuery", () => {
  it("sorts keys so call order does not change the URL", () => {
    const a = serializeQuery({ sort: "-date", limit: 10, "filter[title:contains]": "hi" });
    const b = serializeQuery({ "filter[title:contains]": "hi", limit: 10, sort: "-date" });
    expect(a).toBe(b);
    expect(a).toBe("filter[title:contains]=hi&limit=10&sort=-date");
  });

  it("drops undefined and null, joins arrays with commas", () => {
    expect(serializeQuery({ fields: ["title", "slug"], page: undefined, site: null })).toBe("fields=title,slug");
  });

  it("encodes reserved characters in values", () => {
    expect(serializeQuery({ "filter[title:is]": "a&b c" })).toBe("filter[title:is]=a%26b%20c");
  });
});

describe("joinUrl", () => {
  it("normalises slashes", () => {
    expect(joinUrl("https://cms.test/", "/api/", "/collections/blog/entries")).toBe(
      "https://cms.test/api/collections/blog/entries",
    );
    expect(joinUrl("https://cms.test", "", "x", { a: 1 })).toBe("https://cms.test/x?a=1");
  });
});
