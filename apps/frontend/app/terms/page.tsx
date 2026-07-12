import Link from "next/link";

import { ForceTheme } from "@/components/theme/ForceTheme";

export const metadata = {
  title: "Điều khoản sử dụng — TalentPuse",
};

const SECTIONS = [
  {
    h: "1. Chấp nhận điều khoản",
    p: "Khi sử dụng TalentPuse, bạn đồng ý với các điều khoản dưới đây. Nếu không đồng ý, vui lòng ngừng sử dụng dịch vụ.",
  },
  {
    h: "2. Về dịch vụ",
    p: "TalentPuse cung cấp phân tích thị trường tuyển dụng IT/AI, cảnh báo việc làm và tư vấn sự nghiệp bằng AI. Các số liệu và gợi ý mang tính tham khảo, không phải cam kết về kết quả tuyển dụng hay mức lương.",
  },
  {
    h: "3. Tài khoản của bạn",
    p: "Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động diễn ra dưới tài khoản của mình. Vui lòng cung cấp thông tin chính xác khi đăng ký.",
  },
  {
    h: "4. Sử dụng hợp lệ",
    p: "Không sử dụng dịch vụ để thu thập dữ liệu trái phép, gửi spam, hoặc gây ảnh hưởng đến hệ thống. Chúng tôi có quyền tạm khóa tài khoản vi phạm.",
  },
  {
    h: "5. Dữ liệu tuyển dụng",
    p: "Dữ liệu việc làm được tổng hợp từ các nguồn công khai và thuộc về đơn vị đăng tin gốc. TalentPuse chỉ tổng hợp, chuẩn hóa và phân tích phục vụ người dùng.",
  },
  {
    h: "6. Thay đổi điều khoản",
    p: "Điều khoản có thể được cập nhật theo thời gian. Việc tiếp tục sử dụng sau khi cập nhật đồng nghĩa bạn chấp nhận nội dung mới. Liên hệ: baonm@talentpuse.io.vn.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-bg px-6 py-16 text-text">
      <ForceTheme theme="light" />
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← TalentPuse
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">Điều khoản sử dụng</h1>
        <p className="mt-2 text-sm text-text-muted">Cập nhật: 10/07/2026</p>

        <div className="mt-8 space-y-7">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-lg font-semibold">{s.h}</h2>
              <p className="mt-2 leading-relaxed text-text-muted">{s.p}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
