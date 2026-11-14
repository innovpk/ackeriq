"use client";

import React from "react";
import { ResilientImage } from "@/components/ResilientImage";
import type {
  AppLanguage,
  FarmXrayData,
  RotationStrategyResult,
  SubsidyConfig,
} from "@/types/ackeriq";
import { buildFarmAerialUrl } from "@/lib/farmAerialUrl";
import { CheckCircle2, FileText, Printer, X } from "lucide-react";

interface FarmActionPlanModalProps {
  xray: FarmXrayData;
  farmAreaHa: number;
  baseline: RotationStrategyResult;
  strategy: RotationStrategyResult;
  isNitrateRestricted: boolean;
  subsidies: SubsidyConfig;
  fionaId?: string;
  lang: AppLanguage;
  onClose: () => void;
}

export function FarmActionPlanModal({
  xray,
  farmAreaHa,
  baseline,
  strategy,
  isNitrateRestricted,
  subsidies,
  fionaId,
  lang,
  onClose,
}: FarmActionPlanModalProps) {
  // Total physical KAS (27% N) mineral fertilizer saved across 4 years in metric tons
  const totalNSavedKg = Math.max(
    0,
    (baseline.avgSyntheticNKgHa - strategy.avgSyntheticNKgHa) * farmAreaHa * 4
  );
  const kasTonsSaved = (totalNSavedKg / 0.27 / 1000).toFixed(1);

  const total4YrGrantEur = Math.round(
    strategy.steps.reduce((s, step) => s + step.subsidyBonusEurHa, 0) *
      farmAreaHa
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Printable 4-year farm and subsidy plan"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="max-w-3xl w-full rounded-3xl bg-white border border-zinc-200 shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action Bar */}
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-950">
                {lang === "de"
                  ? "4-Jahres Anbau- & Förderplan (FIONA / Bank)"
                  : "4-Year Farm & BW Subsidy Summary"}
              </h2>
              <p className="text-xs text-zinc-500">
                {xray.name} · {farmAreaHa} ha
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{lang === "de" ? "Drucken / PDF" : "Print / Save PDF"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close report"
              className="w-9 h-9 rounded-xl border border-zinc-200 hover:bg-zinc-50 flex items-center justify-center text-zinc-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Sheet Content */}
        <div className="p-6 space-y-5 bg-white text-zinc-950">
          {/* Farm Metadata + Live Satellite Thumbnail Row */}
          <div className="flex items-center gap-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 p-3.5 text-xs">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-zinc-200 bg-zinc-900">
              <ResilientImage
                src={buildFarmAerialUrl({
                  lat: xray.lat,
                  lon: xray.lon,
                  farmAreaHa,
                  mode: "thumb",
                })}
                alt={`Satellite thumbnail of ${xray.name}`}
                eager
                sizes="64px"
                className="object-cover"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 min-w-0">
              <div>
                <div className="text-zinc-500">
                  {lang === "de" ? "Betrieb" : "Farm"}
                </div>
                <div className="font-bold text-zinc-950 truncate mt-0.5">
                  {xray.name}
                </div>
              </div>
              <div>
                <div className="text-zinc-500">
                  {lang === "de" ? "Fläche & Hang" : "Area & Slope"}
                </div>
                <div className="font-mono font-bold text-zinc-950 mt-0.5">
                  {farmAreaHa} ha · {xray.slopePct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-zinc-500">FIONA / Region</div>
                <div className="font-mono font-bold text-zinc-950 truncate mt-0.5">
                  {fionaId ?? "Stuttgart · BW"}
                </div>
              </div>
              <div>
                <div className="text-zinc-500">
                  {lang === "de" ? "KAS 27% Ersparnis" : "KAS 27% Saved"}
                </div>
                <div className="font-mono font-bold text-emerald-800 mt-0.5">
                  -{kasTonsSaved} t (4 yr)
                </div>
              </div>
            </div>
          </div>

          {/* 4-Year Crop & Input Table */}
          <div className="rounded-2xl border border-zinc-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
                <tr>
                  <th className="py-2.5 px-3.5 font-semibold">
                    {lang === "de" ? "Jahr" : "Year"}
                  </th>
                  <th className="py-2.5 px-3.5 font-semibold">
                    {lang === "de" ? "Hauptkultur & Begrünung" : "Crop & Winter Cover"}
                  </th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">
                    Mineral N
                  </th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">
                    €/t
                  </th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">
                    {lang === "de" ? "DB / ha" : "Margin / ha"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {strategy.steps.map((s) => (
                  <tr key={s.year}>
                    <td className="py-2.5 px-3.5 font-mono font-semibold text-zinc-600">
                      {2026 + s.year}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="font-bold text-zinc-950">
                        {s.crop.name.split(" (")[0]}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {s.crop.coverCropIncluded ?? s.crop.germanSub}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-right tabular-nums">
                      {s.syntheticNAppliedKgHa} kg/ha
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-right tabular-nums">
                      €{s.appliedPriceEurTon}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono font-bold text-emerald-800 text-right tabular-nums">
                      €{s.netMarginEurHa}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quantified Environmental Impact (IPCC AR6 / FAO-56 / RUSLE) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/90 p-2.5">
              <div className="text-[11px] text-emerald-800">
                {lang === "de" ? "CO₂e vermieden (IPCC)" : "CO₂e Avoided (IPCC)"}
              </div>
              <div className="text-sm font-mono font-bold text-emerald-950 tabular-nums mt-0.5">
                -{strategy.co2eSavedTons4Yr} t CO₂e
              </div>
            </div>

            <div className="rounded-xl bg-sky-50/70 border border-sky-200/90 p-2.5">
              <div className="text-[11px] text-sky-800">
                {lang === "de" ? "NO₃-N Auswaschung" : "NO₃-N Prevented"}
              </div>
              <div className="text-sm font-mono font-bold text-sky-950 tabular-nums mt-0.5">
                -{strategy.nitratePreventedKg4Yr.toLocaleString()} kg N
              </div>
            </div>

            <div className="rounded-xl bg-sky-50/70 border border-sky-200/90 p-2.5">
              <div className="text-[11px] text-sky-800">
                {lang === "de" ? "Wasserbilanz (FAO-56)" : "Water Retained (FAO-56)"}
              </div>
              <div className="text-sm font-mono font-bold text-sky-950 tabular-nums mt-0.5">
                +{strategy.waterRetainedM34Yr.toLocaleString()} m³
              </div>
            </div>

            <div className="rounded-xl bg-amber-50/70 border border-amber-200/90 p-2.5">
              <div className="text-[11px] text-amber-800">
                {lang === "de" ? "Bodenschutz (RUSLE)" : "Topsoil Saved (RUSLE)"}
              </div>
              <div className="text-sm font-mono font-bold text-amber-950 tabular-nums mt-0.5">
                +{strategy.topsoilSavedTons4Yr.toLocaleString()} t
              </div>
            </div>
          </div>

          {/* Compliance & Subsidy Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <div>
                <div className="font-bold text-emerald-950">
                  {isNitrateRestricted ? "DüV -20% Rote Gebiete" : "DüV Compliant"}
                </div>
                <div className="text-[11px] text-emerald-800">
                  100% legal Nitrogen cap
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <div>
                <div className="font-bold text-emerald-950">
                  +€{total4YrGrantEur.toLocaleString()} Grants
                </div>
                <div className="text-[11px] text-emerald-800 truncate">
                  {[
                    subsidies.oeko2LegumeRotation && "Öko-Reg. 2",
                    subsidies.faktCoverCrop && "FAKT II Cover",
                    subsidies.faktPulseBonus && "FAKT II Legume",
                  ]
                    .filter(Boolean)
                    .join(" + ") || "No grants selected"}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <div>
                <div className="font-bold text-zinc-950">
                  +€
                  {Math.max(
                    0,
                    strategy.profitDeltaVsBaselineEur
                  ).toLocaleString()}{" "}
                  Net Gain
                </div>
                <div className="text-[11px] text-zinc-600">
                  4-yr total vs. baseline
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
