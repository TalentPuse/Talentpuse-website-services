import { toast } from "sonner";

/**
 * Toast kèm nút Hoàn tác 8 giây. Đây là thứ THAY CHO bước hỏi-xác-nhận:
 * mọi thao tác ghi của AI chạy ngay, nhưng luôn có đường lùi trong tầm tay.
 * Hỏi trước mỗi lần sẽ giết cảm giác điều khiển bằng lời — nói xong vẫn phải
 * bấm thì chẳng nhanh hơn tự kéo.
 */
export function toastWithUndo(message: string, undo: () => Promise<void> | void): void {
  toast.success(message, {
    duration: 8000,
    action: {
      label: "Hoàn tác",
      onClick: () => {
        void (async () => {
          try {
            await undo();
            toast.success("Đã hoàn tác");
          } catch {
            toast.error("Không hoàn tác được");
          }
        })();
      },
    },
  });
}
