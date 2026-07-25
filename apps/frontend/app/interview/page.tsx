"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Tính năng luyện phỏng vấn đang được ẨN.
 *
 * Lối vào đã gỡ khỏi sidebar, ⌘K, dashboard sidebar và footer; trang này chặn
 * nốt đường vào thẳng bằng URL. `components/interview/*` vẫn còn nguyên trên
 * đĩa, và nội dung cũ của chính file này nằm trong lịch sử git — muốn bật lại
 * thì khôi phục từ đó, không phải viết lại.
 */
export default function InterviewPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/assistant");
  }, [router]);
  return null;
}
