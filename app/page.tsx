"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import GradientBackground from "@/components/landing/GradientBackground";
import FloatingDashboard from "@/components/landing/FloatingDashboard";
import AnimatedCounter from "@/components/landing/AnimatedCounter";
import ScrollReveal from "@/components/landing/ScrollReveal";
import LiveDataPreview from "@/components/landing/LiveDataPreview";


export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
            TalentPulse
          </span>
          <div className="flex items-center gap-6">
            <a
              href="#features"
              className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Tính năng
            </a>
            <a
              href="#live-data"
              className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Dữ liệu
            </a>
            <Link
              href="/signin"
              className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Đăng nhập
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-5 py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-brand-600/25"
            >
              Đăng ký miễn phí
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-start pt-16 sm:pt-20 pb-8">
        <GradientBackground />

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 bg-brand-50 border border-brand-200 text-brand-700 text-xs font-medium rounded-full"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
          </span>
          AI Job Alert. Không bỏ lỡ cơ hội việc làm
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-center leading-tight max-w-4xl mx-auto px-6"
        >
          <span className="text-slate-900">Nắm bắt thị trường tuyển dụng </span>
          <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 bg-clip-text text-transparent">
            Việt Nam
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto text-center leading-relaxed px-6"
        >
          Phân tích dữ liệu từ hơn 10 nguồn tuyển dụng, tự động match job phù hợp với bạn
          và gửi alert tức thì qua Telegram, Zalo, Discord.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 px-6"
        >
          <Link
            href="/signup"
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition-all hover:shadow-xl hover:shadow-emerald-600/40 hover:-translate-y-0.5 glow-brand text-center"
          >
            Đăng ký Alert miễn phí &rarr;
          </Link>
          <Link
            href="/signin"
            className="w-full sm:w-auto px-8 py-3.5 bg-white/80 hover:bg-white text-slate-700 font-semibold rounded-xl border border-slate-300 transition-all hover:shadow-md text-center"
          >
            Đăng nhập
          </Link>
        </motion.div>

        {/* Floating dashboard mockup */}
        <div className="mt-16 w-full px-4 sm:px-6">
          <FloatingDashboard />
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative border-y border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          <ScrollReveal delay={0}>
            <div className="text-4xl font-bold text-brand-600">
              <AnimatedCounter target={10} suffix="+" />
            </div>
            <div className="mt-2 text-sm text-slate-600">Nguồn dữ liệu</div>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="text-4xl font-bold text-brand-600">
              <AnimatedCounter target={1000} suffix="+" />
            </div>
            <div className="mt-2 text-sm text-slate-600">Jobs được theo dõi</div>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <div className="text-4xl font-bold text-brand-600">24/7</div>
            <div className="mt-2 text-sm text-slate-600">Cập nhật realtime</div>
          </ScrollReveal>
          <ScrollReveal delay={0.3}>
            <div className="text-4xl font-bold text-brand-600">
              <AnimatedCounter target={4} suffix="+" />
            </div>
            <div className="mt-2 text-sm text-slate-600">Kênh alert</div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Live Data Preview ── */}
      <section id="live-data" className="max-w-6xl mx-auto px-6 py-20">
        <ScrollReveal>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-700">Dữ liệu thật</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900">
              Dữ liệu thật, cập nhật liên tục
            </h2>
            <p className="mt-3 text-slate-600 max-w-xl mx-auto">
              Không phải demo giả — đây là dữ liệu thật đang được thu thập và phân tích mỗi ngày
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <LiveDataPreview />
        </ScrollReveal>
      </section>

      {/* ── AI Job Alert Showcase ── */}
      <section id="ai-alert" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900" />
        <div className="absolute inset-0">
          <div className="absolute -top-20 -left-20 w-[400px] h-[400px] rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-[300px] h-[300px] rounded-full bg-emerald-400/10 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left — text */}
            <ScrollReveal direction="left">
              <div>
                <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  <span className="text-xs font-semibold text-emerald-100">Tính năng nổi bật</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                  AI tự động tìm job<br />phù hợp với bạn
                </h2>
                <p className="mt-4 text-emerald-100 text-lg leading-relaxed max-w-md">
                  Thay vì lướt hàng trăm tin tuyển dụng mỗi ngày, để AI Agent làm việc đó.
                  Chỉ nhận thông báo khi có job thật sự match với profile và kỹ năng của bạn.
                </p>
                <ul className="mt-8 space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 w-6 h-6 rounded-full bg-emerald-500/30 text-emerald-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </span>
                    <span className="text-emerald-50">
                      <strong className="text-white">AI phân tích profile</strong>, match job chính xác theo skills, kinh nghiệm và mức lương mong muốn
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 w-6 h-6 rounded-full bg-emerald-500/30 text-emerald-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </span>
                    <span className="text-emerald-50">
                      <strong className="text-white">Alert tức thì</strong>, nhận thông báo qua Telegram, Zalo, Discord hoặc trực tiếp trên website
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 w-6 h-6 rounded-full bg-emerald-500/30 text-emerald-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </span>
                    <span className="text-emerald-50">
                      <strong className="text-white">Không bỏ lỡ</strong>, job hot đến tay bạn đầu tiên, trước cả khi đăng rộng rãi
                    </span>
                  </li>
                </ul>
                <Link
                  href="/signup"
                  className="mt-8 inline-block px-8 py-3.5 bg-white text-emerald-700 font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5 text-base"
                >
                  Đăng ký nhận Alert &rarr;
                </Link>
              </div>
            </ScrollReveal>

            {/* Right — notification mockup cards */}
            <ScrollReveal direction="right" delay={0.2}>
              <div className="relative flex flex-col gap-4 lg:pl-8">
                {/* Notification 1 */}
                <motion.div
                  initial={{ opacity: 0, x: 40, y: 20 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-100"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Phù hợp 95%</span>
                        <span className="text-xs text-slate-400">2 phút trước</span>
                      </div>
                      <h4 className="mt-1.5 font-semibold text-slate-900 text-sm">Senior React Developer</h4>
                      <p className="text-xs text-slate-500 mt-0.5">FPT Software &middot; Hồ Chí Minh</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded">30-45M VND</span>
                        <span className="text-xs text-slate-400">React, TypeScript, AWS</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Notification 2 */}
                <motion.div
                  initial={{ opacity: 0, x: 40, y: 20 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-100 lg:ml-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">Phù hợp 88%</span>
                        <span className="text-xs text-slate-400">15 phút trước</span>
                      </div>
                      <h4 className="mt-1.5 font-semibold text-slate-900 text-sm">AI/ML Engineer</h4>
                      <p className="text-xs text-slate-500 mt-0.5">VNG Corporation &middot; Hồ Chí Minh</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded">40-60M VND</span>
                        <span className="text-xs text-slate-400">Python, PyTorch, LLM</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Notification 3 */}
                <motion.div
                  initial={{ opacity: 0, x: 40, y: 20 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7, duration: 0.6 }}
                  className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-100 lg:ml-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Phù hợp 82%</span>
                        <span className="text-xs text-slate-400">1 giờ trước</span>
                      </div>
                      <h4 className="mt-1.5 font-semibold text-slate-900 text-sm">DevOps Engineer</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Tiki &middot; Hà Nội</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded">25-40M VND</span>
                        <span className="text-xs text-slate-400">Docker, K8s, Terraform</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Channel badges */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                  className="flex items-center gap-3 mt-2 justify-center lg:justify-start"
                >
                  <span className="text-xs text-emerald-200">Gửi qua:</span>
                  {["Telegram", "Zalo", "Discord", "Website"].map((ch) => (
                    <span key={ch} className="px-3 py-1 text-xs font-medium bg-white/10 text-emerald-100 rounded-full border border-emerald-400/20">
                      {ch}
                    </span>
                  ))}
                </motion.div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-slate-900">Hai tính năng cốt lõi</h2>
              <p className="mt-3 text-slate-600 max-w-xl mx-auto">
                Tất cả những gì bạn cần để nắm bắt thị trường tuyển dụng tại Việt Nam
              </p>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ScrollReveal direction="left" delay={0.1}>
              <div className="group relative bg-white rounded-2xl border-2 border-emerald-200 p-8 hover:shadow-xl hover:border-emerald-400 transition-all duration-500 hover:-translate-y-1 ring-1 ring-emerald-100">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/25 group-hover:scale-110 transition-transform duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">AI Job Alert</h3>
                  <p className="text-slate-600 leading-relaxed">
                    AI Agent tự động phân tích và match job phù hợp với profile của bạn.
                    Nhận thông báo nhanh nhất qua Telegram, Zalo, Discord hoặc trực tiếp trên website.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-slate-500">
                    <li className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </span>
                      AI phân tích mức độ phù hợp với profile
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </span>
                      Alert qua Telegram / Zalo / Discord
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </span>
                      Không bỏ lỡ job hot trên thị trường
                    </li>
                  </ul>
                </div>
              </div>
            </ScrollReveal>

            {/* Market Intelligence — second */}
            <ScrollReveal direction="right" delay={0.2}>
              <div className="group relative bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-xl hover:border-brand-300 transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-brand-500/25 group-hover:scale-110 transition-transform duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">Market Intelligence</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Thu thập và phân tích dữ liệu real-time từ hơn 10 trang tuyển dụng lớn tại Việt Nam.
                    Dashboard trực quan giúp bạn theo dõi skills hot, mức lương trung bình, và xu hướng tuyển dụng.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-slate-500">
                    <li className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </span>
                      Phân tích skills đang được săn đón nhất
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </span>
                      So sánh lương theo level và thành phố
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </span>
                      Top công ty đang tuyển nhiều nhất
                    </li>
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <ScrollReveal>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-brand-50 border border-brand-200 rounded-full">
              <span className="text-xs font-medium text-brand-700">Quy trình</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Cách hoạt động</h2>
            <p className="mt-4 text-slate-600 max-w-2xl mx-auto text-lg">
              Hệ thống tự động thu thập, phân tích và gửi thông báo việc làm phù hợp đến bạn chỉ trong 3 bước
            </p>
          </div>
        </ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
          <ScrollReveal delay={0}>
            <div className="relative bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-xl hover:border-brand-300 transition-all duration-500 hover:-translate-y-1 h-full">
              <div className="absolute -top-4 left-8">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold shadow-lg shadow-brand-500/30">1</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center mb-5 mt-2 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Thu thập dữ liệu</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Hệ thống tự động thu thập hàng nghìn tin tuyển dụng từ hơn 10 nguồn uy tín tại Việt Nam. Dữ liệu được cập nhật liên tục mỗi ngày để đảm bảo độ chính xác và kịp thời.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.15}>
            <div className="relative bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-xl hover:border-brand-300 transition-all duration-500 hover:-translate-y-1 h-full">
              <div className="absolute -top-4 left-8">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold shadow-lg shadow-brand-500/30">2</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white flex items-center justify-center mb-5 mt-2 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Phân tích chuyên sâu</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Hệ thống xử lý và tổng hợp dữ liệu thành các báo cáo chi tiết về kỹ năng thị trường cần, mức lương theo vị trí, doanh nghiệp đang tuyển và xu hướng ngành nghề.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.3}>
            <div className="relative bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-xl hover:border-brand-300 transition-all duration-500 hover:-translate-y-1 h-full">
              <div className="absolute -top-4 left-8">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold shadow-lg shadow-brand-500/30">3</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center mb-5 mt-2 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Thông báo và báo cáo</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Theo dõi thị trường qua dashboard trực quan hoặc nhận thông báo việc làm phù hợp với hồ sơ của bạn qua Telegram, Zalo và Discord.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900" />
        <div className="absolute inset-0">
          <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-brand-400/10 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-20 text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Đừng để job hot vuột mất
            </h2>
            <p className="mt-4 text-brand-100 max-w-lg mx-auto text-lg">
              Đăng ký để AI tự động tìm và gửi alert job phù hợp với bạn. Hoàn toàn miễn phí.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5 text-lg"
              >
                Đăng ký miễn phí &rarr;
              </Link>
              <Link
                href="/signin"
                className="px-6 py-3 text-white/80 hover:text-white font-medium transition-colors text-sm underline underline-offset-4"
              >
                hoặc đăng nhập
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              TalentPulse
            </span>
            <span className="text-sm text-slate-400">
              &copy; 2026. Built for Vietnam tech community.
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
              Dashboard
            </Link>
            <a href="#features" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
              Tính năng
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
