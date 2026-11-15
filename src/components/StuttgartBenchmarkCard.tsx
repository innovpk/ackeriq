"use client";

import React from "react";
import type { AppLanguage, RotationStrategyResult } from "@/types/ackeriq";
import { BarChart3, Trophy } from "lucide-react";

interface StuttgartBenchmarkCardProps {
  baseline: RotationStrategyResult;
  bestAdapted: RotationStrategyResult;
  lang: AppLanguage;
}

const STUTTGART_DISTRICT_AVG_N = 158; // kg N/ha/yr (Region Stuttgart arable mean)
const STUTTGART_DISTRICT_AVG_MARGIN = 615; // €/ha/yr

export function StuttgartBenchmarkCard({
  baseline,
  bestAdapted,
  lang,
}: StuttgartBenchmarkCardProps) {
  const nDiffPct = Math.round(
    ((STUTTGART_DISTRICT_AVG_N - bestAdapted.avgSyntheticNKgHa) /
      STUTTGART_DISTRICT_AVG_N) *
      100
  );
  const marginGainVsDistrict = Math.round(
    bestAdapted.avgAnnualNetMarginEurHa - STUTTGART_DISTRICT_AVG_MARGIN
  );

  const maxNBar = Math.max(
    200,
    baseline.avgSyntheticNKgHa,
    STUTTGART_DISTRICT_AVG_N
  );
  const maxMarginBar = Math.max(
    900,
    bestAdapted.avgAnnualNetMarginEurHa,
    STUTTGART_DISTRICT_AVG_MARGIN
  );

  return (
    <div className="h-full rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.03)] flex flex-col justify-between gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold text-zinc-950">
            {lang === "de"
              ? "Regionaler Betriebsvergleich (Landkreis-Benchmark)"
              : "Regional District Benchmark"}
          </h3>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
          <Trophy className="w-3.5 h-3.5 text-emerald-700" />
          {nDiffPct > 0
            ? lang === "de"
              ? `${nDiffPct}% weniger N als Landkreis-Schnitt`
              : `${nDiffPct}% less N than district average`
            : lang === "de"
            ? "Top-Effizienz im Landkreis"
            : "Top Regional Efficiency"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Fertilizer Comparison Bars (Lower = Better) */}
        <div className="space-y-2.5">
          <div className="text-xs font-semibold text-zinc-600">
            {lang === "de"
              ? "Mineraldünger (kg N/ha/Jahr — weniger ist besser)"
              : "Mineral Nitrogen Use (kg N/ha/yr — lower is better)"}
          </div>

          {[
            {
              label: lang === "de" ? "Ihr Ist-Plan" : "Your Current Plan",
              val: baseline.avgSyntheticNKgHa,
              barClass: "bg-amber-400",
            },
            {
              label: lang === "de" ? "Ø Landkreis" : "District Avg",
              val: STUTTGART_DISTRICT_AVG_N,
              barClass: "bg-zinc-400",
            },
            {
              label: lang === "de" ? "AckerIQ Empfehlung" : "AckerIQ Best Plan",
              val: bestAdapted.avgSyntheticNKgHa,
              barClass: "bg-emerald-600",
            },
          ].map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-700">{row.label}</span>
                <span className="font-mono font-bold text-zinc-950 tabular-nums">
                  {row.val} kg N/ha
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.barClass}`}
                  style={{
                    width: `${Math.max(8, Math.round((row.val / maxNBar) * 100))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Net Margin Comparison Bars (Higher = Better) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
            <span>
              {lang === "de"
                ? "Deckungsbeitrag (€/ha/Jahr — höher ist besser)"
                : "Net Farm Margin (€/ha/yr — higher is better)"}
            </span>
            {marginGainVsDistrict > 0 && (
              <span className="font-mono text-emerald-700">
                +€{marginGainVsDistrict}/ha vs. Avg
              </span>
            )}
          </div>

          {[
            {
              label: lang === "de" ? "Ihr Ist-Plan" : "Your Current Plan",
              val: baseline.avgAnnualNetMarginEurHa,
              barClass: "bg-zinc-300",
            },
            {
              label: lang === "de" ? "Ø Landkreis" : "District Avg",
              val: STUTTGART_DISTRICT_AVG_MARGIN,
              barClass: "bg-zinc-400",
            },
            {
              label: lang === "de" ? "AckerIQ Empfehlung" : "AckerIQ Best Plan",
              val: bestAdapted.avgAnnualNetMarginEurHa,
              barClass: "bg-emerald-600",
            },
          ].map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-700">{row.label}</span>
                <span className="font-mono font-bold text-zinc-950 tabular-nums">
                  €{row.val.toLocaleString()}/ha
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.barClass}`}
                  style={{
                    width: `${Math.max(
                      8,
                      Math.round((Math.max(0, row.val) / maxMarginBar) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
