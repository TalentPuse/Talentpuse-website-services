"use client";

import { motion } from "framer-motion";

type Props = {
  headline: string;
  subtext: string;
};

export default function AuthBrandPanel({ headline, subtext }: Props) {
  return (
    <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-linear-to-br from-brand-700 via-brand-800 to-brand-900 p-12 flex-col justify-between">
      {/* Animated blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-brand-500/20 blur-3xl -top-40 -left-40 animate-blob-1" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-brand-400/15 blur-3xl bottom-20 right-0 animate-blob-2" />
        <div className="absolute w-[350px] h-[350px] rounded-full bg-emerald-500/10 blur-3xl top-1/2 left-1/3 animate-blob-3" />
      </div>

      <div className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl font-bold text-white mb-2">
            <span className="bg-linear-to-r from-white to-brand-200 bg-clip-text text-transparent">
              TalentPuse
            </span>
          </h1>
          <div className="w-12 h-1 bg-linear-to-r from-emerald-400 to-brand-400 rounded-full mb-8" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-2xl font-semibold text-white/95 leading-relaxed mb-4"
        >
          {headline}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-brand-200/80 leading-relaxed max-w-md"
        >
          {subtext}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="relative z-10 space-y-4"
      >
        {[
          { num: "10+", text: "Nguồn tuyển dụng" },
          { num: "1,000+", text: "Việc làm IT/AI" },
          { num: "4+", text: "Kênh alert: Telegram, Zalo, Discord" },
        ].map((item) => (
          <div
            key={item.text}
            className="flex items-center gap-3 bg-white/10 backdrop-blur-xs rounded-lg px-4 py-3 border border-white/10"
          >
            <span className="text-xl font-bold text-emerald-400 min-w-[60px]">
              {item.num}
            </span>
            <span className="text-white/80 text-sm">{item.text}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
