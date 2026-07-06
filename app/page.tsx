"use client";

import { useState } from "react";

import { ForceTheme } from "@/components/theme/ForceTheme";
import Nav from "@/components/landing/sections/Nav";
import Hero from "@/components/landing/sections/Hero";
import Stats from "@/components/landing/sections/Stats";
import AIShowcase from "@/components/landing/sections/AIShowcase";
import HowItWorks from "@/components/landing/sections/HowItWorks";
import ForStudents from "@/components/landing/sections/ForStudents";
import CTA from "@/components/landing/sections/CTA";
import Footer from "@/components/landing/sections/Footer";
import { translations, type Lang } from "@/lib/landing-i18n";

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("vi");
  const t = translations[lang];

  return (
    <div className="min-h-screen overflow-x-hidden bg-bg font-sans text-text">
      <ForceTheme theme="dark" />
      <Nav t={t} lang={lang} setLang={setLang} />
      <main>
        <Hero t={t} />
        <Stats t={t} lang={lang} />
        <AIShowcase t={t} />
        <HowItWorks t={t} />
        <ForStudents t={t} />
        <CTA t={t} />
      </main>
      <Footer t={t} />
    </div>
  );
}
