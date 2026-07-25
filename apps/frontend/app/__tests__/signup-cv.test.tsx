import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from "node:util";

// jsdom (jest-environment-jsdom) không có sẵn TextEncoder/TextDecoder trong
// global — cả helper pdfFile() dưới đây lẫn looksLikePdf() trong page.tsx
// đều cần chúng. Polyfill tại đây (thay vì jest.setup.ts) vì đây là 2 file
// duy nhất được phép sửa cho task này; các câu lệnh top-level này chạy xong
// trước khi bất kỳ it() nào thực thi, nên thứ tự so với các import phía
// dưới không quan trọng.
const globalRecord = globalThis as unknown as Record<string, unknown>;
if (typeof globalRecord.TextEncoder === "undefined") {
  globalRecord.TextEncoder = NodeTextEncoder;
}
if (typeof globalRecord.TextDecoder === "undefined") {
  globalRecord.TextDecoder = NodeTextDecoder;
}

// jsdom (jest-environment-jsdom@30 / jsdom@26 bundled bên trong) có Blob/File
// nhưng KHÔNG có Blob.prototype.arrayBuffer — looksLikePdf() trong page.tsx
// gọi `file.slice(0, 5).arrayBuffer()` nên cần polyfill bằng FileReader (jsdom
// hỗ trợ đầy đủ FileReader.readAsArrayBuffer).
if (typeof Blob !== "undefined" && !("arrayBuffer" in Blob.prototype)) {
  (Blob.prototype as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer =
    function (this: Blob) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
}

const signup = jest.fn();
const getMe = jest.fn();
const updateMe = jest.fn();
const uploadCv = jest.fn();

jest.mock("@/lib/api", () => ({
  authApi: {
    signup: (...a: unknown[]) => signup(...a),
    getMe: (...a: unknown[]) => getMe(...a),
    updateMe: (...a: unknown[]) => updateMe(...a),
  },
  cvApi: { upload: (...a: unknown[]) => uploadCv(...a) },
  ApiError: class ApiError extends Error {},
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const login = jest.fn();
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ login }) }));

import SignUpPage from "../signup/page";

/** File PDF hợp lệ tối thiểu: 5 byte đầu phải là "%PDF-". */
function pdfFile(name = "cv.pdf", size = 1024) {
  const head = new TextEncoder().encode("%PDF-1.4\n");
  const body = new Uint8Array(Math.max(0, size - head.length));
  return new File([head, body], name, { type: "application/pdf" });
}

async function gotoStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/họ và tên/i), "Nguyen Van A");
  await user.type(screen.getByLabelText(/email/i), "a@example.com");
  await user.type(screen.getByLabelText(/^mật khẩu/i), "MatKhau123!");
  await user.type(screen.getByLabelText(/xác nhận/i), "MatKhau123!");
  await user.click(screen.getByRole("button", { name: /tiếp tục/i }));

  // Step 2 mount sau animation exit/enter của AnimatePresence (mode="wait",
  // 300ms) — đợi UI thật của bước 2 xuất hiện thay vì giả định nó có ngay
  // sau click, nếu không input file phía dưới sẽ luôn là null.
  await waitFor(() => expect(screen.getByText(/kéo thả file pdf/i)).toBeInTheDocument());
}

describe("Signup — upload CV", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signup.mockResolvedValue({ access_token: "tok-1" });
    getMe.mockResolvedValue({ id: "u1", email: "a@example.com" });
    updateMe.mockResolvedValue({});
  });

  it("CV lỗi thì KHÔNG gọi signup lần thứ hai khi thử lại (regression: email bị khoá vĩnh viễn)", async () => {
    const user = userEvent.setup();
    uploadCv.mockRejectedValue(new Error("Không thể đọc file PDF."));
    render(<SignUpPage />);
    await gotoStep2(user);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pdfFile());
    await waitFor(() => expect(uploadCv).toHaveBeenCalledTimes(1));

    // Lỗi CV chuyển UI sang tab "Điền tay" (đúng theo fix: tài khoản đã tạo,
    // đăng nhập rồi, mời điền tay) — quay lại tab Upload CV rồi bấm "Thử lại"
    // để tái hiện đúng đường thoát thứ hai mà bug gốc mô tả (handleCvUpload
    // gọi lại lúc thử lại), rồi khẳng định nó không signup lần nữa.
    await user.click(screen.getByRole("tab", { name: /upload cv/i }));
    await user.click(await screen.findByRole("button", { name: /thử lại/i }));

    const retryInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(retryInput, pdfFile());
    await waitFor(() => expect(uploadCv).toHaveBeenCalledTimes(2));

    expect(signup).toHaveBeenCalledTimes(1);
  });

  it("CV lỗi vẫn đăng nhập user vào, không bỏ mặc ở màn hình lỗi", async () => {
    const user = userEvent.setup();
    uploadCv.mockRejectedValue(new Error("Không thể đọc file PDF."));
    render(<SignUpPage />);
    await gotoStep2(user);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pdfFile());

    await waitFor(() => expect(login).toHaveBeenCalledWith("tok-1", expect.anything()));
  });

  it("từ chối file quá 5MB TRƯỚC khi tạo tài khoản", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);
    await gotoStep2(user);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pdfFile("big.pdf", 6 * 1024 * 1024));

    await waitFor(() => expect(screen.getByText(/5MB/i)).toBeInTheDocument());
    expect(signup).not.toHaveBeenCalled();
    expect(uploadCv).not.toHaveBeenCalled();
  });

  it("từ chối file đổi tên thành .pdf nhưng ruột không phải PDF", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);
    await gotoStep2(user);

    const fake = new File([new TextEncoder().encode("MZ not a pdf")], "cv.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, fake);

    await waitFor(() => expect(screen.getByText(/không phải (file )?PDF/i)).toBeInTheDocument());
    expect(signup).not.toHaveBeenCalled();
    expect(uploadCv).not.toHaveBeenCalled();
  });

  it("hai lần chọn file CV đua nhau ngay trước khi cvStep chuyển sang 'đang phân tích' vẫn chỉ tạo tài khoản một lần (race condition thật)", async () => {
    const user = userEvent.setup();

    // Điều khiển thời điểm signup() resolve theo ý test, thay vì để nó
    // resolve ngay lập tức — để có một khoảng "đang treo" thật sự, đúng
    // khoảng hở mà bug gốc (và createdTokenRef-only fix không đủ) lọt qua.
    let resolveSignup: (value: { access_token: string }) => void;
    const pendingSignup = new Promise<{ access_token: string }>((resolve) => {
      resolveSignup = resolve;
    });
    signup.mockReturnValueOnce(pendingSignup);
    uploadCv.mockResolvedValue({});

    render(<SignUpPage />);
    await gotoStep2(user);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // handleCvUpload() gọi `await looksLikePdf(file)` TRƯỚC KHI setCvStep("analyzing")
    // — trong suốt khoảng chờ FileReader đọc 5 byte đầu, input file vẫn còn
    // mounted và isBusy vẫn là false, nên chẳng có gì bị khoá cả. Đây mới là
    // cửa sổ đua thật sự chưa được test nào che phủ. Bắn hai sự kiện change
    // liên tiếp bằng fireEvent — KHÔNG dùng userEvent, vì userEvent tự await
    // và nhường lượt (yield) giữa các thao tác, để lần upload đầu kịp vượt
    // qua cửa sổ đua trước khi lần hai bắt đầu, xoá sạch tình huống cần kiểm.
    fireEvent.change(input, { target: { files: [pdfFile("cv-1.pdf")] } });
    fireEvent.change(input, { target: { files: [pdfFile("cv-2.pdf")] } });

    // Cả hai handleCvUpload() đều cần đọc xong file qua FileReader (async
    // thật, không chỉ là microtask) rồi cùng thử gọi ensureAccount() TRƯỚC
    // KHI ta resolve signup() — nếu không đợi đủ, bug (gọi signup 2 lần)
    // không có cơ hội bộc lộ. KHÔNG dùng text "đang phân tích cv" để đồng bộ
    // ở đây: khi bug tái xuất hiện, lần gọi ensureAccount() thứ hai KHÔNG hề
    // bị treo (nó rơi vào mock signup() mặc định resolve ngay), nên chạy
    // thẳng tới "done"/điều hướng trước khi ta kịp resolve — cái text
    // transient đó không đáng tin để chờ trong cả hai nhánh đúng/sai.
    await waitFor(() => expect(signup).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    resolveSignup!({ access_token: "tok-race" });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(signup).toHaveBeenCalledTimes(1);
  });

  it("nút 'Bỏ qua' bị khoá trong lúc CV đang được phân tích (cvStep === \"analyzing\")", async () => {
    const user = userEvent.setup();

    let resolveSignup: (value: { access_token: string }) => void;
    const pendingSignup = new Promise<{ access_token: string }>((resolve) => {
      resolveSignup = resolve;
    });
    signup.mockReturnValueOnce(pendingSignup);
    uploadCv.mockResolvedValue({});

    render(<SignUpPage />);
    await gotoStep2(user);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pdfFile());

    // Đợi đúng lúc ensureAccount() đã gọi signup() và đang chờ mạng —
    // cvStep lúc này phải là "analyzing" (UI hiện "Đang phân tích CV...").
    await waitFor(() => expect(signup).toHaveBeenCalledTimes(1));
    await screen.findByText(/đang phân tích cv/i);

    // Cờ isBusy (loading || cvStep === "analyzing") phải khoá nút này lại.
    const skipButton = screen.getByRole("button", { name: /bỏ qua/i });
    expect(skipButton).toBeDisabled();

    resolveSignup!({ access_token: "tok-1" });
    await waitFor(() => expect(uploadCv).toHaveBeenCalledTimes(1));
  });
});
