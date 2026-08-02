/**
 * Feature flag cho bề mặt trợ lý AI-native (CopilotKit + AG-UI).
 *
 * On ⇒ /assistant (và trang chủ, Phase 0) chạy CopilotChatSurface. Off ⇒
 * /assistant chạy đường SSE tự viết như trước. Đây là kill-switch tổng:
 * CopilotKit hỏng thì gạt biến env về khác "1" là app sống lại nguyên trạng.
 *
 * Next.js inline `process.env.NEXT_PUBLIC_*` lúc build, nên phải viết nguyên
 * biểu thức `process.env.NEXT_PUBLIC_AI_HOME` — KHÔNG destructure `process.env`.
 */
export const AI_HOME = process.env.NEXT_PUBLIC_AI_HOME === "1";

