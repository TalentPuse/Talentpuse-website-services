"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import GradientBackground from "@/components/landing/GradientBackground";
import FloatingDashboard from "@/components/landing/FloatingDashboard";
import AnimatedCounter from "@/components/landing/AnimatedCounter";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { translations, type Lang } from "@/lib/landing-i18n";

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("vi");
  const t = translations[lang];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold bg-linear-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
            TalentPulse
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-medium">
              <button
                onClick={() => setLang("vi")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  lang === "vi"
                    ? "bg-white text-brand-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                VI
              </button>
              <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  lang === "en"
                    ? "bg-white text-brand-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                EN
              </button>
            </div>

            <a
              href="#ai-alert"
              className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              {t.nav.features}
            </a>
            <Link
              href="/signin"
              className="hidden sm:block text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              {t.nav.signIn}
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-5 py-2 rounded-lg transition-all hover:shadow-lg hover:shadow-brand-600/25"
            >
              {t.nav.signUp}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[92vh] flex flex-col items-center justify-start pt-16 sm:pt-24 pb-8">
        <GradientBackground />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-50 border border-brand-200 rounded-full text-sm font-medium text-brand-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
            </span>
            {t.hero.badge}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-center leading-[1.1] max-w-4xl mx-auto px-6"
        >
          <span className="text-slate-900">{t.hero.heading1}</span>
          <span className="bg-linear-to-r from-brand-600 via-brand-500 to-brand-400 bg-clip-text text-transparent">
            {t.hero.heading2}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-6 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto text-center leading-relaxed px-6"
        >
          {t.hero.sub}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 px-6"
        >
          <Link
            href="/signup"
            className="group w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl shadow-lg shadow-slate-900/20 transition-all hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5 text-center"
          >
            {t.hero.ctaPrimary}
            <span className="inline-block ml-1 transition-transform group-hover:translate-x-0.5">&rarr;</span>
          </Link>
          <Link
            href="/signin"
            className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-all hover:shadow-md hover:border-slate-300 text-center"
          >
            {t.hero.ctaSecondary}
          </Link>
        </motion.div>

        <div className="mt-16 w-full px-4 sm:px-6">
          <FloatingDashboard />
        </div>
      </section>

      {/* Trusted by - Logos/Stats Bar */}
      <section className="border-y border-slate-200 bg-slate-50/50">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <ScrollReveal delay={0}>
              <div className="space-y-1">
                <div className="text-3xl sm:text-4xl font-bold text-slate-900">
                  <AnimatedCounter target={10} suffix="+" />
                </div>
                <div className="text-sm text-slate-500">{t.stats.sources}</div>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <div className="space-y-1">
                <div className="text-3xl sm:text-4xl font-bold text-slate-900">
                  <AnimatedCounter target={1000} suffix="+" />
                </div>
                <div className="text-sm text-slate-500">{t.stats.jobs}</div>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <div className="space-y-1">
                <div className="text-3xl sm:text-4xl font-bold text-slate-900">24/7</div>
                <div className="text-sm text-slate-500">{t.stats.realtime}</div>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.3}>
              <div className="space-y-1">
                <div className="text-3xl sm:text-4xl font-bold text-slate-900">
                  <AnimatedCounter target={4} suffix="+" />
                </div>
                <div className="text-sm text-slate-500">{t.stats.channels}</div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* AI Job Alert Showcase */}
      <section id="ai-alert" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-0 w-[500px] h-[500px] rounded-full bg-brand-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-brand-400/5 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <ScrollReveal direction="left">
              <div>
                <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 bg-brand-500/10 border border-brand-400/20 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400" />
                  </span>
                  <span className="text-xs font-semibold text-brand-300">{t.aiAlert.badge}</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight whitespace-pre-line">
                  {t.aiAlert.heading}
                </h2>
                <p className="mt-5 text-slate-300 text-lg leading-relaxed max-w-md">
                  {t.aiAlert.description}
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    { title: t.aiAlert.bullet1Title, desc: t.aiAlert.bullet1 },
                    { title: t.aiAlert.bullet2Title, desc: t.aiAlert.bullet2 },
                    { title: t.aiAlert.bullet3Title, desc: t.aiAlert.bullet3 },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 w-5 h-5 rounded-md bg-brand-500/20 text-brand-300 flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </span>
                      <span className="text-slate-300">
                        <strong className="text-white">{item.title}</strong>{item.desc}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 bg-white text-slate-900 font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5 text-base"
                >
                  {t.aiAlert.cta}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </ScrollReveal>

            {/* Right — notification mockup cards */}
            <ScrollReveal direction="right" delay={0.2}>
              <div className="relative flex flex-col gap-4 lg:pl-8">
                {[
                  {
                    match: 95, color: "emerald", title: "Senior React Developer",
                    company: "FPT Software", location: "Ho Chi Minh",
                    salary: "30-45M VND", skills: "React, TypeScript, AWS", time: "2", timeUnit: t.notifications.minAgo,
                  },
                  {
                    match: 88, color: "brand", title: "AI/ML Engineer",
                    company: "VNG Corporation", location: "Ho Chi Minh",
                    salary: "40-60M VND", skills: "Python, PyTorch, LLM", time: "15", timeUnit: t.notifications.minAgo,
                  },
                  {
                    match: 82, color: "amber", title: "DevOps Engineer",
                    company: "Tiki", location: "Hanoi",
                    salary: "25-40M VND", skills: "Docker, K8s, Terraform", time: "1", timeUnit: t.notifications.hourAgo,
                  },
                ].map((n, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 40, y: 20 }}
                    whileInView={{ opacity: 1, x: 0, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.2, duration: 0.6 }}
                    className={`bg-white rounded-2xl p-5 shadow-2xl border border-slate-100 ${i === 1 ? "lg:ml-6" : i === 2 ? "lg:ml-2" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-${n.color}-100 text-${n.color}-600 flex items-center justify-center shrink-0`}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold text-${n.color}-600 bg-${n.color}-50 px-2 py-0.5 rounded-full`}>{t.notifications.match} {n.match}%</span>
                          <span className="text-xs text-slate-400">{n.time} {n.timeUnit}</span>
                        </div>
                        <h4 className="mt-1.5 font-semibold text-slate-900 text-sm">{n.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{n.company} &middot; {n.location}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-sm">{n.salary}</span>
                          <span className="text-xs text-slate-400 truncate">{n.skills}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                  className="flex items-center gap-3 mt-2 justify-center lg:justify-start"
                >
                  <span className="text-xs text-slate-400">{t.aiAlert.sentVia}</span>
                  {["Telegram", "Zalo", "Discord", "Email"].map((ch) => (
                    <span key={ch} className="px-3 py-1 text-xs font-medium bg-white/10 text-slate-300 rounded-full border border-white/10">
                      {ch}
                    </span>
                  ))}
                </motion.div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-28">
        <ScrollReveal>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 bg-brand-50 border border-brand-200 rounded-full">
              <span className="text-xs font-medium text-brand-700">{t.howItWorks.badge}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">{t.howItWorks.heading}</h2>
            <p className="mt-4 text-slate-500 max-w-2xl mx-auto text-lg">
              {t.howItWorks.sub}
            </p>
          </div>
        </ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {[
            { num: "1", gradient: "from-blue-500 to-blue-600", title: t.howItWorks.step1.title, desc: t.howItWorks.step1.description, icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" },
            { num: "2", gradient: "from-violet-500 to-violet-600", title: t.howItWorks.step2.title, desc: t.howItWorks.step2.description, icon: "M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" },
            { num: "3", gradient: "from-emerald-500 to-emerald-600", title: t.howItWorks.step3.title, desc: t.howItWorks.step3.description, icon: "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" },
          ].map((step, i) => (
            <ScrollReveal key={i} delay={i * 0.15}>
              <div className="group relative bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-xl hover:border-slate-300 transition-all duration-500 hover:-translate-y-1 h-full">
                <div className="absolute -top-4 left-8">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-bold shadow-lg">{step.num}</span>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${step.gradient} text-white flex items-center justify-center mb-5 mt-2 shadow-md group-hover:shadow-lg transition-shadow`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* For Students */}
      <section id="student-features" className="relative overflow-hidden bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <ScrollReveal>
            <div className="text-center mb-14">
              <span className="inline-block rounded-full bg-indigo-100 px-4 py-1.5 text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-4">
                {t.studentFeatures.badge}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                {t.studentFeatures.heading}
              </h2>
              <p className="mt-4 text-slate-500 max-w-xl mx-auto text-lg">
                {t.studentFeatures.sub}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                gradient: "from-indigo-500 to-indigo-600",
                title: t.studentFeatures.jobSearch.title,
                desc: t.studentFeatures.jobSearch.description,
                icon: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
              },
              {
                gradient: "from-purple-500 to-purple-600",
                title: t.studentFeatures.cvReview.title,
                desc: t.studentFeatures.cvReview.description,
                icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
              },
              {
                gradient: "from-amber-500 to-amber-600",
                title: t.studentFeatures.mockInterview.title,
                desc: t.studentFeatures.mockInterview.description,
                icon: "M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155",
              },
              {
                gradient: "from-emerald-500 to-emerald-600",
                title: t.studentFeatures.tips.title,
                desc: t.studentFeatures.tips.description,
                icon: "M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18",
              },
            ].map((feature, i) => (
              <ScrollReveal key={i}>
                <div className="group relative bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-lg hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 h-full">
                  <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${feature.gradient} text-white flex items-center justify-center mb-4 shadow-md group-hover:shadow-lg transition-shadow`}>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal>
            <div className="text-center mt-10">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
              >
                {t.studentFeatures.cta}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full bg-brand-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-brand-400/5 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-24 text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              {t.cta.heading}
            </h2>
            <p className="mt-4 text-slate-300 max-w-lg mx-auto text-lg">
              {t.cta.sub}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="px-10 py-4 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5 text-lg"
              >
                {t.cta.button} &rarr;
              </Link>
              <Link
                href="/signin"
                className="px-6 py-3 text-slate-400 hover:text-white font-medium transition-colors text-sm underline underline-offset-4 decoration-slate-600 hover:decoration-white"
              >
                {t.cta.orSignIn}
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-10">
            <div className="flex flex-col gap-3">
              <span className="text-xl font-bold bg-linear-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">
                TalentPulse
              </span>
              <p className="text-sm max-w-xs leading-relaxed">
                {t.footer.tagline}
              </p>
            </div>
            <div className="flex gap-16 text-sm">
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{t.footer.product}</span>
                <Link href="/dashboard" className="hover:text-white transition-colors">{t.footer.dashboard}</Link>
                <a href="#ai-alert" className="hover:text-white transition-colors">{t.footer.features}</a>
                <Link href="/signup" className="hover:text-white transition-colors">{t.footer.signUp}</Link>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{t.footer.connect}</span>
                <a href="https://t.me/TalentPuseBot" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Telegram Bot</a>
                <a href="mailto:baonm@talentpuse.io.vn" className="hover:text-white transition-colors">baonm@talentpuse.io.vn</a>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-slate-800 text-xs text-slate-500 text-center">
            {t.footer.copyright}
          </div>
        </div>
      </footer>
    </div>
  );
}
