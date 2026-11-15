"use client";

import React, { useState } from "react";
import { ResilientImage } from "@/components/ResilientImage";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Sparkles,
  Sprout,
  UserCheck,
} from "lucide-react";
import type { AppLanguage } from "@/types/ackeriq";

export interface DemoSessionUser {
  name: string;
  roleLabel: string;
  planBadge: string;
  betriebsNummer: string;
  defaultPresetId: string;
}

interface FarmerLoginScreenProps {
  lang?: AppLanguage;
  onChangeLang?: (lang: AppLanguage) => void;
  onBackToWelcome: () => void;
  onCompleteLogin: (user: DemoSessionUser) => void;
}

const DEMO_PROFILES: DemoSessionUser[] = [
  {
    name: "Lukas Weber",
    roleLabel: "Plieningen · 165 ha",
    planBadge: "Farm Owner",
    betriebsNummer: "BW-08111-44910",
    defaultPresetId: "filder-plieningen",
  },
  {
    name: "Dr. Hannah Krauss",
    roleLabel: "Agronomy Advisor",
    planBadge: "Advisor",
    betriebsNummer: "BW-08111-90214",
    defaultPresetId: "ludwigsburg-neckar",
  },
];

export function FarmerLoginScreen({
  lang = "en",
  onChangeLang,
  onBackToWelcome,
  onCompleteLogin,
}: FarmerLoginScreenProps) {
  const [email, setEmail] = useState("lukas.weber@filderhof-stuttgart.de");
  const [password, setPassword] = useState("••••••••••••");
  const [betriebsNr, setBetriebsNr] = useState("08 111 044910");
  const [loginTab, setLoginTab] = useState<"email" | "fiona">("email");

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = email.includes("@")
      ? email
          .split("@")[0]
          .split(/[._-]/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ")
      : "Stuttgart Farmer";

    onCompleteLogin({
      name: cleanName || "Lukas Weber",
      roleLabel: loginTab === "fiona" ? `FIONA ${betriebsNr}` : "Farm Account",
      planBadge: "Farm Owner",
      betriebsNummer: betriebsNr,
      defaultPresetId: "filder-plieningen",
    });
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-950 flex flex-col justify-between overflow-x-hidden">
      <header className="w-full bg-white border-b border-zinc-200/80">
        <div className="w-full max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-10 h-14 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToWelcome}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center text-white">
              <Sprout className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-zinc-950">
              AckerIQ
            </span>
          </button>

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
              onClick={onBackToWelcome}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs sm:text-sm font-semibold text-zinc-700 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === "de" ? "Zurück" : "Back"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1840px] mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6 flex-1 flex flex-col">
        <div className="flex-1 min-h-[500px] lg:min-h-[580px] grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 w-full items-stretch">
          {/* Left: 1-Click Demo + Compact Sign-In */}
          <div className="lg:col-span-5 flex flex-col justify-center space-y-5">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">
                {lang === "de"
                  ? "Anmelden oder 1-Klick-Demo starten"
                  : "Sign in or try 1-click demo"}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-600">
                {lang === "de"
                  ? "NASA-Satelliten-Bodenfeuchte, Sommerhitze-Analyse & 4-Jahres-Fruchtfolgeplanung für Ihren Betrieb."
                  : "NASA satellite soil moisture, summer heat & 4-year crop rotation planner for your farm."}
              </p>
            </div>

            {/* 1-Click Demo Accounts */}
            <div className="rounded-2xl border-2 border-emerald-600/80 bg-emerald-50/40 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  {lang === "de" ? "1-Klick Sofort-Demo" : "1-Click Instant Demo"}
                </span>
                <span className="text-[11px] font-medium text-emerald-800">
                  {lang === "de" ? "Ohne Passwort" : "No password"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {DEMO_PROFILES.map((profile) => (
                  <button
                    key={profile.name}
                    type="button"
                    onClick={() => onCompleteLogin(profile)}
                    className="text-left p-3 rounded-xl bg-white hover:bg-emerald-50/60 border border-emerald-200 hover:border-emerald-600 transition-all cursor-pointer flex flex-col gap-1 shadow-2xs group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-950">
                        <UserCheck className="w-4 h-4 text-emerald-700" />
                        {profile.name}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-700 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {profile.roleLabel} ·{" "}
                      <span className="font-semibold text-emerald-800">
                        {profile.planBadge}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Compact Credentials Form */}
            <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] space-y-4">
              <div
                className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100/80"
                role="tablist"
                aria-label="Sign-in method"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginTab === "email"}
                  onClick={() => setLoginTab("email")}
                  className={`min-h-[36px] rounded-lg text-xs font-semibold cursor-pointer ${
                    loginTab === "email"
                      ? "bg-white text-zinc-950 shadow-2xs"
                      : "text-zinc-600"
                  }`}
                >
                  {lang === "de" ? "E-Mail" : "Email"}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={loginTab === "fiona"}
                  onClick={() => setLoginTab("fiona")}
                  className={`min-h-[36px] rounded-lg text-xs font-semibold cursor-pointer ${
                    loginTab === "fiona"
                      ? "bg-white text-zinc-950 shadow-2xs"
                      : "text-zinc-600"
                  }`}
                >
                  BW FIONA ID
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-3.5">
                {loginTab === "email" ? (
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      aria-label="Farm email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-sm text-zinc-950 focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      aria-label="FIONA Betriebsnummer"
                      value={betriebsNr}
                      onChange={(e) => setBetriebsNr(e.target.value)}
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-sm font-mono text-zinc-950 focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                )}

                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    aria-label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-sm text-zinc-950 focus:outline-none focus:border-emerald-700"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[46px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <span>{lang === "de" ? "Anmelden" : "Sign In"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Right: Clean Photo + 3 Crisp Pills */}
          <div className="lg:col-span-7 relative w-full min-h-[360px] lg:h-full rounded-3xl overflow-hidden border border-zinc-200/90 bg-zinc-900 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <ResilientImage
              src="/images/tractor-precision-cab.jpg"
              alt="Precision farming cab view over Region Stuttgart fields"
              eager
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <div className="absolute bottom-7 left-7 right-7 text-white space-y-2.5">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {lang === "de"
                  ? "Fruchtfolge-Planung & Traktor N-Karten"
                  : "Crop Rotation & Tractor N-Map Suite"}
              </h2>
              <div className="flex flex-wrap gap-2 pt-1">
                {(lang === "de"
                  ? [
                      "-45% Düngerkosten",
                      "Traktor ISOXML Export",
                      "Förder- & Anbauplan",
                    ]
                  : [
                      "-45% Fertilizer Cost",
                      "Tractor ISOXML Export",
                      "Subsidy & Farm Plan",
                    ]
                ).map((pill) => (
                  <span
                    key={pill}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-xs font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    {pill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

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
