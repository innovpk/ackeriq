"use client";

import React, { useMemo, useState } from "react";
import { ResilientImage } from "@/components/ResilientImage";
import {
  CROPS_STUTTGART,
  getLocalizedCropDisplayName,
} from "@/data/agronomyCatalog";
import {
  QUICK_TEST_CROP_IDS,
  buildOrResolveCustomCrop,
  computeAgroClimateDiagnostics,
  evaluateCropSuitability,
} from "@/lib/cropSuitability";
import type {
  AppLanguage,
  CropSpec,
  CropSuitabilityEvaluation,
  FarmXrayData,
  WeatherScenario,
} from "@/types/ackeriq";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Droplets,
  Flame,
  MapPin,
  Plus,
  Sparkles,
  Sprout,
  Trash2,
  XCircle,
} from "lucide-react";

export interface CustomCropEntry {
  crop: CropSpec;
  includeInPlan: boolean;
}

interface CustomCropSuitabilityPanelProps {
  xray: FarmXrayData;
  weatherScenario: WeatherScenario;
  customEntries: CustomCropEntry[];
  onAddOrUpdateEntry: (entry: CustomCropEntry) => void;
  onToggleInclude: (cropId: string) => void;
  onRemoveEntry: (cropId: string) => void;
  onViewPlans: () => void;
  lang?: AppLanguage;
}

export function CustomCropSuitabilityPanel({
  xray,
  weatherScenario,
  customEntries,
  onAddOrUpdateEntry,
  onToggleInclude,
  onRemoveEntry,
  onViewPlans,
  lang = "en",
}: CustomCropSuitabilityPanelProps) {
  const [cropNameInput, setCropNameInput] = useState("");
  const [family, setFamily] = useState<CropSpec["family"]>("cereal");
  const [waterNeedLevel, setWaterNeedLevel] = useState<
    "low" | "medium" | "high"
  >("low");
  const [heatPreference, setHeatPreference] = useState<
    "cool" | "moderate" | "hot"
  >("hot");
  const [customPriceInput, setCustomPriceInput] = useState<string>("");

  const diag = useMemo(
    () =>
      computeAgroClimateDiagnostics(
        xray.lat,
        xray.lon,
        xray.elevationM,
        xray.monthlyClimate,
        weatherScenario
      ),
    [xray, weatherScenario]
  );

  const evaluatedCustomList: CropSuitabilityEvaluation[] = useMemo(
    () =>
      customEntries.map((entry) =>
        evaluateCropSuitability(entry.crop, xray, weatherScenario, {
          isCustom: true,
          forceInclude: entry.includeInPlan,
        })
      ),
    [customEntries, xray, weatherScenario]
  );

  const regionalCatalogOverview = useMemo(() => {
    const allEvaluated = Object.values(CROPS_STUTTGART)
      .filter((c) => c.id !== "sugar_beet")
      .map((crop) => evaluateCropSuitability(crop, xray, weatherScenario));

    const recommended = allEvaluated
      .filter((e) => e.status === "suitable" && e.grownInRegion)
      .sort((a, b) => b.score - a.score);

    const excludedOrRisky = allEvaluated
      .filter((e) => e.status === "unsuitable" || !e.grownInRegion)
      .sort((a, b) => a.score - b.score);

    return { recommended, excludedOrRisky };
  }, [xray, weatherScenario]);

  const handleQuickAddCropId = (cropId: string) => {
    const spec = CROPS_STUTTGART[cropId];
    if (!spec) return;
    const customCrop: CropSpec = { ...spec, isCustomCrop: true };
    const ev = evaluateCropSuitability(customCrop, xray, weatherScenario, {
      isCustom: true,
    });
    onAddOrUpdateEntry({
      crop: customCrop,
      includeInPlan: ev.status === "suitable",
    });
  };

  const handleSubmitCustomCrop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cropNameInput.trim()) return;

    const parsedPrice = Number(customPriceInput);
    const built = buildOrResolveCustomCrop({
      rawName: cropNameInput,
      family,
      waterNeedLevel,
      heatPreference,
      pricePerTonEur:
        Number.isFinite(parsedPrice) && parsedPrice >= 20
          ? parsedPrice
          : undefined,
      includeWinterCover: true,
    });

    const ev = evaluateCropSuitability(built, xray, weatherScenario, {
      isCustom: true,
    });

    onAddOrUpdateEntry({
      crop: built,
      includeInPlan: ev.status === "suitable",
    });
    setCropNameInput("");
    setCustomPriceInput("");
  };

  const activeIncludedCount = evaluatedCustomList.filter(
    (e) => e.includedInPlan && e.status !== "unsuitable"
  ).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* Left 4 Cols: Add / Test Any Custom Crop */}
      <div className="lg:col-span-4 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] space-y-3.5">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
            <Sparkles className="w-3.5 h-3.5" />
            {lang === "de"
              ? "Eigene Kultur prüfen"
              : "Custom Crop Suitability Check"}
          </span>
          <h2 className="text-base font-bold tracking-tight text-zinc-950 mt-0.5">
            {lang === "de"
              ? "Passt Ihre Wunsch-Kultur auf diesen Hof?"
              : "Test any crop against your soil & weather"}
          </h2>
          <p className="text-xs text-zinc-600 mt-0.5">
            {lang === "de"
              ? "Prüft Bodenfeuchte, Sommerhitze, pH & Hangneigung und baut geeignete Kulturen in den 4-Jahres-Plan ein."
              : "Checks root-zone moisture, peak heat, pH, and regional GDD—and slots suitable crops into your 4-year plan."}
          </p>
        </div>

        {/* 1-Click Quick-Test Chips */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {lang === "de" ? "1-Klick Schnelltest:" : "1-Click Quick Test:"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TEST_CROP_IDS.map((cid) => {
              const spec = CROPS_STUTTGART[cid];
              if (!spec) return null;
              const alreadyAdded = customEntries.some(
                (e) => e.crop.id === cid
              );
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => handleQuickAddCropId(cid)}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer transition-colors inline-flex items-center gap-1 ${
                    alreadyAdded
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                      : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {alreadyAdded ? (
                    <Check className="w-3 h-3 text-emerald-700" />
                  ) : (
                    <Plus className="w-3 h-3 text-zinc-500" />
                  )}
                  <span>{getLocalizedCropDisplayName(spec, xray, lang)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form
          onSubmit={handleSubmitCustomCrop}
          className="pt-2.5 border-t border-zinc-200/80 space-y-2.5"
        >
          <div>
            <label
              htmlFor="custom-crop-name"
              className="block text-[11px] font-semibold text-zinc-700"
            >
              {lang === "de"
                ? "Oder beliebige eigene Kultur eingeben"
                : "Or enter any custom crop name"}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="custom-crop-name"
                type="text"
                value={cropNameInput}
                onChange={(e) => setCropNameInput(e.target.value)}
                placeholder={
                  lang === "de"
                    ? "z.B. Buchweizen, Nutzhanf, Hirse, Durum..."
                    : "e.g. Buckwheat, Hemp, Camelina, Quinoa..."
                }
                className="flex-1 min-h-[38px] rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs sm:text-sm text-zinc-950 placeholder:text-zinc-400"
              />
              <input
                type="number"
                inputMode="numeric"
                min={20}
                max={3000}
                value={customPriceInput}
                onChange={(e) => setCustomPriceInput(e.target.value)}
                aria-label="Optional price per ton in EUR"
                placeholder="€/t"
                className="w-20 min-h-[38px] rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-mono text-zinc-950 placeholder:text-zinc-400"
              />
            </div>
          </div>

          {/* Agronomic Trait Selectors for Unlisted Custom Crops */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label
                htmlFor="custom-crop-family"
                className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                {lang === "de" ? "Typ" : "Family"}
              </label>
              <select
                id="custom-crop-family"
                value={family}
                onChange={(e) =>
                  setFamily(e.target.value as CropSpec["family"])
                }
                className="mt-1 w-full min-h-[34px] rounded-lg border border-zinc-300 bg-zinc-50 px-2 text-xs font-medium text-zinc-900"
              >
                <option value="cereal">Cereal / Grain</option>
                <option value="legume">Legume (+N)</option>
                <option value="oilseed">Oilseed</option>
                <option value="root">Root / Tuber</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="custom-crop-water"
                className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                {lang === "de" ? "Wasserbedarf" : "Water Need"}
              </label>
              <select
                id="custom-crop-water"
                value={waterNeedLevel}
                onChange={(e) =>
                  setWaterNeedLevel(
                    e.target.value as "low" | "medium" | "high"
                  )
                }
                className="mt-1 w-full min-h-[34px] rounded-lg border border-zinc-300 bg-zinc-50 px-2 text-xs font-medium text-zinc-900"
              >
                <option value="low">Low (~315mm)</option>
                <option value="medium">Med (~420mm)</option>
                <option value="high">High (~560mm)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="custom-crop-heat"
                className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                {lang === "de" ? "Hitzetoleranz" : "Heat Fit"}
              </label>
              <select
                id="custom-crop-heat"
                value={heatPreference}
                onChange={(e) =>
                  setHeatPreference(
                    e.target.value as "cool" | "moderate" | "hot"
                  )
                }
                className="mt-1 w-full min-h-[34px] rounded-lg border border-zinc-300 bg-zinc-50 px-2 text-xs font-medium text-zinc-900"
              >
                <option value="hot">Hot (≤38°C)</option>
                <option value="moderate">Mod (≤34°C)</option>
                <option value="cool">Cool (≤30°C)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={!cropNameInput.trim()}
            className="w-full min-h-[40px] rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-zinc-200 disabled:text-zinc-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>
              {lang === "de"
                ? "Eignung prüfen & 4-J.-Plan aktualisieren"
                : "Check Suitability & Update 4-Yr Plan"}
            </span>
          </button>
        </form>
      </div>

      {/* Right 8 Cols: Live Telemetry Strip + Custom Verdicts + Regional Matrix */}
      <div className="lg:col-span-8 space-y-3.5">
        {/* Live Farm Biophysical Conditions Strip */}
        <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/80 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-white border border-zinc-200/80 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-700" />
              <span>Agro-Zone</span>
            </div>
            <div className="text-xs font-bold text-zinc-950 truncate mt-0.5">
              {diag.agroZoneLabel}
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              {Math.round(xray.elevationM)}m · {diag.gdd10} GDD₁₀
            </div>
          </div>

          <div className="rounded-xl bg-white border border-zinc-200/80 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
              <Droplets className="w-3 h-3 text-sky-600" />
              <span>Soil Moisture</span>
            </div>
            <div className="text-xs font-bold text-zinc-950 tabular-nums mt-0.5">
              {diag.effectiveMinSummerMoisturePct}% Jul Root Moisture
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              {xray.soil.waterHoldingMm}mm cap · {diag.growingPrecipMm}mm rain
            </div>
          </div>

          <div className="rounded-xl bg-white border border-zinc-200/80 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-600" />
              <span>Heat Weather</span>
            </div>
            <div className="text-xs font-bold text-zinc-950 tabular-nums mt-0.5">
              {diag.effectiveMaxTempC}°C Peak Summer
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              {weatherScenario === "drought_heat"
                ? "37°C Drought Stress Active"
                : "Normal Multi-Yr Baseline"}
            </div>
          </div>

          <div className="rounded-xl bg-white border border-zinc-200/80 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
              <Sprout className="w-3 h-3 text-emerald-700" />
              <span>Soil & Slope</span>
            </div>
            <div className="text-xs font-bold text-zinc-950 truncate mt-0.5">
              pH {xray.soil.ph} · {xray.soil.textureClass}
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              {xray.slopePct.toFixed(1)}% SRTM slope
            </div>
          </div>
        </div>

        {/* Evaluated User Custom Crops */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-950">
                {lang === "de"
                  ? `Geprüfte Wunsch-Kulturen (${evaluatedCustomList.length})`
                  : `Your Tested Custom Crops (${evaluatedCustomList.length})`}
              </h3>
              <p className="text-xs text-zinc-500">
                {activeIncludedCount > 0
                  ? `${activeIncludedCount} suitable custom crop${
                      activeIncludedCount > 1 ? "s" : ""
                    } actively integrated into your 4-year rotation plan.`
                  : "Click any quick-test crop on the left or enter your own crop to evaluate suitability."}
              </p>
            </div>

            {evaluatedCustomList.length > 0 && (
              <button
                type="button"
                onClick={onViewPlans}
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <span>
                  {lang === "de"
                    ? "Aktualisierten 4-J.-Plan ansehen"
                    : "View 4-Year Plan"}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {evaluatedCustomList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-5 text-center text-xs text-zinc-500">
              {lang === "de"
                ? "Noch keine eigene Kultur ausgewählt. Klicken Sie links z.B. auf Körnerhirse, Kichererbse, Speiselinse oder Nassreis, um die Live-Bodenfeuchte- & Hitze-Prüfung zu sehen."
                : "No custom crops tested yet. Pick Grain Sorghum, Chickpeas, Food Lentils, Sweet Lupins, or Paddy Rice on the left to test how our engine approves or blocks crops for this farm."}
            </div>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {evaluatedCustomList.map((ev) => {
                const isSuitable = ev.status === "suitable";
                const isConditional = ev.status === "conditional";
                return (
                  <div
                    key={ev.crop.id}
                    className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSuitable
                        ? "bg-emerald-50/40 border-emerald-200"
                        : isConditional
                        ? "bg-amber-50/40 border-amber-200"
                        : "bg-rose-50/40 border-rose-200"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-zinc-200 bg-zinc-900 mt-0.5">
                        <ResilientImage
                          src={ev.crop.imageUrl}
                          alt={ev.crop.name}
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold text-zinc-950">
                            {getLocalizedCropDisplayName(ev.crop, xray, lang)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isSuitable
                                ? "bg-emerald-100 text-emerald-900"
                                : isConditional
                                ? "bg-amber-100 text-amber-900"
                                : "bg-rose-100 text-rose-900"
                            }`}
                          >
                            {isSuitable ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : isConditional ? (
                              <AlertTriangle className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            {isSuitable
                              ? `Suitable (${ev.score}/100)`
                              : isConditional
                              ? `Conditional (${ev.score}/100)`
                              : `Not Suitable (${ev.score}/100)`}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-600">
                            €{ev.crop.pricePerTonEur}/t · {ev.crop.waterNeedMm}mm
                          </span>
                        </div>

                        <p className="text-xs font-medium text-zinc-800">
                          {ev.summaryReason}
                        </p>

                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-600">
                          <span>{ev.moistureVerdict}</span>
                          <span>·</span>
                          <span>{ev.heatVerdict}</span>
                          <span>·</span>
                          <span>{ev.soilSlopeVerdict}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {ev.status !== "unsuitable" ? (
                        <button
                          type="button"
                          onClick={() => onToggleInclude(ev.crop.id)}
                          className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                            ev.includedInPlan
                              ? "bg-emerald-700 border-emerald-700 text-white"
                              : "bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {ev.includedInPlan && <Check className="w-3.5 h-3.5" />}
                          <span>
                            {ev.includedInPlan ? "In 4-Yr Plan" : "Add to Plan"}
                          </span>
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-100/80 text-[11px] font-semibold text-rose-800">
                          Blocked from Plan
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => onRemoveEntry(ev.crop.id)}
                        aria-label={`Remove ${ev.crop.name}`}
                        className="min-h-[34px] min-w-[34px] rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 inline-flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Regional Cultivation & Moisture/Heat Verification Summary */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>
                Grown & Climate-Verified Here (
                {regionalCatalogOverview.recommended.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {regionalCatalogOverview.recommended.slice(0, 10).map((ev) => (
                <span
                  key={ev.crop.id}
                  title={`${ev.moistureVerdict} | ${ev.heatVerdict}`}
                  className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/80 text-[11px] font-medium text-emerald-950"
                >
                  {getLocalizedCropDisplayName(ev.crop, xray, lang)}{" "}
                  <span className="font-mono text-[10px] text-emerald-700">
                    {ev.crop.waterNeedMm}mm
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>
                Filtered Out for Moisture / Heat / Zone (
                {regionalCatalogOverview.excludedOrRisky.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {regionalCatalogOverview.excludedOrRisky.slice(0, 7).map((ev) => (
                <span
                  key={ev.crop.id}
                  title={ev.summaryReason}
                  className="px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-[11px] text-zinc-600"
                >
                  {getLocalizedCropDisplayName(ev.crop, xray, lang)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
