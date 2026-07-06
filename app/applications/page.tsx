"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck } from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ForceTheme } from "@/components/theme/ForceTheme";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import ApplicationCard from "@/components/applications/ApplicationCard";
import AddApplicationDialog from "@/components/applications/AddApplicationDialog";
import AiInsightCard from "@/components/applications/AiInsightCard";
import { STATUS_LABEL, STATUS_ORDER } from "@/components/applications/StatusSelect";
import { applicationsApi, type Application, type ApplicationStats, type ApplicationStatus } from "@/lib/api";

export default function ApplicationsPage() {
  return (<DashboardLayout><ForceTheme theme="light" /><Content /></DashboardLayout>);
}

function Content() {
  const { token } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");
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

  const shown = useMemo(() => (filter === "all" ? apps : apps.filter((a) => a.status === filter)), [apps, filter]);

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
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Ứng tuyển</h1>
          {stats && <p className="text-sm text-text-muted">Đã apply {stats.by_status.applied} · Phỏng vấn {stats.by_status.interviewing} · Offer {stats.by_status.offer}</p>}
        </div>
        <AddApplicationDialog onCreated={() => load()} />
      </div>

      <div className="mb-4"><AiInsightCard /></div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...STATUS_ORDER] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("rounded-full border px-3 py-1 text-sm transition",
              filter === f ? "border-brand-500 bg-brand-50 text-brand-700" : "border-border text-text-muted hover:bg-surface-2")}>
            {f === "all" ? "Tất cả" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center">
          <ClipboardCheck className="h-10 w-10 text-text-muted/50" strokeWidth={1.5} />
          <p className="text-text-muted">Chưa có job nào. Bấm <b>&quot;Đã apply&quot;</b> ở trang Việc làm/Alerts, hoặc <b>Thêm job đã apply</b>.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((a) => <ApplicationCard key={a.id} app={a} onStatusChange={changeStatus} onDelete={remove} />)}
        </div>
      )}
    </div>
  );
}
