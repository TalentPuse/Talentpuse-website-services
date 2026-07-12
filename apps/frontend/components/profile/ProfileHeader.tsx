"use client";

import { motion } from "framer-motion";

import Monogram from "@/components/brand/Monogram";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, ICON } from "@/lib/icons";
import type { UserResponse } from "@/lib/api";

type ProfileHeaderProps = {
  user: UserResponse | null;
  editing: boolean;
  onEdit: () => void;
};

/**
 * ProfileHeader — the settings page banner: avatar, name/email, member-since
 * + subscription tier, and the entry point into edit mode. Section panels
 * and the sub-nav live below it in the page component.
 */
export default function ProfileHeader({ user, editing, onEdit }: ProfileHeaderProps) {
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("vi-VN", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-[var(--radius-lg)] bg-linear-to-br from-brand-600 via-brand-700 to-brand-800 p-8 text-white shadow-lg"
    >
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />

      <div className="relative flex flex-wrap items-center gap-6">
        <Monogram
          name={user?.full_name || "?"}
          size="lg"
          className="h-20 w-20 text-2xl ring-4 ring-white/20"
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold">{user?.full_name || "..."}</h1>
          <p className="mt-0.5 text-sm text-brand-200">{user?.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {memberSince && (
              <span className="text-xs text-brand-300">Thành viên từ {memberSince}</span>
            )}
            <Badge className="border-white/20 bg-white/15 capitalize text-white">
              {user?.subscription_tier || "Free"}
            </Badge>
          </div>
        </div>
        {!editing && (
          <Button
            onClick={onEdit}
            className="shrink-0 border border-white/20 bg-white/15 text-white shadow-xs backdrop-blur-xs hover:bg-white/25"
          >
            <Settings {...ICON} />
            Chỉnh sửa hồ sơ
          </Button>
        )}
      </div>
    </motion.div>
  );
}
