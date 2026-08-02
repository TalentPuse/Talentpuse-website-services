import { render } from "@testing-library/react";
import UmamiIdentify from "@/components/analytics/UmamiIdentify";

describe("UmamiIdentify", () => {
  beforeEach(() => {
    (window as any).umami = { identify: jest.fn() };
  });

  it("sends only the user id, never profile data", () => {
    render(<UmamiIdentify userId="4f8c0d2e-1111-2222-3333-444455556666" />);
    expect((window as any).umami.identify).toHaveBeenCalledWith({
      userId: "4f8c0d2e-1111-2222-3333-444455556666",
    });
  });

  it("does nothing for anonymous visitors", () => {
    render(<UmamiIdentify userId={null} />);
    expect((window as any).umami.identify).not.toHaveBeenCalled();
  });

  it("does not throw when the tracker failed to load", () => {
    delete (window as any).umami;
    expect(() =>
      render(<UmamiIdentify userId="4f8c0d2e-1111-2222-3333-444455556666" />)
    ).not.toThrow();
  });
});
