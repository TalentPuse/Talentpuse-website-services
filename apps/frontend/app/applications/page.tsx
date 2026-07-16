"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck } from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ForceTheme } from "@/components/theme/ForceTheme";
import { Skeleton } from "@/components/ui/skeleton";
import ApplicationBoard from "@/components/applications/ApplicationBoard";
import AddApplicationDialog from "@/components/applications/AddApplicationDialog";
import { applicationsApi, type Application, type ApplicationStats, type ApplicationStatus } from "@/lib/api";

export default function ApplicationsPage() {
  return (<DashboardLayout><ForceTheme theme="light" /><Content /></DashboardLayout>);
}

function Content() {
  const { token } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, s] = await Promise.all([applicationsApi.list(token), applicationsApi.stats(token)]);
      setApps(list.applications); setStats(s);
    } catch { toast.error("Không tải được danh sách"); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  /** Dropping a card on a column lands here. Optimistic, rolled back on failure. */
  async function changeStatus(id: string, status: ApplicationStatus) {
    if (!token) return;
    const prev = apps;
    setApps((xs) => xs.map((a) => (a.id === id ? { ...a, status } : a)));
    try { await applicationsApi.update(token, id, { status }); load(); }
    catch { setApps(prev); toast.error("Không đổi được trạng thái"); }
  }

  async function remove(id: string) {
    if (!token) return;
    const prev = apps;
    setApps((xs) => xs.filter((a) => a.id !== id));
    try { await applicationsApi.remove(token, id); load(); }
    catch { setApps(prev); toast.error("Không xoá được"); }
  }

  return (
    // Wide cap: 5 × 288px tracks + gaps need ~1500px. max-w-7xl (1280px) forced a
    // horizontal scrollbar even on a 1920px screen that had room to spare.
    // h-full + flex-col lets the board claim the leftover height (AppShell's
    // <main> is flex-1 in an h-screen column), so columns scroll internally the
    // way a board should instead of leaving a void under a stubby row of cards.
    <div className="mx-auto flex h-full max-w-[1600px] flex-col p-6">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Ứng tuyển</h1>
          {stats && <p className="text-sm text-text-muted">Đã apply {stats.by_status.applied} · Phỏng vấn {stats.by_status.interviewing} · Offer {stats.by_status.offer}</p>}
        </div>
        <AddApplicationDialog onCreated={() => load()} />
      </div>

      {loading ? (
        <div className="flex min-h-0 flex-1 gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="w-72 shrink-0 rounded-2xl 2xl:w-auto 2xl:flex-1" />)}</div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center">
          <ClipboardCheck className="h-10 w-10 text-text-muted/50" strokeWidth={1.5} />
          <p className="text-text-muted">Chưa có job nào. Bấm <b>&quot;Lưu&quot;</b> hoặc <b>&quot;Đã apply&quot;</b> ở trang Việc làm/Alerts, hoặc <b>Thêm job đã apply</b>.</p>
        </div>
      ) : (
        <>
          <p className="mb-2 shrink-0 text-xs text-text-muted">Kéo card sang cột khác để đổi trạng thái.</p>
          <div className="min-h-0 flex-1">
            <ApplicationBoard apps={apps} onStatusChange={changeStatus} onDelete={remove} />
          </div>
        </>
      )}
    </div>
  );
}
