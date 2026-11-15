"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Coins,
  Leaf,
  LogIn,
  ShieldCheck,
  Sprout,
  Sun,
} from "lucide-react";
import type { AppLanguage } from "@/types/ackeriq";
import { FarmAddressSearch } from "@/components/FarmAddressSearch";
import { ResilientImage } from "@/components/ResilientImage";

interface OrbitalSplashScreenProps {
  lang?: AppLanguage;
  onChangeLang?: (lang: AppLanguage) => void;
  onStartOnboarding: (presetId: string) => void;
  onStartCustomAddress: (item: {
    lat: number;
    lon: number;
    shortTitle: string;
    fullAddress: string;
  }) => void;
  onOpenLogin: () => void;
}

interface FeatureSlide {
  id: string;
  num: string;
  tab: Record<AppLanguage, string>;
  headline: Record<AppLanguage, string>;
  oneLiner: Record<AppLanguage, string>;
  metric: Record<AppLanguage, string>;
  metricSub: Record<AppLanguage, string>;
  imageUrl: string;
  photoBadge: Record<AppLanguage, string>;
  presetId: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SLIDES: FeatureSlide[] = [
  {
    id: "fertilizer",
    num: "01",
    tab: { en: "Less Fertilizer", de: "Dünger sparen" },
    headline: {
      en: "Cut synthetic Nitrogen bills by up to 50%.",
      de: "Bis zu 50% Mineraldünger sparen.",
    },
    oneLiner: {
      en: "Regionally adapted legumes leave +65–80 kg/ha of free Nitrogen before Wheat or Spelt—slashing mineral fertilizer bills.",
      de: "Regional passende Körnerleguminosen liefern +65–80 kg N/ha kostenlos für folgenden Weizen oder Dinkel.",
    },
    metric: { en: "-35% to -71% N", de: "-35% bis -71% N" },
    metricSub: {
      en: "€8,000–€20,000 saved per 4 years (165 ha)",
      de: "€8.000–€20.000 Ersparnis in 4 Jahren (165 ha)",
    },
    imageUrl: "/images/crop-soybean.jpg",
    photoBadge: {
      en: "000 Soybeans & Pulses · 0 kg Mineral N",
      de: "000-Soja & Eiweißpflanzen · 0 kg Mineral-N",
    },
    presetId: "filder-plieningen",
    icon: Leaf,
  },
  {
    id: "nitrate",
    num: "02",
    tab: { en: "Nitrate Rule Safe", de: "Rote Gebiete sicher" },
    headline: {
      en: "Stay 100% legal in -20% Nitrate Zones.",
      de: "100% rechtssicher im -20% Nitratgebiet.",
    },
    oneLiner: {
      en: "Spelt, Malting Barley, and winter cover crops protect grain quality inside Rote Gebiete while exporting ISOXML tractor maps.",
      de: "Dinkel, Braugerste & Zwischenfrucht sichern Qualität in Roten Gebieten inklusive ISOXML Traktor-Streukarten.",
    },
    metric: { en: "100% DüV Safe", de: "100% DüV-konform" },
    metricSub: {
      en: "Up to 42 kg N/ha trapped over winter",
      de: "Bis zu 42 kg N/ha im Winter gebunden",
    },
    imageUrl: "/images/crop-spelt.jpg",
    photoBadge: {
      en: "Winter Spelt · -40% Less N Needed",
      de: "Winterdinkel · -40% N-Bedarf",
    },
    presetId: "herrenberg-gaeu",
    icon: ShieldCheck,
  },
  {
    id: "prices",
    num: "03",
    tab: { en: "Custom Crops & €/t", de: "Kultur-Check & €/t" },
    headline: {
      en: "Match local & custom crops to soil, heat & live €/t.",
      de: "Regionale & eigene Kulturen nach Boden, Hitze & €/t prüfen.",
    },
    oneLiner: {
      en: "Verifies regional cultivation, tests any custom crop against your soil moisture & heat, and stacks FAKT II + EU subsidies.",
      de: "Prüft Bodenfeuchte, Sommerhitze & eigene Wunsch-Kulturen inklusive Live-€/t Preisen und FAKT II Prämien.",
    },
    metric: { en: "+€60–€150 / ha", de: "+€60–€150 / ha" },
    metricSub: {
      en: "Live Eurostat €/t + custom crop suitability check",
      de: "Live Eurostat €/t + Eignungscheck eigener Kulturen",
    },
    imageUrl: "/images/farm-offenau.jpg",
    photoBadge: {
      en: "Regional Hubs & Custom Crop 4-Yr Planner",
      de: "Regionale Märkte & 4-Jahres-Fruchtfolge",
    },
    presetId: "ludwigsburg-neckar",
    icon: Coins,
  },
  {
    id: "drought",
    num: "04",
    tab: { en: "Drought & Runoff", de: "Hitze & Erosion" },
    headline: {
      en: "Beat 37°C July heatwaves & hillside runoff.",
      de: "Sicher durch 37°C Juli-Hitze & Starkregen.",
    },
    oneLiner: {
      en: "NASA satellite soil-moisture, 7-day spreader weather, and SRTM slope scans protect every hectare.",
      de: "NASA Bodenfeuchte, 7-Tage Streufenster & SRTM-Hangneigung schützen jeden Schlag.",
    },
    metric: { en: "-76% Erosion", de: "-76% Erosion" },
    metricSub: {
      en: "NASA SMAP moisture + SRTM slope check",
      de: "NASA SMAP Bodenfeuchte + SRTM Hangscan",
    },
    imageUrl: "/images/soil-cover-mulch.jpg",
    photoBadge: {
      en: "Phacelia-Clover Winter Cover Shield",
      de: "Phacelia-Klee Winterbegrünung",
    },
    presetId: "fellbach-rems",
    icon: Sun,
  },
];

export function OrbitalSplashScreen({
  lang = "en",
  onChangeLang,
  onStartOnboarding,
  onStartCustomAddress,
  onOpenLogin,
}: OrbitalSplashScreenProps) {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [paused]);

  const slide = SLIDES[activeIdx];
  const Icon = slide.icon;

  const goPrev = () =>
    setActiveIdx((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  const goNext = () => setActiveIdx((prev) => (prev + 1) % SLIDES.length);

  return (
    <div className="min-h-dvh bg-white text-zinc-950 flex flex-col justify-between overflow-x-hidden">
      {/* Minimal Pure-White Header */}
      <header className="w-full bg-white border-b border-zinc-200/80">
        <div className="w-full max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-10 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center text-white">
              <Sprout className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-zinc-950">
              AckerIQ
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onChangeLang && (
              <div
                role="group"
                aria-label="Language selector"
                className="inline-flex items-center rounded-xl border border-zinc-200 bg-zinc-50 p-0.5"
              >
                {(["en", "de"] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onChangeLang(code)}
                    className={`min-h-[34px] px-2.5 rounded-lg text-xs font-bold uppercase cursor-pointer transition-colors ${
                      lang === code
                        ? "bg-white text-emerald-800 shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onOpenLogin}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <LogIn className="w-4 h-4 text-emerald-700" />
              <span>{lang === "de" ? "Anmelden / Demo" : "Login / Demo"}</span>
            </button>

            <button
              type="button"
              onClick={() => onStartOnboarding(slide.presetId)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>{lang === "de" ? "Jetzt starten" : "Start Farm Scan"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Full-Viewport Widescreen Slide Stage */}
      <main
        className="w-full max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-5 lg:py-6 flex-1 flex flex-col gap-3.5"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") goPrev();
          if (e.key === "ArrowRight") goNext();
        }}
      >
        {/* Minimal Slide Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label="Why farmers use AckerIQ"
          >
            {SLIDES.map((s, idx) => {
              const active = idx === activeIdx;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveIdx(idx)}
                  className={`min-h-[38px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer inline-flex items-center gap-2 border ${
                    active
                      ? "bg-emerald-700 border-emerald-700 text-white"
                      : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  <span className="font-mono text-xs opacity-80">
                    {s.num}
                  </span>
                  <span>{s.tab[lang]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous slide"
              className="w-9 h-9 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 inline-flex items-center justify-center cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next slide"
              className="w-9 h-9 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 inline-flex items-center justify-center cursor-pointer transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Full-Height Visual Widescreen Slide Card */}
        <div className="flex-1 min-h-[460px] lg:min-h-[560px] rounded-3xl border border-zinc-200/90 bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03),0_20px_44px_rgba(0,0,0,0.06)] grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left: Punchy Minimal Copy + Direct Address Input */}
          <div className="lg:col-span-5 p-6 sm:p-8 xl:p-11 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-700">
                <Icon className="w-4 h-4" />
                NASA Farm Intelligence · {slide.num}/04
              </span>

              <h1 className="text-3xl sm:text-4xl xl:text-[2.65rem] font-bold tracking-tight text-zinc-950 leading-[1.1]">
                {slide.headline[lang]}
              </h1>

              <p className="text-sm sm:text-base xl:text-lg text-zinc-600 leading-relaxed max-w-xl">
                {slide.oneLiner[lang]}
              </p>

              <div className="inline-flex flex-wrap items-baseline gap-3 pt-1">
                <span className="text-3xl sm:text-4xl font-bold text-emerald-800 tabular-nums">
                  {slide.metric[lang]}
                </span>
                <span className="text-xs sm:text-sm text-zinc-500">
                  {slide.metricSub[lang]}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {(lang === "de"
                  ? [
                      "NASA SMAP Bodenfeuchte",
                      "20cm Hof-Luftbild & Hang",
                      "ISOXML Traktor-Export",
                    ]
                  : [
                      "NASA SMAP Moisture",
                      "20cm Farm Aerial & Slope",
                      "ISOXML Tractor Export",
                    ]
                ).map((chip) => (
                  <span
                    key={chip}
                    className="px-3 py-1 rounded-full bg-zinc-50 border border-zinc-200/80 text-xs font-medium text-zinc-700"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            {/* Clean Address Bar + Quick Demo Link */}
            <div className="space-y-3 pt-5 border-t border-zinc-100">
              <FarmAddressSearch
                compact
                placeholder={
                  lang === "de"
                    ? "Hofadresse oder PLZ eingeben (z.B. 70599 Plieningen)..."
                    : "Enter farm address or PLZ (e.g. 70599 Plieningen)..."
                }
                onSelectAddress={onStartCustomAddress}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-zinc-500">
                <button
                  type="button"
                  onClick={() => onStartOnboarding(slide.presetId)}
                  className="font-semibold text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>
                    {lang === "de"
                      ? "Oder 1-Klick Beispielbetrieb öffnen"
                      : "Or try a 1-click sample farm"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="font-medium text-zinc-600 hover:text-zinc-950 cursor-pointer"
                >
                  {lang === "de"
                    ? "Mit Demo-Konto anmelden"
                    : "Sign in with Demo Account"}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Large Full-Height Real Photography */}
          <div className="relative w-full min-h-[300px] sm:min-h-[380px] lg:h-full lg:col-span-7 overflow-hidden bg-zinc-900">
            {SLIDES.map((s, idx) => {
              const isCurrent = idx === activeIdx;
              return (
                <div
                  key={s.id}
                  aria-hidden={!isCurrent}
                  className={`absolute inset-0 transition-opacity duration-500 ease-out ${
                    isCurrent
                      ? "opacity-100 z-10"
                      : "opacity-0 z-0 pointer-events-none"
                  }`}
                >
                  <ResilientImage
                    src={s.imageUrl}
                    alt={s.photoBadge[lang]}
                    eager
                    sizes="(max-width: 1024px) 100vw, 58vw"
                    className="object-cover"
                  />
                </div>
              );
            })}
            <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-6 left-6 right-6 z-30 flex items-center justify-between gap-2">
              <span className="px-4 py-2 rounded-full bg-white/95 backdrop-blur-md text-xs sm:text-sm font-semibold text-zinc-900 shadow-sm">
                {slide.photoBadge[lang]}
              </span>
              <div className="flex items-center gap-2">
                {SLIDES.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`Go to slide ${idx + 1}`}
                    onClick={() => setActiveIdx(idx)}
                    className={`h-2.5 rounded-full transition-all cursor-pointer ${
                      idx === activeIdx
                        ? "w-7 bg-white"
                        : "w-2.5 bg-white/55 hover:bg-white/80"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Ultra-Clean 1-Line Footer */}
      <footer className="border-t border-zinc-100 bg-white py-2.5 px-4 sm:px-6 lg:px-10">
        <div className="w-full max-w-[1840px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
          <span>
            NASA Earthdata · ISRIC SoilGrids · Live EU Eurostat Prices
          </span>
          <span className="font-mono">NASA Space Apps 2026</span>
        </div>
      </footer>
    </div>
  );
}
