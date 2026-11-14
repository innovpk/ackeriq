"use client";

import React from "react";
import type {
  AppLanguage,
  RotationStrategyResult,
  SubsidyConfig,
} from "@/types/ackeriq";
import { Award, Check } from "lucide-react";

interface SubsidyStackerBarProps {
  subsidies: SubsidyConfig;
  onChange: (next: SubsidyConfig) => void;
  bestStrategy: RotationStrategyResult;
  farmAreaHa: number;
  lang: AppLanguage;
}

export function SubsidyStackerBar({
  subsidies,
  onChange,
  bestStrategy,
  farmAreaHa,
  lang,
}: SubsidyStackerBarProps) {
  const total4YrSubsidiesEur = Math.round(
    bestStrategy.steps.reduce((sum, s) => sum + s.subsidyBonusEurHa, 0) *
      farmAreaHa
  );

  const items: Array<{
    key: keyof SubsidyConfig;
    code: string;
    rate: string;
    labelEn: string;
    labelDe: string;
  }> = [
    {
      key: "oeko2LegumeRotation",
      code: "EU Öko-Regelung 2",
      rate: "+€60/ha/yr",
      labelEn: "Diverse Crop Rotation (≥10% Legumes)",
      labelDe: "Vielfältige Kulturen (≥10% Leguminosen)",
    },
    {
      key: "faktCoverCrop",
      code: "BW FAKT II E1.2",
      rate: "+€90/ha",
      labelEn: "Winter Cover Crop Mix (Zwischenfrucht)",
      labelDe: "Winter-Begrünungsmischung im Ackerbau",
    },
    {
      key: "faktPulseBonus",
      code: "BW FAKT II B1/E2",
      rate: "+€85/ha",
      labelEn: "Herbicide-Light Legume Cultivation",
      labelDe: "Herbizidfreier Körnerleguminosen-Anbau",
    },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.03)] space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-700" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-800">
            {lang === "de"
              ? "BW FAKT II & EU Förder-Rechner (Zuschaltbar)"
              : "BW FAKT II & EU Eco-Subsidy Stacker"}
          </span>
        </div>

        <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full tabular-nums">
          +€{total4YrSubsidiesEur.toLocaleString()}{" "}
          {lang === "de" ? "(4 Jahre Hof-Prämie)" : "(4-Yr Farm Grants)"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {items.map((item) => {
          const active = subsidies[item.key];
          return (
            <button
              key={item.key}
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() =>
                onChange({ ...subsidies, [item.key]: !subsidies[item.key] })
              }
              className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                active
                  ? "bg-emerald-50/70 border-emerald-600"
                  : "bg-zinc-50/70 border-zinc-200 hover:bg-zinc-100/80"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-950">
                    {item.code}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-emerald-700">
                    {item.rate}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 truncate mt-0.5">
                  {lang === "de" ? item.labelDe : item.labelEn}
                </p>
              </div>

              <span
                className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center border ${
                  active
                    ? "bg-emerald-700 border-emerald-700 text-white"
                    : "bg-white border-zinc-300 text-transparent"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
