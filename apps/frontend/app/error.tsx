"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary cấp route.
 *
 * Trước đây toàn bộ `app/` KHÔNG có file này, nên bất kỳ lỗi render nào cũng
 * đẩy người dùng ra màn hình mặc định của Next: "Application error: a
 * client-side exception has occurred" — trắng trơn, mất sạch form đang điền,
 * không có đường quay lại ngoài F5 thủ công.
 *
 * Nó khuếch đại một lỗi nhỏ thành ngõ cụt: gõ email thừa dấu chấm cuối
 * ("a@gmail.com.") làm `ApiError.message` nhận cả mảng lỗi 422 của FastAPI,
 * JSX render mảng đó và React ném "Objects are not valid as a React child" →
 * sập cả trang đăng nhập. Nguyên nhân gốc đã sửa ở `lib/api.ts` (hàm
 * `errorMessage`), file này là lớp chắn thứ hai cho những lỗi render chưa lường
 * trước: giữ lại vỏ ứng dụng và cho người dùng một nút thử lại.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error.tsx]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <AlertTriangle className="h-12 w-12 text-red-400" strokeWidth={1.5} />
      <h1 className="text-xl font-semibold text-text">Có lỗi xảy ra</h1>
      <p className="max-w-md text-sm text-text-muted">
        Giao diện gặp sự cố khi hiển thị. Dữ liệu của bạn vẫn an toàn — thử tải
        lại phần này, hoặc quay về trang chủ.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Thử lại</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Về trang chủ
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs text-text-muted/70">Mã lỗi: {error.digest}</p>
      )}
    </div>
  );
}
