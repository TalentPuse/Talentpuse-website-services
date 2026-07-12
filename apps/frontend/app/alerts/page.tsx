"use client";

import { useCallback, useEffect, useState } from "react";

import { jobsApi, applicationsApi, MyAlertList } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ForceTheme } from "@/components/theme/ForceTheme";
import AlertTimeline from "@/components/alerts/AlertTimeline";
import { Button } from "@/components/ui/button";

const PER_PAGE = 20;

export default function AlertHistoryPage() {
  const { token } = useAuth();
  const [data, setData] = useState<MyAlertList | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [trackedKeys, setTrackedKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await jobsApi.myAlerts(token, { page, per_page: PER_PAGE });
      setData(res);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    applicationsApi
      .keys(token)
      .then((keys) => setTrackedKeys(new Set(keys.map((k) => `${k.source}:${k.source_job_id}`))))
      .catch(() => {});
  }, [token]);

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  return (
    <DashboardLayout>
      <ForceTheme theme="light" />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-text">Lịch sử Alert</h1>
          <p className="mt-1 text-sm text-text-muted">
            {data ? `${data.total} alert đã nhận` : "Đang tải..."}
          </p>
        </header>

        <AlertTimeline alerts={data?.alerts ?? []} isLoading={isLoading} trackedKeys={trackedKeys} />

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
            <span className="font-mono text-xs text-text-muted">
              Trang {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
