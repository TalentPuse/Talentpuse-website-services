import { render } from "@testing-library/react";

const themeProviderProps: Record<string, unknown>[] = [];
jest.mock("next-themes", () => ({
  ThemeProvider: (props: Record<string, unknown>) => {
    themeProviderProps.push(props);
    return <>{props.children as React.ReactNode}</>;
  },
}));
jest.mock("sonner", () => ({ Toaster: () => null }));
// useAuth phai co trong mock: <Providers> nay render <AnalyticsIdentity/>, ma
// component do goi useAuth(). Mock thieu no thi test chet vi "useAuth is not a
// function" — loi cua mock, khong phai cua theme dang duoc kiem o day.
// user: null = khach chua dang nhap, nhanh don gian nhat.
jest.mock("@/context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: null }),
}));

import { Providers } from "../providers";

describe("Providers — theme", () => {
  beforeEach(() => { themeProviderProps.length = 0; });

  it("ép theme sáng cho MỌI user, kể cả người đã lỡ lưu 'dark' trong localStorage", () => {
    render(<Providers><div /></Providers>);
    expect(themeProviderProps[0].forcedTheme).toBe("light");
  });
});
