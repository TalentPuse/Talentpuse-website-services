import { render, screen, waitFor } from "@testing-library/react";
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
  });
});
