import { render, screen } from "@testing-library/react";

import CopilotDockProvider from "../CopilotDockProvider";

// CopilotDockProvider.tsx và CopilotDock.tsx (qua DockChat.tsx) import tĩnh
// "@copilotkit/react-core/v2" — package thật kéo theo @segment/analytics-node,
// một gói ESM mà transform ts-jest hiện tại không biên dịch được (lỗi
// "Unexpected token 'export'"). Stub tối thiểu đúng những export mà 2 file trên
// thực sự dùng, để import qua được mà KHÔNG cần chạm vào code sản xuất.
jest.mock("@copilotkit/react-core/v2", () => ({
  CopilotKit: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCopilotKit: () => ({ copilotkit: { headers: {}, setHeaders: jest.fn() } }),
  CopilotChat: () => null,
}));

// AuthHeaders (nam trong <CopilotKit>) va DockChat deu goi useAuth. Theo doi no
// de chung minh nhanh CopilotKit CO duoc mount, thay vi doan qua DOM.
const mockUseAuth = jest.fn(() => ({ token: null, user: null }));
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// File nay TRUOC DAY kiem "ranh gioi flag NEXT_PUBLIC_COPILOT_DOCK": dock chi
// bat khi bien env == "1" luc BUILD. Co che do da bi go bo.
//
// Ly do go: no phu thuoc mot GitHub Variable, va khi bien do khong ton tai thi
// `${{ vars.X }}` no ra CHUOI RONG — dock im lang bien mat tren production
// trong khi CI van xanh va khong co mot tin hieu nao. Da xay ra that. Mot
// kill-switch co trang thai mac dinh la TAT, lai chi doi duoc bang mot lan
// rebuild toan bo anh, thi hai nhieu hon loi no chan.
//
// Gio dock LUON bat, nen khong con truong hop "tat" de kiem — cac khang dinh
// duoi day la NGUOC lai voi ban cu, co chu dich.
describe("CopilotDockProvider", () => {
  beforeEach(() => mockUseAuth.mockClear());

  it("luon boc children trong CopilotKit — khong con dieu kien env nao", () => {
    render(
      <CopilotDockProvider page="applications">
        <div data-testid="page-content">Nội dung trang /applications</div>
      </CopilotDockProvider>,
    );

    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(mockUseAuth).toHaveBeenCalled();
  });

  it("bat tren ca trang /jobs, khong rieng /applications", () => {
    render(
      <CopilotDockProvider page="jobs">
        <div data-testid="page-content">Nội dung trang /jobs</div>
      </CopilotDockProvider>,
    );

    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(mockUseAuth).toHaveBeenCalled();
  });
});
