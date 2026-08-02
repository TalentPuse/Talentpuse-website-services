"use client";

import { useEffect } from "react";

type Props = {
  /**
   * CHI duoc truyen UUID. Khong bao gio truyen email, ho ten hay bat ky truong
   * ho so nao khac.
   *
   * `UserResponse` co ca `email` lan `full_name` ngay ben canh `id`, nen viec
   * lay nham truong o cho goi la rat de. Prop nay co chu dich chi nhan mot
   * chuoi thay vi ca doi tuong user: neu nhan ca object thi ngay khi ai do
   * them mot truong vao ho so, truong do se am tham chay sang ben thu ba.
   */
  userId: string | null;
};

/**
 * Gan mot dinh danh gia danh vao phien Umami cua nguoi dung da dang nhap.
 *
 * Khong render gi ca — chi la mot cho de chay hieu ung.
 */
export default function UmamiIdentify({ userId }: Props) {
  useEffect(() => {
    // Khach vang lai (chua dang nhap) van duoc dem pageview binh thuong, chi la
    // khong gan danh tinh. Goi identify voi null se tao ra mot danh tinh rong.
    if (!userId) return;

    // Optional chaining o ca hai muc la co chu dich: `/s/script.js` co the
    // khong nap duoc (trinh chan quang cao, Umami chet, mang loi). Luc do
    // `window.umami` khong ton tai, va mot loi nem ra o day se lam vo ca cay
    // React ben duoi — do luu luong hong khong duoc phep lam sap trang web.
    const umami = (window as unknown as { umami?: { identify?: (data: unknown) => void } })
      .umami;
    umami?.identify?.({ userId });
  }, [userId]);

  return null;
}
