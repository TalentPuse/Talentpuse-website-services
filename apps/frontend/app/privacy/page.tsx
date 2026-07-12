import Link from "next/link";

import { ForceTheme } from "@/components/theme/ForceTheme";

export const metadata = {
  title: "Chính sách bảo mật — TalentPuse",
};

const SECTIONS = [
  {
    h: "1. Dữ liệu chúng tôi thu thập",
    p: "TalentPuse thu thập thông tin bạn chủ động cung cấp (email, hồ sơ, CV bạn tải lên) và dữ liệu tuyển dụng công khai từ các nguồn như VietnamWorks, ITviec, LinkedIn để phục vụ phân tích thị trường.",
  },
  {
    h: "2. Mục đích sử dụng",
    p: "Dữ liệu của bạn được dùng để gợi ý việc làm phù hợp, gửi cảnh báo qua Telegram/Email theo lựa chọn của bạn, và cá nhân hóa tư vấn sự nghiệp bằng AI. Chúng tôi không bán dữ liệu cá nhân cho bên thứ ba.",
  },
  {
    h: "3. CV và hồ sơ",
    p: "CV chỉ được xử lý khi bạn chủ động tải lên để nhận tư vấn. Nội dung CV dùng riêng cho tài khoản của bạn và không chia sẻ ra ngoài.",
  },
  {
    h: "4. Thông báo & hủy đăng ký",
    p: "Bạn có thể bật/tắt cảnh báo và thay đổi tần suất bất cứ lúc nào trong trang Hồ sơ. Việc hủy có hiệu lực ngay lập tức.",
  },
  {
    h: "5. Bảo mật & lưu trữ",
    p: "Chúng tôi áp dụng các biện pháp kỹ thuật hợp lý để bảo vệ dữ liệu. Bạn có thể yêu cầu xóa tài khoản và dữ liệu liên quan qua email hỗ trợ.",
  },
  {
    h: "6. Liên hệ",
    p: "Mọi thắc mắc về quyền riêng tư, vui lòng liên hệ baonm@talentpuse.io.vn.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-bg px-6 py-16 text-text">
      <ForceTheme theme="light" />
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← TalentPuse
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">Chính sách bảo mật</h1>
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
