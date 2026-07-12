"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { ForceTheme } from "@/components/theme/ForceTheme";
import AssistantShell from "@/components/chat/AssistantShell";

/** A specific chat room, addressable at /assistant/<roomId> — deep-linkable,
 *  shareable, and survives a reload. Ownership is enforced server-side: the
 *  backend 404s any room that isn't the caller's (api/chat.py get_messages). */
export default function AssistantRoomPage({ params }: { params: { roomId: string } }) {
  return (
    <ProtectedRoute>
      <ForceTheme theme="light" />
      <AssistantShell roomId={params.roomId} />
    </ProtectedRoute>
  );
}
