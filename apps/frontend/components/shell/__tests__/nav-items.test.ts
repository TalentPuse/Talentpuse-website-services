import { NAV_ITEMS } from "../nav-items";

describe("NAV_ITEMS", () => {
  it("KHÔNG còn lối vào luyện phỏng vấn", () => {
    expect(NAV_ITEMS.some((i) => i.href === "/interview")).toBe(false);
  });

  it("vẫn giữ đủ các mục còn lại", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(hrefs).toEqual(
      expect.arrayContaining(["/dashboard", "/jobs", "/assistant", "/alerts", "/applications", "/profile"]),
    );
  });
});
