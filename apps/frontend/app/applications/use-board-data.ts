"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { applicationsApi, type Application, type ApplicationStats, type ApplicationStatus } from "@/lib/api";

/**
 * Sở hữu toàn bộ dữ liệu + mutation của board.
 *
 * State phải nằm ở page chứ không trong `Content` vì `CopilotDockProvider`
 * nhận `insight` như một prop NGOÀI `children` — `DockInsight` không thể đọc
 * state nằm bên trong `Content`. Hoisting là cách duy nhất để board và dock
 * cùng nhìn một nguồn dữ liệu.
 */
export type BoardData = {
  apps: Application[];
  stats: ApplicationStats | null;
  loading: boolean;
  token: string | null;
  reload: () => Promise<void>;
  changeStatus: (id: string, status: ApplicationStatus) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export function useBoardData(): BoardData {
  const { token } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, s] = await Promise.all([applicationsApi.list(token), applicationsApi.stats(token)]);
      setApps(list.applications);
      setStats(s);
    } catch {
      toast.error("Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Thả card sang cột khác vào đây. Optimistic, rollback khi lỗi. */
  const changeStatus = useCallback(
    async (id: string, status: ApplicationStatus) => {
      if (!token) return;
      const prev = apps;
      setApps((xs) => xs.map((a) => (a.id === id ? { ...a, status } : a)));
      try {
        await applicationsApi.update(token, id, { status });
        await reload();
      } catch {
        setApps(prev);
        toast.error("Không đổi được trạng thái");
        // Ném tiếp để handler của copilot biết mà báo lại cho AI thay vì
        // im lặng khẳng định đã chuyển xong.
        throw new Error("update_failed");
      }
    },
    [token, apps, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!token) return;
      const prev = apps;
      setApps((xs) => xs.filter((a) => a.id !== id));
      try {
        await applicationsApi.remove(token, id);
        await reload();
      } catch {
        setApps(prev);
        toast.error("Không xoá được");
      }
    },
    [token, apps, reload],
  );

  return { apps, stats, loading, token, reload, changeStatus, remove };
}
