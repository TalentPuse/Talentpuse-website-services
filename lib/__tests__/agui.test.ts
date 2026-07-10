import { resolveAgentBaseUrl } from "@/lib/agui";

describe("resolveAgentBaseUrl", () => {
  it("ưu tiên API_BASE_INTERNAL (server-side trong Docker)", () => {
    expect(
      resolveAgentBaseUrl({
        API_BASE_INTERNAL: "http://backend:8001",
        NEXT_PUBLIC_API_BASE: "http://localhost:8001",
      }),
    ).toBe("http://backend:8001/api/agent");
  });

  it("fallback NEXT_PUBLIC_API_BASE rồi localhost", () => {
    expect(
      resolveAgentBaseUrl({ NEXT_PUBLIC_API_BASE: "http://x:8001" }),
    ).toBe("http://x:8001/api/agent");
    expect(resolveAgentBaseUrl({})).toBe("http://localhost:8001/api/agent");
  });

  it("cắt dấu / thừa cuối base", () => {
    expect(
      resolveAgentBaseUrl({ API_BASE_INTERNAL: "http://backend:8001/" }),
    ).toBe("http://backend:8001/api/agent");
  });
});
