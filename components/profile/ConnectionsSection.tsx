"use client";

import ConnectionCard from "@/components/ConnectionCard";
import { Bell, ICON } from "@/lib/icons";

/* ── Channel icons (colocated: 1:1 with the cards rendered below) ── */

const TG_ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const ZALO_ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
    <path d="M12.49 10.272c-.082 0-.16.016-.236.042a2.922 2.922 0 0 1-.872.128 2.922 2.922 0 0 1-.872-.128.803.803 0 0 0-.236-.042.8.8 0 0 0-.8.8c0 .344.224.64.536.752a4.52 4.52 0 0 0 1.372.208 4.52 4.52 0 0 0 1.372-.208.8.8 0 0 0 .536-.752.8.8 0 0 0-.8-.8zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.6 14.4c0 2.208-2.512 4-5.6 4s-5.6-1.792-5.6-4v-.2c0-2.208 2.512-4 5.6-4s5.6 1.792 5.6 4v.2z" />
  </svg>
);

const DISCORD_ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
  </svg>
);

type ConnectionsSectionProps = {
  token?: string;
};

/**
 * ConnectionsSection — the "channels" grid (Telegram live, Zalo/Discord
 * coming-soon). Doubles as two sub-nav anchors: `#alerts` on the section
 * itself and `#telegram` on the wrapping div around the live Telegram card,
 * since `ConnectionCard` (shared, not ours to edit) has no id/className prop.
 */
export default function ConnectionsSection({ token }: ConnectionsSectionProps) {
  return (
    <section id="alerts" className="scroll-mt-6">
      <header className="flex items-center gap-2">
        <Bell {...ICON} className="text-text-muted" />
        <div>
          <h2 className="font-display text-lg font-bold text-text">Kênh nhận thông báo</h2>
          <p className="mt-0.5 text-sm text-text-muted">Quản lý các kênh nhận alert việc làm mới</p>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div id="telegram" className="scroll-mt-6">
          <ConnectionCard
            icon={TG_ICON}
            name="Telegram"
            description="Nhận alert qua Telegram"
            color="sky"
            bgColor="sky"
            token={token}
          />
        </div>
        <ConnectionCard
          icon={ZALO_ICON}
          name="Zalo"
          description="Nhận alert qua Zalo OA"
          color="blue"
          bgColor="blue"
          comingSoon
        />
        <ConnectionCard
          icon={DISCORD_ICON}
          name="Discord"
          description="Nhận alert qua Discord Bot"
          color="indigo"
          bgColor="indigo"
          comingSoon
        />
      </div>
    </section>
  );
}
