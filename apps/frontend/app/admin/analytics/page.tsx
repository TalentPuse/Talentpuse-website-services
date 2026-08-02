"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApi, AnalyticsOverview } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import MetricBlock from "@/components/admin/MetricBlock";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * Hien mot con so, hoac dau gach khi khong biet.
 *
 * KHONG duoc thay bang `value ?? 0`: khoi nay chi render khi status === "ok",
 * nhung neu backend doi shape thi `?? 0` se im lang bia ra so 0 va nguoi doc
 * tuong la do that. Dau "—" noi ro "khong co du lieu".
 */
function Num({ value }: { value: number | undefined }) {
  return (
    <span className="text-2xl font-semibold text-slate-900">
      {value === undefined ? "—" : value.toLocaleString("vi-VN")}
    </span>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export default function AnalyticsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      setData(await adminApi.analyticsOverview(token));
    } catch (err) {
      // Khong bao gio roi xuong trang thai rong: "0 khach" va "API chet" phai
      // trong khac nhau voi nguoi doc trang nay.
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <AdminLayout>
        <p className="text-sm text-slate-500">Đang tải...</p>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-3 text-sm text-amber-800">{error ?? "Không có dữ liệu"}</p>
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Thử lại
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Phân tích</h1>
        <p className="mt-1 text-sm text-slate-500">
          Traffic, giữ chân và chiều sâu sử dụng — mỗi khối ghi rõ nguồn dữ liệu.
          Các KPI vận hành (jobs, chat, alert đã gửi) nằm ở{" "}
          <a href="/admin" className="text-brand-600 underline">
            Tổng quan
          </a>
          .
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <MetricBlock
          title="Traffic (30 ngày)"
          source={data.traffic.source}
          status={data.traffic.status}
          error={data.traffic.error}
        >
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Khách duy nhất">
              <Num value={data.traffic.data?.visitors} />
            </Stat>
            <Stat label="Lượt xem trang">
              <Num value={data.traffic.data?.pageviews} />
            </Stat>
            <Stat label="Phiên">
              <Num value={data.traffic.data?.visits} />
            </Stat>
            <Stat label="Bounce">
              <span className="text-2xl font-semibold text-slate-900">
                {data.traffic.data ? pct(data.traffic.data.bounce_rate) : "—"}
              </span>
            </Stat>
          </dl>
        </MetricBlock>

        <MetricBlock
          title="Nguồn traffic"
          source={data.sources.source}
          status={data.sources.status}
          error={data.sources.error}
        >
          {data.sources.data?.length ? (
            <ul className="space-y-1.5 text-sm">
              {data.sources.data.map((s) => (
                <li key={s.name} className="flex justify-between gap-3">
                  <span className="truncate text-slate-600">{s.name}</span>
                  <span className="shrink-0 font-medium text-slate-900">
                    {s.visitors.toLocaleString("vi-VN")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Chưa có lượt truy cập nào được ghi nhận.</p>
          )}
        </MetricBlock>

        <MetricBlock
          title="Hoạt động"
          source={data.activity.source}
          status={data.activity.status}
          error={data.activity.error}
        >
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="DAU">
              <Num value={data.activity.data?.dau} />
            </Stat>
            <Stat label="WAU">
              <Num value={data.activity.data?.wau} />
            </Stat>
            <Stat label="MAU">
              <Num value={data.activity.data?.mau} />
            </Stat>
            <Stat label="Stickiness">
              <span className="text-2xl font-semibold text-slate-900">
                {data.activity.data ? pct(data.activity.data.stickiness) : "—"}
              </span>
            </Stat>
          </dl>
        </MetricBlock>

        <MetricBlock
          title="Funnel kích hoạt"
          source={data.funnel.source}
          status={data.funnel.status}
          error={data.funnel.error}
        >
          <ol className="space-y-2 text-sm">
            {[
              ["Đăng ký", data.funnel.data?.signed_up],
              ["Hoàn thiện hồ sơ", data.funnel.data?.profile_completed],
              ["Bật kênh alert", data.funnel.data?.channel_enabled],
              ["Đã nhận alert", data.funnel.data?.alerted],
            ].map(([label, value]) => (
              <li key={label as string} className="flex justify-between gap-3">
                <span className="text-slate-600">{label}</span>
                <span className="font-medium text-slate-900">
                  {value === undefined ? "—" : (value as number).toLocaleString("vi-VN")}
                </span>
              </li>
            ))}
          </ol>
        </MetricBlock>

        <MetricBlock
          title="Cohort retention"
          source={data.cohorts.source}
          status={data.cohorts.status}
          error={data.cohorts.error}
        >
          {data.cohorts.data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="pb-2 font-medium">Tuần</th>
                    <th className="pb-2 text-right font-medium">Size</th>
                    <th className="pb-2 text-right font-medium">D1</th>
                    <th className="pb-2 text-right font-medium">D7</th>
                    <th className="pb-2 text-right font-medium">D30</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.cohorts.data.map((c) => (
                    <tr key={c.cohort_week}>
                      <td className="py-1.5 text-slate-700">{c.cohort_week}</td>
                      <td className="py-1.5 text-right text-slate-700">{c.size}</td>
                      <td className="py-1.5 text-right text-slate-700">{pct(c.d1)}</td>
                      <td className="py-1.5 text-right text-slate-700">{pct(c.d7)}</td>
                      <td className="py-1.5 text-right text-slate-700">{pct(c.d30)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Chưa đủ dữ liệu để dựng cohort.</p>
          )}
        </MetricBlock>
      </div>
    </AdminLayout>
  );
}
