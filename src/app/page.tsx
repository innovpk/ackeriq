"use client";

import React, { useCallback, useMemo, useState } from "react";
import { ResilientImage } from "@/components/ResilientImage";
import {
  CROPS_STUTTGART,
  STUTTGART_FARMS,
  buildDefaultAreaPriceFeed,
  getAllBaselineCatalogGroups,
  getLocalizedCropDisplayName,
} from "@/data/agronomyCatalog";
import {
  DEFAULT_SUBSIDIES,
  diagnoseHistoricalRotation,
  generateRotationStrategies,
} from "@/lib/rotationEngine";
import { buildOrResolveCustomCrop } from "@/lib/cropSuitability";
import { getCopy } from "@/lib/i18n";
import type {
  AppLanguage,
  AreaPriceFeedResponse,
  CropSpec,
  FarmXrayData,
  PrimaryGoalId,
  RotationStrategyResult,
  SubsidyConfig,
  WeatherScenario,
} from "@/types/ackeriq";
import { InteractiveFarmMap } from "@/components/InteractiveFarmMap";
import { ClimateSoilCharts } from "@/components/ClimateSoilCharts";
import { RotationStrategyCards } from "@/components/RotationStrategyCards";
import { FarmAddressSearch } from "@/components/FarmAddressSearch";
import { SoilVisualCompare } from "@/components/SoilVisualCompare";
import { TractorPrescriptionModal } from "@/components/TractorPrescriptionModal";
import { SpreaderWeatherStrip } from "@/components/SpreaderWeatherStrip";
import { SubsidyStackerBar } from "@/components/SubsidyStackerBar";
import { StuttgartBenchmarkCard } from "@/components/StuttgartBenchmarkCard";
import { FarmActionPlanModal } from "@/components/FarmActionPlanModal";
import { OwnerFarmSatelliteView } from "@/components/OwnerFarmSatelliteView";
import {
  CustomCropSuitabilityPanel,
  type CustomCropEntry,
} from "@/components/CustomCropSuitabilityPanel";
import { buildFarmAerialUrl } from "@/lib/farmAerialUrl";
import {
  FarmerLoginScreen,
  type DemoSessionUser,
} from "@/components/FarmerLoginScreen";
import { OrbitalSplashScreen } from "@/components/OrbitalSplashScreen";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Check,
  CheckCircle2,
  CloudRain,
  CloudSun,
  Coins,
  Droplets,
  Flame,
  Leaf,
  LogIn,
  LogOut,
  RotateCcw,
  Satellite,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  UserCheck,
  Plus,
  X,
} from "lucide-react";

type WizardStep = 1 | 2 | 3 | 4;
type Step3ViewTab = "satellite" | "visuals" | "spreader" | "climate";
type Step4ViewTab =
  | "plans"
  | "custom_crops"
  | "subsidies_prices"
  | "benchmark";

const GOAL_ICONS: Record<
  PrimaryGoalId,
  React.ComponentType<{ className?: string }>
> = {
  cut_fertilizer: Leaf,
  max_profit: Coins,
  drought_safe: Droplets,
  protect_soil: ShieldCheck,
};

const GOAL_ORDER: PrimaryGoalId[] = [
  "cut_fertilizer",
  "max_profit",
  "drought_safe",
  "protect_soil",
];

export default function AckerIQPage() {
  const [lang, setLang] = useState<AppLanguage>("en");
  const t = getCopy(lang);

  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [showLogin, setShowLogin] = useState<boolean>(false);
  const [sessionUser, setSessionUser] = useState<DemoSessionUser | null>(null);
  const [step, setStep] = useState<WizardStep>(1);

  const [xray, setXray] = useState<FarmXrayData>(STUTTGART_FARMS[0].xray);
  const [priceFeed, setPriceFeed] = useState<AreaPriceFeedResponse>(() =>
    buildDefaultAreaPriceFeed(STUTTGART_FARMS[0].id)
  );
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [customFertPrice, setCustomFertPrice] = useState<number | undefined>(
    undefined
  );
  const [subsidies, setSubsidies] = useState<SubsidyConfig>(DEFAULT_SUBSIDIES);
  const [customCropEntries, setCustomCropEntries] = useState<CustomCropEntry[]>(
    []
  );
  const [historicalCustomCrops, setHistoricalCustomCrops] = useState<
    Record<string, CropSpec>
  >({});
  const [customYearEditorIdx, setCustomYearEditorIdx] = useState<number | null>(
    null
  );
  const [customYearName, setCustomYearName] = useState<string>("");
  const [step3Tab, setStep3Tab] = useState<Step3ViewTab>("satellite");
  const [step4Tab, setStep4Tab] = useState<Step4ViewTab>("plans");

  const [tractorModalStrategy, setTractorModalStrategy] =
    useState<RotationStrategyResult | null>(null);
  const [actionPlanStrategy, setActionPlanStrategy] =
    useState<RotationStrategyResult | null>(null);
  const [customFieldPolygon, setCustomFieldPolygon] = useState<
    [number, number][] | null
  >(null);

  const [farmAreaHa, setFarmAreaHa] = useState<number>(
    STUTTGART_FARMS[0].xray.defaultAreaHa
  );
  const [currentCropIds, setCurrentCropIds] = useState<
    [string, string, string, string]
  >(STUTTGART_FARMS[0].xray.defaultCurrentCropIds);
  const [isNitrateRestricted, setIsNitrateRestricted] = useState<boolean>(
    STUTTGART_FARMS[0].xray.isNitrateRestricted
  );

  const [primaryGoal, setPrimaryGoal] =
    useState<PrimaryGoalId>("cut_fertilizer");
  const [weatherScenario, setWeatherScenario] =
    useState<WeatherScenario>("normal");
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const loadFarmAndPrices = useCallback(
    async (params: {
      presetId?: string;
      lat?: number;
      lon?: number;
      addressLabel?: string;
      fullAddress?: string;
    }) => {
      if (params.presetId) {
        const found = STUTTGART_FARMS.find((p) => p.id === params.presetId);
        if (found) {
          setCustomFieldPolygon(null);
          setXray(found.xray);
          setPriceFeed(buildDefaultAreaPriceFeed(found.id));
          setCustomPrices({});
          setFarmAreaHa(found.xray.defaultAreaHa);
          setCurrentCropIds(found.xray.defaultCurrentCropIds);
          setIsNitrateRestricted(found.xray.isNitrateRestricted);
        }
      }

      setIsScanning(true);
      try {
        const qsXray = new URLSearchParams();
        const qsPrices = new URLSearchParams();

        if (params.presetId) {
          qsXray.set("presetId", params.presetId);
          qsPrices.set("areaId", params.presetId);
        }
        if (typeof params.lat === "number") {
          qsXray.set("lat", params.lat.toFixed(5));
          qsPrices.set("lat", params.lat.toFixed(5));
        }
        if (typeof params.lon === "number") {
          qsXray.set("lon", params.lon.toFixed(5));
          qsPrices.set("lon", params.lon.toFixed(5));
        }
        if (params.addressLabel) {
          qsXray.set("addressLabel", params.addressLabel);
        }
        if (params.fullAddress) {
          qsXray.set("fullAddress", params.fullAddress);
        }

        const [resXray, resPrices] = await Promise.all([
          fetch(`/api/farm-xray?${qsXray.toString()}`),
          fetch(`/api/crop-prices?${qsPrices.toString()}`),
        ]);

        if (resXray.ok) {
          const liveData = (await resXray.json()) as FarmXrayData;
          setXray(liveData);
          if (!params.presetId) {
            setFarmAreaHa(liveData.defaultAreaHa);
            setCurrentCropIds(liveData.defaultCurrentCropIds);
            setIsNitrateRestricted(liveData.isNitrateRestricted);
          }
        }

        if (resPrices.ok) {
          const livePrices = (await resPrices.json()) as AreaPriceFeedResponse;
          setPriceFeed(livePrices);
          setCustomPrices({});
        }
      } catch {
        // Regional fallback already set
      } finally {
        setIsScanning(false);
      }
    },
    []
  );

  const handleCompleteLogin = useCallback(
    (user: DemoSessionUser) => {
      setSessionUser(user);
      setShowLogin(false);
      setShowLanding(false);
      setStep(1);
      loadFarmAndPrices({ presetId: user.defaultPresetId });
    },
    [loadFarmAndPrices]
  );

  const handleSelectAddress = useCallback(
    (item: {
      lat: number;
      lon: number;
      shortTitle: string;
      fullAddress: string;
    }) => {
      loadFarmAndPrices({
        lat: item.lat,
        lon: item.lon,
        addressLabel: item.shortTitle,
        fullAddress: item.fullAddress,
      });
    },
    [loadFarmAndPrices]
  );

  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      loadFarmAndPrices({ lat, lon });
    },
    [loadFarmAndPrices]
  );

  const goToStep = (next: WizardStep) => {
    setStep(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const activeCustomCropsForPlan = useMemo(
    () =>
      customCropEntries
        .filter((e) => e.includeInPlan)
        .map((e) => e.crop),
    [customCropEntries]
  );

  const handleAddOrUpdateCustomCrop = useCallback((entry: CustomCropEntry) => {
    setCustomCropEntries((prev) => {
      const idx = prev.findIndex((p) => p.crop.id === entry.crop.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [entry, ...prev];
    });
  }, []);

  const handleToggleCustomCropInclude = useCallback((cropId: string) => {
    setCustomCropEntries((prev) =>
      prev.map((p) =>
        p.crop.id === cropId ? { ...p, includeInPlan: !p.includeInPlan } : p
      )
    );
  }, []);

  const handleRemoveCustomCrop = useCallback((cropId: string) => {
    setCustomCropEntries((prev) => prev.filter((p) => p.crop.id !== cropId));
  }, []);

  const historicalCustomCropList = useMemo(
    () => Object.values(historicalCustomCrops),
    [historicalCustomCrops]
  );

  const allKnownBaselineLookup = useMemo(() => {
    const map: Record<string, CropSpec> = {
      ...CROPS_STUTTGART,
      ...historicalCustomCrops,
    };
    for (const entry of customCropEntries) {
      map[entry.crop.id] = entry.crop;
    }
    return map;
  }, [historicalCustomCrops, customCropEntries]);

  const strategies = useMemo(
    () =>
      generateRotationStrategies(
        xray,
        farmAreaHa,
        currentCropIds,
        isNitrateRestricted,
        primaryGoal,
        weatherScenario,
        priceFeed,
        customPrices,
        customFertPrice,
        subsidies,
        activeCustomCropsForPlan,
        historicalCustomCropList
      ),
    [
      xray,
      farmAreaHa,
      currentCropIds,
      isNitrateRestricted,
      primaryGoal,
      weatherScenario,
      priceFeed,
      customPrices,
      customFertPrice,
      subsidies,
      activeCustomCropsForPlan,
      historicalCustomCropList,
    ]
  );

  const baselineStrategy = strategies[0];
  const bestAdapted = useMemo(
    () =>
      [...strategies]
        .filter((s) => !s.isBaseline)
        .sort((a, b) => b.goalMatchScore - a.goalMatchScore)[0],
    [strategies]
  );

  const baseline4YrFertCostEur = useMemo(
    () =>
      Math.round(
        baselineStrategy.steps.reduce((acc, s) => acc + s.fertCostEurHa, 0) *
          farmAreaHa
      ),
    [baselineStrategy, farmAreaHa]
  );

  const maxSummerTemp = useMemo(
    () =>
      Math.max(...xray.monthlyClimate.map((m) => m.tempMaxC)).toFixed(1),
    [xray]
  );
  const minSummerMoisturePct = useMemo(
    () =>
      Math.round(
        Math.min(...xray.monthlyClimate.map((m) => m.rootMoistureIdx)) * 100
      ),
    [xray]
  );

  const activeFertPrice = customFertPrice ?? priceFeed.fertPriceEurKgN;
  const hasCustomPriceEdits =
    Object.keys(customPrices).length > 0 || customFertPrice !== undefined;

  const baselineCatalogGroups = useMemo(
    () => getAllBaselineCatalogGroups(xray),
    [xray]
  );

  const historyDiagnosis = useMemo(() => {
    const crops = currentCropIds.map(
      (cid) => allKnownBaselineLookup[cid] ?? CROPS_STUTTGART.winter_wheat
    );
    return diagnoseHistoricalRotation(crops, lang);
  }, [currentCropIds, allKnownBaselineLookup, lang]);

  const handleAssignCustomHistoryCrop = useCallback(
    (yearIdx: 0 | 1 | 2 | 3) => {
      const trimmed = customYearName.trim();
      if (!trimmed) return;
      const spec = buildOrResolveCustomCrop({
        rawName: trimmed,
        family: "cereal",
        waterNeedLevel: "medium",
        heatPreference: "moderate",
        includeWinterCover: false,
      });
      if (!CROPS_STUTTGART[spec.id]) {
        setHistoricalCustomCrops((prev) => ({ ...prev, [spec.id]: spec }));
      }
      setCurrentCropIds((prev) => {
        const next: [string, string, string, string] = [...prev];
        next[yearIdx] = spec.id;
        return next;
      });
      setCustomYearName("");
      setCustomYearEditorIdx(null);
    },
    [customYearName]
  );

  const areaPriceCropIds = useMemo(() => {
    const farmerHasBeet = currentCropIds.includes("sugar_beet");
    return xray.producedCropIds.filter((cid) => {
      if (!CROPS_STUTTGART[cid]) return false;
      if (cid === "sugar_beet") return false;
      if (cid === "sugar_beet_cover" && !farmerHasBeet) return false;
      return true;
    });
  }, [xray.producedCropIds, currentCropIds]);

  if (showLogin) {
    return (
      <FarmerLoginScreen
        lang={lang}
        onChangeLang={setLang}
        onBackToWelcome={() => {
          setShowLogin(false);
        }}
        onCompleteLogin={handleCompleteLogin}
      />
    );
  }

  if (showLanding) {
    return (
      <OrbitalSplashScreen
        lang={lang}
        onChangeLang={setLang}
        onStartOnboarding={(presetId) => {
          setShowLanding(false);
          setStep(1);
          loadFarmAndPrices({ presetId });
        }}
        onStartCustomAddress={(item) => {
          setShowLanding(false);
          setStep(1);
          handleSelectAddress(item);
        }}
        onOpenLogin={() => {
          setShowLogin(true);
        }}
      />
    );
  }

  const wizardSteps: Array<{ step: WizardStep; label: string }> = [
    { step: 1, label: t.stepLabels[0] },
    { step: 2, label: t.stepLabels[1] },
    { step: 3, label: t.stepLabels[2] },
    { step: 4, label: t.stepLabels[3] },
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-white text-zinc-950 overflow-x-hidden">
      {/* Crisp Pure-White Header with Interactive 4-Step Progress Bar & EN|DE Switcher */}
      <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-zinc-200/80">
        <div className="w-full max-w-[1680px] mx-auto px-3.5 sm:px-6 lg:px-10 min-h-13 py-1.5 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (!sessionUser && step === 1) {
                setShowLanding(true);
              } else {
                goToStep(1);
              }
            }}
            className="flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-700 group-hover:bg-emerald-800 transition-colors flex items-center justify-center text-white shadow-xs">
              <Sprout className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-zinc-950">
              AckerIQ
            </span>
          </button>

          <nav
            aria-label="Onboarding steps"
            className="flex items-center gap-1 sm:gap-2 overflow-x-auto"
          >
            {wizardSteps.map((item, idx) => {
              const isCurrent = step === item.step;
              const isCompleted = step > item.step;
              return (
                <React.Fragment key={item.step}>
                  <button
                    type="button"
                    onClick={() => goToStep(item.step)}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`min-h-[38px] px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap border ${
                      isCurrent
                        ? "bg-emerald-700 border-emerald-700 text-white shadow-2xs"
                        : isCompleted
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70"
                        : "bg-zinc-50 border-zinc-200/90 text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full text-[11px] font-mono inline-flex items-center justify-center ${
                        isCurrent
                          ? "bg-white/20 text-white"
                          : isCompleted
                          ? "bg-emerald-700 text-white"
                          : "bg-white text-zinc-600 border border-zinc-300"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        item.step
                      )}
                    </span>
                    <span className="hidden lg:inline">{item.label}</span>
                  </button>
                  {idx < wizardSteps.length - 1 && (
                    <span className="w-3 sm:w-4 h-[1.5px] bg-zinc-200 hidden sm:inline-block" />
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Language selector"
              className="inline-flex items-center rounded-xl border border-zinc-200 bg-zinc-50 p-0.5"
            >
              {(["en", "de"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`min-h-[32px] px-2.5 rounded-lg text-xs font-bold uppercase cursor-pointer transition-colors ${
                    lang === code
                      ? "bg-white text-emerald-800 shadow-2xs"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>

            {sessionUser ? (
              <div className="flex items-center gap-1.5">
                <span
                  title={`${sessionUser.roleLabel} · ${sessionUser.planBadge}`}
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{sessionUser.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSessionUser(null);
                    setStep(1);
                    setShowLanding(true);
                  }}
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-950 bg-white hover:bg-zinc-50 border border-zinc-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="hidden sm:inline">{t.logoutBtn}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-800 hover:bg-zinc-50 bg-white border border-zinc-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-700" />
                <span>{t.loginBtn}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1680px] mx-auto px-3.5 sm:px-6 lg:px-10 py-2.5 sm:py-3.5 flex-1 flex flex-col justify-center">
        {/* =========================================================
            STEP 1: LOCATE YOUR FARM & DRAW FIELD OR ENTER HECTARES
           ========================================================= */}
        {step === 1 && (
          <section
            aria-label="Step 1: Locate your farm"
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {t.step1Tag}
                </span>
                <h1 className="text-xl sm:text-2xl xl:text-3xl font-bold tracking-tight text-zinc-950 leading-tight">
                  {t.step1Title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                >
                  <span>{t.nextCurrentCrops}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-4 flex flex-col justify-between gap-3">
                <div className="bg-white rounded-2xl border border-zinc-200/90 p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] space-y-3">
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                      {t.enterAddressLabel}
                    </div>
                    <FarmAddressSearch
                      onSelectAddress={handleSelectAddress}
                      placeholder={t.addressPlaceholder}
                    />
                  </div>

                  {/* Active Selected Address Banner with Live Real Satellite Thumbnail */}
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 px-3 py-2.5 flex items-center justify-between gap-2.5">
                    <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-emerald-300/80 bg-zinc-900">
                      <ResilientImage
                        src={buildFarmAerialUrl({
                          lat: xray.lat,
                          lon: xray.lon,
                          farmAreaHa,
                          mode: "thumb",
                        })}
                        alt={`Live satellite view of ${xray.name}`}
                        eager
                        sizes="44px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                        {t.selectedLocationLabel}
                      </div>
                      <div className="text-sm font-bold text-zinc-950 truncate">
                        {xray.name}
                      </div>
                      <div className="text-xs text-zinc-600 truncate">
                        {xray.regionLabel} ·{" "}
                        <span className="font-mono tabular-nums">
                          {xray.lat.toFixed(4)}°N, {xray.lon.toFixed(4)}°E
                        </span>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  </div>

                  <div className="pt-2.5 border-t border-zinc-200/80 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      {t.sampleFarmLabel}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {STUTTGART_FARMS.map((preset) => {
                        const active = xray.id === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              loadFarmAndPrices({ presetId: preset.id })
                            }
                            className={`text-left p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                              active
                                ? "bg-emerald-50/60 border-emerald-700 ring-1 ring-emerald-700/20"
                                : "bg-white border-zinc-200/90 hover:bg-zinc-50/80"
                            }`}
                          >
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-zinc-200/80 bg-zinc-900">
                              <ResilientImage
                                src={preset.xray.heroImageUrl}
                                alt={preset.shortLabel}
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-zinc-950 truncate">
                                {preset.shortLabel.split(" (")[0]}
                              </div>
                              <p className="text-[11px] text-zinc-500 truncate">
                                {preset.xray.defaultAreaHa} ha
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-zinc-200/90 p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] space-y-2.5">
                  <label
                    htmlFor="farm-hectares-input"
                    className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
                  >
                    {t.farmSizeLabel}
                  </label>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        id="farm-hectares-input"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={5000}
                        step={5}
                        value={farmAreaHa}
                        onChange={(e) =>
                          setFarmAreaHa(
                            Math.max(1, Number(e.target.value) || 50)
                          )
                        }
                        className="w-24 min-h-[40px] rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-base font-bold tabular-nums text-zinc-950"
                      />
                      <span className="text-xs font-semibold text-zinc-600">
                        ha
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[50, 120, 165, 250].map((ha) => (
                        <button
                          key={ha}
                          type="button"
                          onClick={() => setFarmAreaHa(ha)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                            farmAreaHa === ha
                              ? "bg-emerald-700 border-emerald-700 text-white"
                              : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                          }`}
                        >
                          {ha} ha
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 flex flex-col">
                <InteractiveFarmMap
                  xray={xray}
                  farmAreaHa={farmAreaHa}
                  isScanning={isScanning}
                  lang={lang}
                  onMapClickCoordinate={handleMapClick}
                  onDrawnAreaChange={(ha) => setFarmAreaHa(ha)}
                  onCustomBoundaryChange={setCustomFieldPolygon}
                />
              </div>
            </div>
          </section>
        )}

        {/* =========================================================
            STEP 2: CONFIRM YOUR CURRENT CROPS & NITRATE RULE
           ========================================================= */}
        {step === 2 && (
          <section
            aria-label="Step 2: Confirm your current crops"
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {t.step2Tag}
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 leading-tight">
                  {t.step2Title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs sm:text-sm font-semibold text-zinc-700 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t.backLocation}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep4Tab("custom_crops");
                    goToStep(4);
                  }}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-xs sm:text-sm font-semibold text-emerald-900 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    {lang === "de" ? "Eigene Kultur prüfen" : "Test Custom Crop"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                >
                  <span>{t.nextScan}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {([0, 1, 2, 3] as const).map((yearIdx) => {
                const selectedCropId = currentCropIds[yearIdx];
                const selectedCrop =
                  allKnownBaselineLookup[selectedCropId] ??
                  CROPS_STUTTGART.winter_wheat;
                const localPrice =
                  priceFeed.quotes[selectedCrop.id]
                    ?.effectiveLocalPriceEurTon ?? selectedCrop.pricePerTonEur;

                const baseQuick = baselineCatalogGroups.quickOptions;
                const isSelectedInQuick = baseQuick.some(
                  (q) => q.id === selectedCrop.id
                );
                const visibleQuickOptions = isSelectedInQuick
                  ? baseQuick
                  : [...baseQuick.slice(0, 3), selectedCrop];

                const customPoolForDropdown = [
                  ...historicalCustomCropList,
                  ...customCropEntries
                    .map((e) => e.crop)
                    .filter((c) => !historicalCustomCrops[c.id] && !CROPS_STUTTGART[c.id]),
                ];
                const histCalendarYr = 2023 + yearIdx;

                return (
                  <div
                    key={yearIdx}
                    className="bg-white rounded-2xl border border-zinc-200/90 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] flex flex-col justify-between"
                  >
                    <div className="relative h-24 xl:h-28 w-full bg-zinc-900 overflow-hidden">
                      <ResilientImage
                        src={selectedCrop.imageUrl}
                        alt={selectedCrop.name}
                        eager
                        sizes="(max-width: 640px) 100vw, 25vw"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />
                      <span className="absolute top-2 left-2.5 text-xs font-mono font-semibold text-zinc-900 bg-white/95 backdrop-blur-xs px-2.5 py-0.5 rounded-full shadow-2xs">
                        {lang === "de"
                          ? `Jahr ${yearIdx + 1} · ${histCalendarYr}`
                          : `Yr ${yearIdx + 1} · ${histCalendarYr}`}
                      </span>
                      <span className="absolute top-2 right-2.5 text-[11px] font-mono font-bold text-white bg-black/65 backdrop-blur-xs px-2.5 py-0.5 rounded-full tabular-nums">
                        €{localPrice}/t
                      </span>
                      <div className="absolute bottom-2 left-3 right-3 text-white">
                        <div className="text-sm font-bold leading-tight truncate">
                          {getLocalizedCropDisplayName(selectedCrop, xray, lang)}
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div
                          className="space-y-1"
                          role="group"
                          aria-label={`Select crop for Year ${yearIdx + 1}`}
                        >
                          {visibleQuickOptions.map((option) => {
                            const isPicked = option.id === selectedCropId;
                            const optPrice =
                              priceFeed.quotes[option.id]
                                ?.effectiveLocalPriceEurTon ??
                              option.pricePerTonEur;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                  const next: [string, string, string, string] = [
                                    ...currentCropIds,
                                  ];
                                  next[yearIdx] = option.id;
                                  setCurrentCropIds(next);
                                }}
                                className={`w-full min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium text-left flex items-center justify-between transition-colors cursor-pointer border ${
                                  isPicked
                                    ? "bg-emerald-700 border-emerald-700 text-white font-semibold"
                                    : "bg-zinc-50/80 border-zinc-200/80 text-zinc-700 hover:bg-zinc-100"
                                }`}
                              >
                                <span className="truncate pr-1">
                                  {getLocalizedCropDisplayName(
                                    option,
                                    xray,
                                    lang
                                  )}
                                </span>
                                <span
                                  className={`font-mono text-[11px] shrink-0 tabular-nums ${
                                    isPicked
                                      ? "text-emerald-100"
                                      : "text-zinc-500"
                                  }`}
                                >
                                  €{optPrice}/t · {option.nDemandKgHa}N
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Full 22+ Arable Crop Picker + Inline Custom Crop Entry */}
                        {customYearEditorIdx === yearIdx ? (
                          <div className="flex items-center gap-1 pt-0.5">
                            <input
                              type="text"
                              value={customYearName}
                              onChange={(e) =>
                                setCustomYearName(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAssignCustomHistoryCrop(yearIdx);
                                }
                                if (e.key === "Escape") {
                                  setCustomYearEditorIdx(null);
                                }
                              }}
                              placeholder={
                                lang === "de"
                                  ? "z.B. Hafer, Kraut, Klee..."
                                  : "e.g. Oats, Cabbage, Clover..."
                              }
                              aria-label={`Custom crop name for Year ${yearIdx + 1}`}
                              autoFocus
                              className="min-w-0 flex-1 min-h-[34px] px-2.5 py-1 rounded-lg border border-emerald-600 bg-white text-xs text-zinc-950 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleAssignCustomHistoryCrop(yearIdx)
                              }
                              aria-label="Confirm custom crop"
                              className="min-h-[34px] px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomYearEditorIdx(null);
                                setCustomYearName("");
                              }}
                              aria-label="Cancel custom crop"
                              className="min-h-[34px] px-2 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <select
                              aria-label={`All crops for Year ${yearIdx + 1}`}
                              value={selectedCropId}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "__custom__") {
                                  setCustomYearName("");
                                  setCustomYearEditorIdx(yearIdx);
                                  return;
                                }
                                const next: [string, string, string, string] = [
                                  ...currentCropIds,
                                ];
                                next[yearIdx] = val;
                                setCurrentCropIds(next);
                              }}
                              className="min-w-0 flex-1 min-h-[34px] px-2 py-1 rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 text-xs font-medium text-zinc-700 cursor-pointer focus:outline-none focus:border-emerald-700"
                            >
                              <optgroup
                                label={
                                  lang === "de"
                                    ? "Regional üblich"
                                    : "Regional Crops"
                                }
                              >
                                {baselineCatalogGroups.regionalOptions.map(
                                  (c) => (
                                    <option key={c.id} value={c.id}>
                                      {getLocalizedCropDisplayName(
                                        c,
                                        xray,
                                        lang
                                      )}{" "}
                                      ({c.nDemandKgHa}N)
                                    </option>
                                  )
                                )}
                              </optgroup>
                              <optgroup
                                label={
                                  lang === "de"
                                    ? "Weitere Ackerkulturen"
                                    : "Other Arable Crops"
                                }
                              >
                                {baselineCatalogGroups.otherArableOptions.map(
                                  (c) => (
                                    <option key={c.id} value={c.id}>
                                      {getLocalizedCropDisplayName(
                                        c,
                                        xray,
                                        lang
                                      )}{" "}
                                      ({c.nDemandKgHa}N)
                                    </option>
                                  )
                                )}
                              </optgroup>
                              {customPoolForDropdown.length > 0 && (
                                <optgroup
                                  label={
                                    lang === "de"
                                      ? "Eigene Kulturen"
                                      : "Custom Crops"
                                  }
                                >
                                  {customPoolForDropdown.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} ({c.nDemandKgHa}N)
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <option value="__custom__">
                                {lang === "de"
                                  ? "+ Eigene Kultur eingeben…"
                                  : "+ Type custom crop…"}
                              </option>
                            </select>

                            <button
                              type="button"
                              onClick={() => {
                                setCustomYearName("");
                                setCustomYearEditorIdx(yearIdx);
                              }}
                              title={
                                lang === "de"
                                  ? "Eigene Vorfrucht eingeben"
                                  : "Type any custom crop grown in this year"
                              }
                              className="min-h-[34px] px-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                            >
                              <Plus className="w-3 h-3 text-emerald-700" />
                              <span>{lang === "de" ? "Eigene" : "Custom"}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-zinc-200/80 text-xs text-zinc-600 flex items-center justify-between">
                        <span>{lang === "de" ? "Wasserbedarf:" : "Water need:"}</span>
                        <span className="font-mono font-semibold text-zinc-900">
                          {selectedCrop.waterNeedMm} mm/yr
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] flex flex-col justify-between gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      {t.nitrateTag}
                    </div>
                    <h2 className="text-sm sm:text-base font-bold text-zinc-950 mt-0.5">
                      {t.nitrateQuestion}
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setIsNitrateRestricted(true)}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-all inline-flex items-center gap-1.5 ${
                        isNitrateRestricted
                          ? "bg-emerald-700 border-emerald-700 text-white"
                          : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t.nitrateYes}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsNitrateRestricted(false)}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                        !isNitrateRestricted
                          ? "bg-emerald-700 border-emerald-700 text-white"
                          : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {t.nitrateNo}
                    </button>
                  </div>
                </div>

                {/* Live Agronomic Carryover & Crop-Break Diagnostic from Yr 1–4 History */}
                <div
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium flex items-center gap-2 border ${
                    historyDiagnosis.tone === "positive"
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                      : historyDiagnosis.tone === "warning"
                      ? "bg-amber-50/70 border-amber-200 text-amber-900"
                      : "bg-zinc-50 border-zinc-200/80 text-zinc-700"
                  }`}
                >
                  <Sprout className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
                  <span className="truncate">{historyDiagnosis.summary}</span>
                </div>
              </div>

              <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {t.fertBillTitle} ({farmAreaHa} ha)
                  </div>
                  <div className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 tabular-nums mt-0.5">
                    €{baseline4YrFertCostEur.toLocaleString()}
                  </div>
                  <p className="text-xs text-zinc-600">
                    {baselineStrategy.avgSyntheticNKgHa} kg N/ha/yr · €
                    {activeFertPrice.toFixed(2)}/kg N
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                  {t.bareSoilLabel}:{" "}
                  <strong>{baselineStrategy.bareSoilMonthsAvg} mos/yr</strong>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================
            STEP 3: VISUAL FIELD, 7-DAY SPREADER WEATHER & SATELLITE SCAN
            (Zero-Scroll Widescreen Tabbed Stage)
           ========================================================= */}
        {step === 3 && (
          <section
            aria-label="Step 3: NASA satellite and visual soil scan"
            className="space-y-4"
          >
            {/* Row 1: Title + 3 View Switcher Tabs + Back/Next Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {t.step3Tag}
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 leading-tight">
                  {xray.name}
                </h1>
              </div>

              {/* 4 Single-Screen View Tabs */}
              <div
                role="tablist"
                aria-label="Satellite scan views"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-zinc-100/90 border border-zinc-200/80"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={step3Tab === "satellite"}
                  onClick={() => setStep3Tab("satellite")}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    step3Tab === "satellite"
                      ? "bg-white text-emerald-800 shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <Satellite className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    {lang === "de" ? "Echtes Hof-Luftbild" : "Real Farm Satellite"}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={step3Tab === "visuals"}
                  onClick={() => setStep3Tab("visuals")}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    step3Tab === "visuals"
                      ? "bg-white text-emerald-800 shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <Sprout className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    {lang === "de" ? "Boden & Wurzel" : "Soil & Roots"}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={step3Tab === "spreader"}
                  onClick={() => setStep3Tab("spreader")}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    step3Tab === "spreader"
                      ? "bg-white text-emerald-800 shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <CloudRain className="w-3.5 h-3.5 text-sky-600" />
                  <span>
                    {lang === "de" ? "7-Tage Wetter" : "7-Day Spreader"}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={step3Tab === "climate"}
                  onClick={() => setStep3Tab("climate")}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    step3Tab === "climate"
                      ? "bg-white text-emerald-800 shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    {lang === "de" ? "12-M NASA Klima" : "12-M NASA Climate"}
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs sm:text-sm font-semibold text-zinc-700 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t.backCrops}</span>
                </button>

                <button
                  type="button"
                  onClick={() => goToStep(4)}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                >
                  <span>{t.seePlansBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Row 2: Compact Horizontal Farm Telemetry & KPI Strip */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
              <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200/90 p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center gap-3.5">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-zinc-200/80 bg-zinc-900">
                  <ResilientImage
                    src={buildFarmAerialUrl({
                      lat: xray.lat,
                      lon: xray.lon,
                      farmAreaHa,
                      mode: "thumb",
                    })}
                    alt={xray.name}
                    eager
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                    {farmAreaHa} ha · {xray.regionLabel}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-zinc-950 line-clamp-2 leading-snug mt-0.5">
                    {xray.plainSummary}
                  </p>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-white rounded-2xl border border-zinc-200/90 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                    <CloudRain className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base sm:text-lg font-bold text-zinc-950 tabular-nums leading-tight">
                      ~{xray.estimatedNLossPct}% {t.nRiskLabel}
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {xray.slopePct.toFixed(1)}% slope · {xray.bareSoilMonthsPerYear}m bare
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-zinc-200/90 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base sm:text-lg font-bold text-zinc-950 tabular-nums leading-tight">
                      {minSummerMoisturePct}% {t.julyMoistureLabel}
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {maxSummerTemp}°C peak heat (SMAP)
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-zinc-200/90 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                    <Sprout className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base sm:text-lg font-bold text-zinc-950 tabular-nums leading-tight">
                      pH {xray.soil.ph} · {xray.soil.textureClass}
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {xray.soil.waterHoldingMm} mm storage
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Active Zero-Scroll Visual Stage */}
            {step3Tab === "satellite" && (
              <OwnerFarmSatelliteView
                xray={xray}
                farmAreaHa={farmAreaHa}
                lang={lang}
              />
            )}

            {step3Tab === "visuals" && (
              <SoilVisualCompare
                estimatedNLossPct={xray.estimatedNLossPct}
                minSummerMoisturePct={minSummerMoisturePct}
              />
            )}

            {step3Tab === "spreader" && (
              <SpreaderWeatherStrip
                lat={xray.lat}
                lon={xray.lon}
                lang={lang}
              />
            )}

            {step3Tab === "climate" && (
              <ClimateSoilCharts
                xray={xray}
                strategies={strategies}
                mode="climate"
              />
            )}
          </section>
        )}

        {/* =========================================================
            STEP 4: PICK GOAL, SUBSIDY STACKER, 3 PLANS & BENCHMARK
            (Zero-Scroll Widescreen Tabbed Stage)
           ========================================================= */}
        {step === 4 && (
          <section
            aria-label="Step 4: Compare 4-year crop rotation plans"
            className="space-y-3.5"
          >
            {/* Row 1: Title + Weather Toggle + Navigation Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {t.step4Tag}
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 leading-tight">
                  {t.step4Title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-zinc-100/90 rounded-xl border border-zinc-200/90 p-1 inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setWeatherScenario("normal")}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                      weatherScenario === "normal"
                        ? "bg-emerald-700 text-white shadow-2xs"
                        : "text-zinc-700 hover:bg-white"
                    }`}
                  >
                    <CloudSun className="w-3.5 h-3.5" />
                    <span>{t.normalWeather}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeatherScenario("drought_heat")}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                      weatherScenario === "drought_heat"
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "text-zinc-700 hover:bg-white"
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>{t.droughtWeather}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t.backScan}</span>
                </button>
              </div>
            </div>

            {/* Row 2: 4 Compact Goal Pills (Left) + 3 View Switcher Tabs (Right) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className="flex flex-wrap items-center gap-2"
                role="radiogroup"
                aria-label="Choose your #1 farm priority"
              >
                {GOAL_ORDER.map((goalId) => {
                  const Icon = GOAL_ICONS[goalId];
                  const goalCopy = t.goals[goalId];
                  const active = primaryGoal === goalId;
                  return (
                    <button
                      key={goalId}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPrimaryGoal(goalId)}
                      title={goalCopy.desc}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                        active
                          ? "bg-emerald-700 border-emerald-700 text-white shadow-2xs"
                          : "bg-white border-zinc-200/90 text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{goalCopy.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* 4 Step-4 View Switcher Tabs */}
              <div
                role="tablist"
                aria-label="Step 4 views"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-zinc-100/90 border border-zinc-200/80"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={step4Tab === "plans"}
                  onClick={() => setStep4Tab("plans")}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    step4Tab === "plans"
                      ? "bg-white text-emerald-800 shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <Sprout className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    {lang === "de" ? "3 Fruchtfolge-Pläne" : "3 Crop Plans"}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={step4Tab === "custom_crops"}
                  onClick={() => setStep4Tab("custom_crops")}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    step4Tab === "custom_crops"
                      ? "bg-white text-emerald-800 shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    {lang === "de"
                      ? "Eigene Kultur prüfen"
                      : "Custom Crop Check"}
                  </span>
                  {customCropEntries.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-mono font-bold">
                      {customCropEntries.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={step4Tab === "subsidies_prices"}
                  onClick={() => setStep4Tab("subsidies_prices")}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    step4Tab === "subsidies_prices"
                      ? "bg-white text-emerald-800 shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    {lang === "de"
                      ? "FAKT II & €/t Preise"
                      : "FAKT II & €/t Prices"}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={step4Tab === "benchmark"}
                  onClick={() => setStep4Tab("benchmark")}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    step4Tab === "benchmark"
                      ? "bg-white text-emerald-800 shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    {lang === "de" ? "Regions-Benchmark" : "Regional Benchmark"}
                  </span>
                </button>
              </div>
            </div>

            {/* Row 3: Active Zero-Scroll Tab Stage */}
            {step4Tab === "plans" && (
              <RotationStrategyCards
                isNitrateRestricted={isNitrateRestricted}
                farmAreaHa={farmAreaHa}
                strategies={strategies}
                lang={lang}
                onOpenTractorMap={(s) => setTractorModalStrategy(s)}
                onOpenActionPlan={(s) => setActionPlanStrategy(s)}
              />
            )}

            {step4Tab === "custom_crops" && (
              <CustomCropSuitabilityPanel
                xray={xray}
                weatherScenario={weatherScenario}
                customEntries={customCropEntries}
                onAddOrUpdateEntry={handleAddOrUpdateCustomCrop}
                onToggleInclude={handleToggleCustomCropInclude}
                onRemoveEntry={handleRemoveCustomCrop}
                onViewPlans={() => setStep4Tab("plans")}
                lang={lang}
              />
            )}

            {step4Tab === "subsidies_prices" && (
              <div className="space-y-4">
                <SubsidyStackerBar
                  subsidies={subsidies}
                  onChange={setSubsidies}
                  bestStrategy={bestAdapted}
                  farmAreaHa={farmAreaHa}
                  lang={lang}
                />

                <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.03)] space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                      <Coins className="w-3.5 h-3.5 text-emerald-700" />
                      {t.liveHub}: {priceFeed.areaMarketLabel}
                    </span>

                    {hasCustomPriceEdits && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomPrices({});
                          setCustomFertPrice(undefined);
                        }}
                        className="min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200/70 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t.resetPrices}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {areaPriceCropIds.map((cid) => {
                      const crop = CROPS_STUTTGART[cid];
                      const q = priceFeed.quotes[cid];
                      if (!crop || !q) return null;
                      const val =
                        customPrices[cid] ?? q.effectiveLocalPriceEurTon;
                      return (
                        <div
                          key={cid}
                          className="rounded-xl bg-zinc-50 border border-zinc-200 p-2.5"
                        >
                          <label
                            htmlFor={`price-${cid}`}
                            className="block text-[11px] font-semibold text-zinc-700 truncate"
                          >
                            {getLocalizedCropDisplayName(crop, xray, lang)} (€/t)
                          </label>
                          <input
                            id={`price-${cid}`}
                            type="number"
                            min={20}
                            max={1200}
                            step={5}
                            value={val}
                            onChange={(e) =>
                              setCustomPrices((prev) => ({
                                ...prev,
                                [cid]: Math.max(
                                  20,
                                  Number(e.target.value) || 100
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-sm font-mono font-bold text-zinc-950 tabular-nums"
                          />
                        </div>
                      );
                    })}

                    <div className="rounded-xl bg-amber-50/60 border border-amber-200 p-2.5">
                      <label
                        htmlFor="price-fert-n"
                        className="block text-[11px] font-semibold text-amber-900 truncate"
                      >
                        KAS N (€/kg N)
                      </label>
                      <input
                        id="price-fert-n"
                        type="number"
                        min={0.5}
                        max={4.0}
                        step={0.05}
                        value={activeFertPrice}
                        onChange={(e) =>
                          setCustomFertPrice(
                            Math.max(0.4, Number(e.target.value) || 1.31)
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-sm font-mono font-bold text-zinc-950 tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step4Tab === "benchmark" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                <div className="lg:col-span-6 flex">
                  <div className="w-full">
                    <StuttgartBenchmarkCard
                      baseline={baselineStrategy}
                      bestAdapted={bestAdapted}
                      lang={lang}
                    />
                  </div>
                </div>
                <div className="lg:col-span-6 flex">
                  <div className="w-full">
                    <ClimateSoilCharts
                      xray={xray}
                      strategies={strategies}
                      mode="comparison"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Modals for Tractor ISOXML Map & Printable Farm Plan */}
      {tractorModalStrategy && (
        <TractorPrescriptionModal
          xray={xray}
          strategy={tractorModalStrategy}
          farmAreaHa={farmAreaHa}
          customPolygon={customFieldPolygon}
          onClose={() => setTractorModalStrategy(null)}
        />
      )}

      {actionPlanStrategy && (
        <FarmActionPlanModal
          xray={xray}
          farmAreaHa={farmAreaHa}
          baseline={baselineStrategy}
          strategy={actionPlanStrategy}
          isNitrateRestricted={isNitrateRestricted}
          subsidies={subsidies}
          fionaId={sessionUser?.betriebsNummer}
          lang={lang}
          onClose={() => setActionPlanStrategy(null)}
        />
      )}
    </div>
  );
}
