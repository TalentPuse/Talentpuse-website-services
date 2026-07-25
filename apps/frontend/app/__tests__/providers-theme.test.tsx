import { render } from "@testing-library/react";

const themeProviderProps: Record<string, unknown>[] = [];
jest.mock("next-themes", () => ({
  ThemeProvider: (props: Record<string, unknown>) => {
    themeProviderProps.push(props);
    return <>{props.children as React.ReactNode}</>;
  },
}));
jest.mock("sonner", () => ({ Toaster: () => null }));
jest.mock("@/context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { Providers } from "../providers";

describe("Providers — theme", () => {
  beforeEach(() => { themeProviderProps.length = 0; });

  it("ép theme sáng cho MỌI user, kể cả người đã lỡ lưu 'dark' trong localStorage", () => {
    render(<Providers><div /></Providers>);
    expect(themeProviderProps[0].forcedTheme).toBe("light");
  });
});
