import { render, screen } from "@testing-library/react";

// CopilotDockProvider.tsx và CopilotDock.tsx (qua DockChat.tsx) import tĩnh
// "@copilotkit/react-core/v2" — package thật kéo theo @segment/analytics-node,
// một gói ESM mà transform ts-jest hiện tại không biên dịch được (lỗi
// "Unexpected token 'export'"). Các test copilot khác né được vấn đề này vì
// không test trực tiếp CopilotDockProvider/CopilotDock. Ở đây stub tối thiểu
// đúng những export mà 2 file trên thực sự dùng, để require() qua được mà
// KHÔNG cần chạm vào code sản xuất.
jest.mock("@copilotkit/react-core/v2", () => ({
  CopilotKit: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCopilotKit: () => ({ copilotkit: { headers: {}, setHeaders: jest.fn() } }),
  CopilotChat: () => null,
}));

// Theo dõi useAuth để chứng minh khi flag tắt, cả nhánh CopilotKit (AuthHeaders
// nằm bên trong <CopilotKit>) lẫn CopilotDock đều KHÔNG được render — nếu
// chúng có render, useAuth sẽ bị gọi (AuthHeaders và DockChat đều gọi nó).
const mockUseAuth = jest.fn(() => ({ token: null, user: null }));
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("CopilotDockProvider / ranh giới flag NEXT_PUBLIC_COPILOT_DOCK", () => {
  const OLD = process.env.NEXT_PUBLIC_COPILOT_DOCK;

  beforeEach(() => {
    mockUseAuth.mockClear();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_COPILOT_DOCK = OLD;
    jest.resetModules();
  });

  it("flag tắt (unset) → /applications chỉ render children, không có dock chrome hay CopilotKit provider", () => {
    delete process.env.NEXT_PUBLIC_COPILOT_DOCK;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const CopilotDockProvider = require("../CopilotDockProvider").default;

    render(
      <CopilotDockProvider page="applications">
        <div data-testid="page-content">Nội dung trang /applications</div>
      </CopilotDockProvider>,
    );

    // Trang gốc render y nguyên...
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    // ...và KHÔNG có bất kỳ chrome nào của dock (nút mở/thu gọn, panel trợ lý).
    expect(screen.queryByLabelText("Mở trợ lý AI")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Trợ lý AI")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Thu gọn trợ lý")).not.toBeInTheDocument();
    // ...và nhánh <CopilotKit> (AuthHeaders/DockStyles/CopilotDock) chưa từng
    // được mount — nếu nó có mount, useAuth (được cả AuthHeaders lẫn DockChat
    // gọi) sẽ bị gọi ít nhất 1 lần.
    expect(mockUseAuth).not.toHaveBeenCalled();
  });

  it('flag tắt với bất kỳ giá trị nào khác "1" (an toàn khi lỡ set sai)', () => {
    process.env.NEXT_PUBLIC_COPILOT_DOCK = "true";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const CopilotDockProvider = require("../CopilotDockProvider").default;

    render(
      <CopilotDockProvider page="jobs">
        <div data-testid="page-content">Nội dung trang /jobs</div>
      </CopilotDockProvider>,
    );

    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.queryByLabelText("Mở trợ lý AI")).not.toBeInTheDocument();
    expect(mockUseAuth).not.toHaveBeenCalled();
  });
});
