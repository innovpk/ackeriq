"use client";

import React, { useState } from "react";
import { ResilientImage } from "@/components/ResilientImage";
import type {
  AppLanguage,
  RotationStrategyResult,
  RotationYearStep,
} from "@/types/ackeriq";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
  Tractor,
} from "lucide-react";

interface RotationStrategyCardsProps {
  isNitrateRestricted: boolean;
  farmAreaHa: number;
  strategies: RotationStrategyResult[];
  lang?: AppLanguage;
  onOpenTractorMap?: (strategy: RotationStrategyResult) => void;
  onOpenActionPlan?: (strategy: RotationStrategyResult) => void;
}

type CoverSegmentKind = "crop" | "mulch" | "bare";

function build4YearSeasonalRibbon(
  steps: RotationYearStep[]
): Array<{ key: string; kind: CoverSegmentKind; label: string }> {
  const blocks: Array<{ key: string; kind: CoverSegmentKind; label: string }> =
    [];

  steps.forEach((step) => {
    const hasCover = Boolean(step.crop.coverCropIncluded);
    const highBare = step.bareMonths >= 3.2;

    // 4 quarters per year (Winter, Spring, Summer, Autumn)
    const quarters: Array<{ season: string; kind: CoverSegmentKind }> = hasCover
      ? [
          { season: "Win", kind: "mulch" },
          { season: "Spr", kind: "crop" },
          { season: "Sum", kind: "crop" },
          { season: "Aut", kind: "mulch" },
        ]
      : highBare
      ? [
          { season: "Win", kind: "bare" },
          { season: "Spr", kind: "bare" },
          { season: "Sum", kind: "crop" },
          { season: "Aut", kind: "crop" },
        ]
      : [
          { season: "Win", kind: "crop" },
          { season: "Spr", kind: "crop" },
          { season: "Sum", kind: "crop" },
          { season: "Aut", kind: "bare" },
        ];

    quarters.forEach((q, qIdx) => {
      blocks.push({
        key: `y${step.year}-q${qIdx}`,
        kind: q.kind,
        label: `Yr ${step.year} ${q.season}: ${
          q.kind === "crop"
            ? step.crop.name.split(" (")[0]
            : q.kind === "mulch"
            ? step.crop.coverCropIncluded ?? "Winter Cover"
            : "Bare Soil Exposure"
        }`,
      });
    });
  });

  return blocks;
}

export function RotationStrategyCards({
  isNitrateRestricted,
  farmAreaHa,
  strategies,
  lang = "en",
  onOpenTractorMap,
  onOpenActionPlan,
}: RotationStrategyCardsProps) {
  const [expandedExplainIds, setExpandedExplainIds] = useState<
    Record<string, boolean>
  >({});

  const topAdaptedId = [...strategies]
    .filter((s) => !s.isBaseline)
    .sort((a, b) => b.goalMatchScore - a.goalMatchScore)[0]?.id;

  const toggleExplain = (id: string) => {
    setExpandedExplainIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatEur = (val: number) => {
    const abs = Math.abs(Math.round(val)).toLocaleString();
    return val < 0 ? `-€${abs}` : `€${abs}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      {strategies.map((strategy) => {
        const isTopPick = strategy.id === topAdaptedId;
        const isOpen = !!expandedExplainIds[strategy.id];
        const ribbonBlocks = build4YearSeasonalRibbon(strategy.steps);

        return (
          <article
            key={strategy.id}
            className={`rounded-2xl bg-white transition-all flex flex-col overflow-hidden ${
              isTopPick
                ? "border-2 border-emerald-700 shadow-[0_8px_28px_rgba(21,128,61,0.12)]"
                : "border border-zinc-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)]"
            }`}
          >
            {/* Header Badge */}
            <div
              className={`px-4 py-2 border-b flex items-center justify-between gap-2 ${
                isTopPick
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-zinc-50/90 text-zinc-700 border-zinc-200/80"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                {isTopPick
                  ? lang === "de"
                    ? "Beste Empfehlung"
                    : "Recommended Plan"
                  : strategy.badge}
              </span>
              {isNitrateRestricted && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    isTopPick
                      ? "bg-white/20 text-white"
                      : strategy.nitrateCapSafe
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-amber-50 border border-amber-200 text-amber-800"
                  }`}
                >
                  {strategy.nitrateCapSafe ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  {strategy.nitrateCapSafe ? "-20% Safe" : "-20% Risk"}
                </span>
              )}
            </div>

            {/* Title + Compact KPIs + 4-Year Ground-Cover Color Ribbon */}
            <div className="p-3.5 border-b border-zinc-200/80 space-y-2.5">
              <h3 className="text-base font-bold tracking-tight text-zinc-950">
                {strategy.title}
              </h3>

              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 px-2.5 py-2">
                  <div className="text-[10px] font-medium text-zinc-500">
                    {lang === "de" ? "DB / ha" : "Profit/ha"}
                  </div>
                  <div className="text-sm sm:text-base font-bold text-zinc-950 tabular-nums leading-tight mt-0.5">
                    {formatEur(strategy.avgAnnualNetMarginEurHa)}
                    <span className="text-[10px] font-normal text-zinc-500">/yr</span>
                  </div>
                  <div
                    className={`text-[10px] font-medium tabular-nums truncate mt-0.5 ${
                      strategy.isBaseline
                        ? "text-zinc-500"
                        : "text-emerald-700 font-semibold"
                    }`}
                  >
                    {strategy.isBaseline
                      ? `${farmAreaHa} ha base`
                      : `+${formatEur(Math.max(0, strategy.profitDeltaVsBaselineEur))} (4y)`}
                  </div>
                </div>

                <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 px-2.5 py-2">
                  <div className="text-[10px] font-medium text-zinc-500">
                    {lang === "de" ? "Mineral-N" : "Mineral N"}
                  </div>
                  <div className="text-sm sm:text-base font-bold text-zinc-950 tabular-nums leading-tight mt-0.5">
                    {strategy.avgSyntheticNKgHa}
                    <span className="text-[10px] font-normal text-zinc-500"> kg</span>
                  </div>
                  <div
                    className={`text-[10px] font-medium tabular-nums truncate mt-0.5 ${
                      strategy.isBaseline
                        ? "text-amber-700"
                        : "text-emerald-700 font-semibold"
                    }`}
                  >
                    {strategy.isBaseline
                      ? `${strategy.avgNitrateLeachingKgHaYr} kg NO₃ leach`
                      : `-${strategy.syntheticNSavedPctVsBaseline}% (${formatEur(
                          strategy.total4YrFertCostSavedEur
                        )})`}
                  </div>
                </div>

                <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 px-2.5 py-2">
                  <div className="text-[10px] font-medium text-zinc-500">
                    {lang === "de" ? "Klima & Wasser" : "CO₂e & NO₃⁻"}
                  </div>
                  <div className="text-sm sm:text-base font-bold text-zinc-950 tabular-nums leading-tight mt-0.5">
                    {strategy.isBaseline ? (
                      <>
                        {strategy.avgCo2eKgHaYr}
                        <span className="text-[10px] font-normal text-zinc-500"> kg</span>
                      </>
                    ) : (
                      <span className="text-emerald-800">
                        -{strategy.co2eSavedTons4Yr}
                        <span className="text-[10px] font-normal text-emerald-700"> t</span>
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-[10px] font-medium tabular-nums truncate mt-0.5 ${
                      strategy.isBaseline
                        ? "text-zinc-500"
                        : "text-emerald-700 font-semibold"
                    }`}
                  >
                    {strategy.isBaseline
                      ? "CO₂e/ha/yr"
                      : `-${strategy.nitratePreventedKg4Yr.toLocaleString()} kg NO₃`}
                  </div>
                </div>
              </div>

              {/* Visual 4-Year Ground-Cover Color Ribbon */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span className="font-medium text-zinc-600">
                    {strategy.bareSoilMonthsAvg}m bare/yr
                  </span>
                  <span className="font-mono text-sky-700">
                    {strategy.avgWaterNeedMm} mm/yr
                  </span>
                </div>

                <div
                  className="grid grid-cols-16 gap-0.5 h-2 rounded-full overflow-hidden bg-zinc-100 p-0.5 border border-zinc-200/70"
                  aria-label="4-year seasonal ground cover visual ribbon"
                >
                  {ribbonBlocks.map((b) => (
                    <span
                      key={b.key}
                      title={b.label}
                      className={`h-full rounded-[2px] ${
                        b.kind === "crop"
                          ? "bg-emerald-600"
                          : b.kind === "mulch"
                          ? "bg-teal-400"
                          : "bg-rose-500"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Clean Visual 4-Year Crop Rows */}
            <div className="p-3 space-y-1.5 bg-zinc-50/40 border-b border-zinc-200/80">
              {strategy.steps.map((step) => (
                <div
                  key={step.year}
                  className="rounded-xl bg-white border border-zinc-200/80 px-2.5 py-1.5 flex items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-zinc-200/80 bg-zinc-900">
                      <ResilientImage
                        src={step.crop.imageUrl}
                        alt={step.crop.name}
                        sizes="36px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-zinc-400">
                          Yr {step.year}
                        </span>
                        <span className="text-xs font-bold text-zinc-950 truncate">
                          {lang === "de"
                            ? step.crop.germanSub.split(" ·")[0]
                            : step.crop.name.split(" (")[0]}
                        </span>
                        {step.isCustomCrop && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-semibold uppercase tracking-wide shrink-0">
                            {lang === "de" ? "Eigene" : "Custom"}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {step.suitabilityNote ??
                          step.crop.coverCropIncluded ??
                          step.crop.growingWindow}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono shrink-0">
                    <div className="text-xs font-bold text-zinc-950 tabular-nums">
                      €{step.appliedPriceEurTon}/t
                    </div>
                    <div className="text-[10px] text-zinc-500 tabular-nums">
                      {step.syntheticNAppliedKgHa === 0
                        ? "0 kg N"
                        : `${step.syntheticNAppliedKgHa} kg N`}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tractor Prescription Map + Printable Plan + Collapsible Details */}
            <div className="p-2.5 bg-white space-y-1.5">
              <div className="flex items-center gap-2">
                {onOpenTractorMap && (
                  <button
                    type="button"
                    onClick={() => onOpenTractorMap(strategy)}
                    className={`flex-1 min-h-[36px] rounded-xl px-3 py-1.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors border ${
                      isTopPick
                        ? "bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700"
                        : "bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200"
                    }`}
                  >
                    <Tractor className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {lang === "de" ? "N-Karte (ISOXML)" : "Tractor N-Map"}
                    </span>
                  </button>
                )}

                {onOpenActionPlan && !strategy.isBaseline && (
                  <button
                    type="button"
                    onClick={() => onOpenActionPlan(strategy)}
                    title={
                      lang === "de"
                        ? "Hof- & Förderplan drucken"
                        : "Print Farm & Subsidy Plan"
                    }
                    className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>{lang === "de" ? "Drucken" : "PDF / Print"}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => toggleExplain(strategy.id)}
                aria-expanded={isOpen}
                className="w-full min-h-[32px] flex items-center justify-between text-left text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    {lang === "de"
                      ? "NASA- & Bodendaten"
                      : "NASA & Soil Evidence"}
                  </span>
                </span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="mt-1 pt-2.5 border-t border-zinc-100 space-y-2 text-xs text-zinc-600 leading-relaxed px-1">
                  <p>{strategy.explainability.whySuggested}</p>
                  <ul className="space-y-1 list-disc pl-4">
                    {strategy.explainability.satelliteAndSoilEvidence.map(
                      (ev, i) => (
                        <li key={i}>{ev}</li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
