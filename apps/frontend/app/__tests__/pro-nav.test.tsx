import { render } from "@testing-library/react";
import SideNav from "@/components/shell/SideNav";
import { useAuth } from "@/context/AuthContext";

// SideNav uses next/navigation usePathname — mock it for jsdom
jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

// Use jest.fn so each test can return different user tiers
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("Pro Insights nav gating", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("free user hides Pro Insights", () => {
    mockedUseAuth.mockReturnValue({
      user: { subscription_tier: "free", is_admin: false } as any,
      token: null,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
    });
    const { queryAllByText, container } = render(<SideNav />);
    expect(queryAllByText("Pro Insights").length).toBe(0);
    expect(container.textContent).not.toContain("Pro Insights");
    // Brief's original assertion preserved semantically: free user must not see label
    // queryByText would throw on duplicate when present, so we use queryAllByText
  });

  test("pro user shows Pro Insights", () => {
    mockedUseAuth.mockReturnValue({
      user: { subscription_tier: "pro", is_admin: false } as any,
      token: null,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
    });
    const { queryAllByText } = render(<SideNav />);
    expect(queryAllByText("Pro Insights").length).toBeGreaterThan(0);
  });

  test("admin shows Pro Insights", () => {
    mockedUseAuth.mockReturnValue({
      user: { subscription_tier: "free", is_admin: true } as any,
      token: null,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
    });
    const { queryAllByText } = render(<SideNav />);
    expect(queryAllByText("Pro Insights").length).toBeGreaterThan(0);
  });
});
