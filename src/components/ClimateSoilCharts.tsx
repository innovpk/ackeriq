"use client";

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Legend,
} from "recharts";
import type { FarmXrayData, RotationStrategyResult } from "@/types/ackeriq";

interface ClimateSoilChartsProps {
  xray: FarmXrayData;
  strategies: RotationStrategyResult[];
  mode?: "climate" | "comparison" | "both";
}

export function ClimateSoilCharts({
  xray,
  strategies,
  mode = "both",
}: ClimateSoilChartsProps) {
  const climateChartData = xray.monthlyClimate.map((m) => ({
    month: m.month,
    precipMm: m.precipMm,
    tempMaxC: m.tempMaxC,
    rootMoisturePct: Math.round(m.rootMoistureIdx * 100),
  }));

  const comparisonData = strategies.map((s) => ({
    name:
      s.id === "baseline"
        ? "1. Current Crops"
        : s.id === "nitro_slash"
        ? "2. Legume + Price Plan"
        : "3. Drought & Soil Shield",
    netMargin: s.avgAnnualNetMarginEurHa,
    syntheticN: s.avgSyntheticNKgHa,
  }));

  const showClimate = mode === "climate" || mode === "both";
  const showComparison = mode === "comparison" || mode === "both";

  return (
    <div
      className={
        mode === "both"
          ? "flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
          : "flex-1 flex flex-col w-full"
      }
    >
      {showClimate && (
        <div
          className={`${
            mode === "both" ? "lg:col-span-7" : "w-full flex-1"
          } rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.04)] flex flex-col justify-between gap-4`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                12-Month NASA Weather &amp; Soil Moisture
              </span>
              <h3 className="text-sm sm:text-base font-bold tracking-tight text-zinc-900 mt-0.5">
                When Rain Washes Fertilizer Away vs. When Summer Dries Out
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {xray.climateShift && (
                <span
                  title={`NASA POWER summer (Jun–Aug) shift comparing ${xray.climateShift.baselinePeriod} vs. ${xray.climateShift.recentPeriod}`}
                  className="text-xs font-mono px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-semibold"
                >
                  NASA Shift ({xray.climateShift.recentPeriod}):{" "}
                  {xray.climateShift.summerTempDeltaC >= 0 ? "+" : ""}
                  {xray.climateShift.summerTempDeltaC}°C ·{" "}
                  {xray.climateShift.summerMoistureDeltaPct >= 0 ? "+" : ""}
                  {xray.climateShift.summerMoistureDeltaPct}% moisture
                </span>
              )}
              <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-600">
                Jan – Dec Average
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 lg:h-[calc(100dvh-435px)] lg:min-h-[260px] flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={climateChartData}
                margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#52525B" }}
                  axisLine={{ stroke: "#D4D4D8" }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#52525B" }}
                  axisLine={false}
                  unit="mm"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#15803D" }}
                  axisLine={false}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E4E4E7",
                    borderRadius: "10px",
                    color: "#18181B",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: "12px",
                    paddingTop: "8px",
                    color: "#3F3F46",
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="precipMm"
                  name="Monthly Rain (mm)"
                  fill="#93C5FD"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rootMoisturePct"
                  name="Soil Moisture (%)"
                  stroke="#15803D"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#15803D" }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="tempMaxC"
                  name="Peak Daytime Heat (°C)"
                  stroke="#D97706"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Super Easy-to-Read 12-Month Ground Cover Calendar */}
          <div className="pt-4 border-t border-zinc-200/80 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-zinc-800">
                Month-by-Month Ground Check (Without Winter Cover Crops):
              </span>
              <span className="font-mono font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {xray.bareSoilMonthsPerYear} months/yr left bare to rain
              </span>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
              {xray.monthlyClimate.map((m) => {
                const isBare = m.bareSoilBaseline;
                const isHeatOrDrought =
                  m.stressFlag === "heat" || m.stressFlag === "drought";
                return (
                  <div
                    key={m.month}
                    title={`${m.month}: ${
                      isBare
                        ? "Bare soil — rain washes away nutrients"
                        : isHeatOrDrought
                        ? "Hot & dry summer period"
                        : "Soil covered by growing crop"
                    }`}
                    className={`rounded-lg py-1.5 px-1 text-center border ${
                      isBare
                        ? "bg-amber-50 border-amber-300 text-amber-900"
                        : isHeatOrDrought
                        ? "bg-rose-50 border-rose-200 text-rose-900"
                        : "bg-emerald-50 border-emerald-200 text-emerald-900"
                    }`}
                  >
                    <div className="text-xs font-semibold">{m.month}</div>
                    <div className="text-[10px] font-medium mt-0.5">
                      {isBare ? "Bare" : isHeatOrDrought ? "Dry/Hot" : "Covered"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showComparison && (
        <div
          className={`${
            mode === "both" ? "lg:col-span-5" : "w-full flex-1"
          } rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.04)] flex flex-col justify-between gap-4`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Quick Visual Comparison
              </span>
              <h3 className="text-sm sm:text-base font-bold tracking-tight text-zinc-900 mt-0.5">
                Yearly Net Profit (€/ha) vs. Purchased Fertilizer Needed (kg/ha)
              </h3>
            </div>
            <span className="text-xs text-zinc-500">
              Higher green bar + lower amber bar = better
            </span>
          </div>

          <div className="h-64 sm:h-72 lg:h-[calc(100dvh-360px)] lg:min-h-[280px] flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonData}
                margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#27272A", fontWeight: 600 }}
                  axisLine={{ stroke: "#D4D4D8" }}
                />
                <YAxis
                  yAxisId="margin"
                  tick={{ fontSize: 11, fill: "#15803D" }}
                  axisLine={false}
                  unit="€"
                />
                <YAxis
                  yAxisId="nitrogen"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#D97706" }}
                  axisLine={false}
                  unit="kg"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E4E4E7",
                    borderRadius: "10px",
                    color: "#18181B",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: "12px",
                    paddingTop: "8px",
                    color: "#3F3F46",
                  }}
                />
                <Bar
                  yAxisId="margin"
                  dataKey="netMargin"
                  name="Yearly Net Profit (€/ha)"
                  fill="#15803D"
                  radius={[6, 6, 0, 0]}
                  barSize={38}
                />
                <Bar
                  yAxisId="nitrogen"
                  dataKey="syntheticN"
                  name="Purchased Fertilizer (kg N/ha)"
                  fill="#F59E0B"
                  radius={[6, 6, 0, 0]}
                  barSize={38}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
