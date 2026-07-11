/** Feature flags (build-time). AI_HOME: trang chủ = chat AI-native (Phase 0). */
export const AI_HOME = process.env.NEXT_PUBLIC_AI_HOME === "1";

/**
 * Feature flag cho bề mặt trợ lý AI mới (CopilotKit + AG-UI).
 *
 * Off ⇒ /assistant chạy đường SSE tự viết như trước. Đây là kill-switch tổng:
 * CopilotKit hỏng thì gạt về 0 là app sống lại nguyên trạng.
 *
 * Next.js inline `process.env.NEXT_PUBLIC_*` lúc build, nên phải viết nguyên
 * biểu thức `process.env.NEXT_PUBLIC_AI_HOME` — KHÔNG destructure `process.env`.
 */
export const AI_HOME_ENABLED = process.env.NEXT_PUBLIC_AI_HOME === "1";
