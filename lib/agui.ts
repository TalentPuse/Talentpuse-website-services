/**
 * AG-UI helpers cho runtime route.
 * Route handler chạy server-side trong container FE → ưu tiên API_BASE_INTERNAL
 * (cùng pattern lib/api.ts).
 */
type EnvLike = Partial<
  Record<"API_BASE_INTERNAL" | "NEXT_PUBLIC_API_BASE", string>
>;

export function resolveAgentBaseUrl(env: EnvLike): string {
  const base = (
    env.API_BASE_INTERNAL ||
    env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:8001"
  ).replace(/\/+$/, "");
  return `${base}/api/agent`;
}
