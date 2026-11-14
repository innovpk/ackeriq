"use client";

import React, { useState } from "react";
import { ResilientImage } from "@/components/ResilientImage";
import { MoveHorizontal } from "lucide-react";

interface SoilVisualCompareProps {
  estimatedNLossPct: number;
  minSummerMoisturePct: number;
}

export function SoilVisualCompare({
  estimatedNLossPct,
  minSummerMoisturePct,
}: SoilVisualCompareProps) {
  const [splitPct, setSplitPct] = useState<number>(50);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* 1. Interactive Before / After Bare Soil vs. Cover Mulch Drag Slider */}
      <div className="lg:col-span-7 rounded-2xl border border-zinc-200/90 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] flex flex-col">
        <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-zinc-900">
            Spring Rain Runoff — Drag to Compare
          </span>
          <span className="text-[11px] text-zinc-400 font-mono">
            Bare vs. Cover Crop
          </span>
        </div>

        <div className="relative h-56 sm:h-64 min-h-[224px] sm:min-h-[256px] lg:h-[calc(100dvh-345px)] lg:min-h-[215px] lg:max-h-[340px] w-full select-none overflow-hidden bg-zinc-900">
          {/* Base Layer (Right Side): Healthy Green Cover Mulch */}
          <ResilientImage
            src="/images/soil-cover-mulch.jpg"
            alt="Stuttgart loess field protected by green Phacelia and clover winter cover crop"
            eager
            sizes="(max-width: 1024px) 100vw, 58vw"
            className="object-cover"
          />

          {/* Clipped Top Layer (Left Side): Bare Eroding Soil */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}
          >
            <ResilientImage
              src="/images/soil-bare-runoff.jpg"
              alt="Bare spring soil losing topsoil and fertilizer in rain"
              eager
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
            />
          </div>

          {/* Floating Corner Pills */}
          <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-rose-950/80 backdrop-blur-xs text-[11px] font-semibold text-white">
            Bare Soil (-{estimatedNLossPct}% N Lost)
          </span>
          <span className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full bg-emerald-900/85 backdrop-blur-xs text-[11px] font-semibold text-white">
            Winter Cover (+42 kg N Kept)
          </span>

          {/* Vertical Divider Line + Handle */}
          <div
            className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.45)] pointer-events-none"
            style={{ left: `${splitPct}%` }}
          >
            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white text-zinc-900 border border-zinc-200 shadow-lg flex items-center justify-center">
              <MoveHorizontal className="w-4 h-4 text-emerald-700" />
            </div>
          </div>

          {/* Accessible Invisible Range Input Covering Full Image */}
          <input
            type="range"
            min={6}
            max={94}
            value={splitPct}
            onChange={(e) => setSplitPct(Number(e.target.value))}
            aria-label="Slide left or right to compare bare soil erosion with cover-crop protection"
            className="absolute inset-0 z-30 w-full h-full opacity-0 cursor-ew-resize m-0"
          />
        </div>
      </div>

      {/* 2. Underground Root Depth & Free Nitrogen Cutaway */}
      <div className="lg:col-span-5 rounded-2xl border border-zinc-200/90 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-zinc-900">
            Underground Root &amp; Nitrogen View
          </span>
          <span className="text-[11px] text-emerald-700 font-semibold">
            0 – 160 cm Depth
          </span>
        </div>

        <div className="relative h-56 sm:h-64 min-h-[224px] sm:min-h-[256px] lg:h-[calc(100dvh-345px)] lg:min-h-[215px] lg:max-h-[340px] w-full bg-zinc-900 overflow-hidden">
          <ResilientImage
            src="/images/soil-root-cutaway.jpg"
            alt="Cross section comparing shallow stressed corn roots with deep soybean and sunflower taproots"
            eager
            sizes="(max-width: 1024px) 100vw, 42vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20 pointer-events-none" />

          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-amber-950/80 backdrop-blur-xs text-[11px] font-semibold text-amber-100">
            40 cm · Dry Topsoil ({minSummerMoisturePct}%)
          </span>

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur-xs text-[11px] font-medium text-white/90">
              Left: Shallow Roots Wilt
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-700/95 backdrop-blur-xs text-[11px] font-semibold text-white">
              Right: 1.6m Taproot + 65 kg N
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
