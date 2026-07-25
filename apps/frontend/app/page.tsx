"use client";

import { useState } from "react";

import ScrollProgress from "@/components/landing/ScrollProgress";
import Nav from "@/components/landing/sections/Nav";
import Hero from "@/components/landing/sections/Hero";
import StatsStrip from "@/components/landing/sections/StatsStrip";
import DataStory from "@/components/landing/sections/DataStory";
import AlertShowcase from "@/components/landing/sections/AlertShowcase";
import AiNativeDemo from "@/components/landing/sections/AiNativeDemo";
import BentoFeatures from "@/components/landing/sections/BentoFeatures";
import ForStudents from "@/components/landing/sections/ForStudents";
import CareerJourney from "@/components/landing/sections/CareerJourney";
import Faq from "@/components/landing/sections/Faq";
import Footer from "@/components/landing/sections/Footer";
import { translations, type Lang } from "@/lib/landing-i18n";

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("vi");
  const t = translations[lang];

  return (
    <div className="landing-shell landing-mesh relative min-h-screen overflow-x-hidden bg-bg font-sans text-text">
      <ScrollProgress />
      <Nav t={t} lang={lang} setLang={setLang} />
      <main className="relative z-10">
        <Hero t={t} lang={lang} />
        <StatsStrip t={t} lang={lang} />
        <AiNativeDemo t={t} />
        <DataStory t={t} lang={lang} />
        <AlertShowcase t={t} />
        <BentoFeatures t={t} />
        <ForStudents t={t} />
        <CareerJourney lang={lang} />
        <Faq t={t} />
      </main>
      <Footer t={t} />
    </div>
  );
}
