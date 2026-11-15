"use client";

import React, { useEffect, useState } from "react";
import type { AppLanguage, SpreaderForecastResponse } from "@/types/ackeriq";
import {
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  Sun,
  Wind,
  XCircle,
} from "lucide-react";

interface SpreaderWeatherStripProps {
  lat: number;
  lon: number;
  lang: AppLanguage;
}

export function SpreaderWeatherStrip({
  lat,
  lon,
  lang,
}: SpreaderWeatherStripProps) {
  const [forecast, setForecast] = useState<SpreaderForecastResponse | null>(
    null
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/spreader-forecast?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SpreaderForecastResponse | null) => {
        if (data) setForecast(data);
      })
      .catch(() => {
        // Ignore aborted fetch
      });

    return () => controller.abort();
  }, [lat, lon]);

  if (!forecast) return null;

  return (
    <div className="flex-1 rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] flex flex-col justify-between gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-800">
            {lang === "de"
              ? "7-Tage Dünger-Streufenster (Live-Wetter)"
              : "7-Day Nitrogen Spreader Window (Live Forecast)"}
          </span>
          {forecast.liveSource && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              LIVE
            </span>
          )}
        </div>

        <span className="text-xs sm:text-sm font-semibold text-emerald-800">
          {lang === "de" ? forecast.bestWindowDe : forecast.bestWindowEn}
        </span>
      </div>

      <div className="flex-1 min-h-[240px] lg:min-h-[320px] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-stretch">
        {forecast.days.map((day) => {
          const isSafe = day.status === "safe";
          const isAvoid = day.status === "avoid";

          return (
            <div
              key={day.dateIso}
              className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
                isSafe
                  ? "bg-emerald-50/55 border-emerald-200"
                  : isAvoid
                  ? "bg-rose-50/55 border-rose-200"
                  : "bg-amber-50/55 border-amber-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-950">
                  {lang === "de" ? day.dayShortDe : day.dayShortEn}
                </span>
                {isSafe ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                ) : isAvoid ? (
                  <XCircle className="w-4 h-4 text-rose-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
              </div>

              <div className="space-y-2 font-mono text-xs text-zinc-700 tabular-nums">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-amber-600" />
                    {day.tempMaxC}°C
                  </span>
                  <span className="text-zinc-400">{day.tempMinC}°</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <CloudRain className="w-3.5 h-3.5 text-sky-600" />
                    {day.precipMm}mm
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-zinc-500">
                    <Wind className="w-3.5 h-3.5" />
                    {day.windMaxKmh}
                  </span>
                </div>
              </div>

              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg text-center truncate ${
                  isSafe
                    ? "bg-emerald-700 text-white"
                    : isAvoid
                    ? "bg-rose-600 text-white"
                    : "bg-amber-200/80 text-amber-950"
                }`}
              >
                {lang === "de" ? day.reasonDe : day.reasonEn}
              </span>
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          {lang === "de"
            ? "DüV-Streuregel: Kein Streuen bei Starkregen (>8 mm/Tag), Windböen >25 km/h oder gefrorenem/wassergesättigtem Boden."
            : "DüV Spreading Rule: Avoid spreading ahead of >8 mm/day rain, >25 km/h wind gusts, or waterlogged/frozen topsoil."}
        </span>
        <span className="font-mono text-zinc-400">Open-Meteo DWD ICON · 7-Day</span>
      </div>
    </div>
  );
}
