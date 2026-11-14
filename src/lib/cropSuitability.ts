import {
  AREA_PRODUCED_CROPS,
  CROPS_STUTTGART,
  getLocalizedCropDisplayName,
  isInsideBadenWuerttemberg,
} from "@/data/agronomyCatalog";
import type {
  CropSpec,
  CropSuitabilityEvaluation,
  CropSuitabilityStatus,
  FarmXrayData,
  MonthlyClimatePoint,
  SoilProfile,
  WeatherScenario,
} from "@/types/ackeriq";

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface AgroClimateDiagnostics {
  agroZoneLabel: string;
  gdd10: number;
  gdd5: number;
  annualPrecipMm: number;
  growingPrecipMm: number;
  effectiveMaxTempC: number;
  effectiveMinSummerMoisturePct: number;
  minWinterTempC: number;
  inBadenWuerttemberg: boolean;
}

export function computeAgroClimateDiagnostics(
  lat: number,
  lon: number,
  elevationM: number,
  monthlyClimate: MonthlyClimatePoint[],
  scenario: WeatherScenario = "normal"
): AgroClimateDiagnostics {
  const gdd10 = Math.round(
    monthlyClimate.reduce(
      (sum, m, idx) =>
        sum + Math.max(0, m.tempAvgC - 10) * (MONTH_DAYS[idx] ?? 30),
      0
    )
  );
  const gdd5 = Math.round(
    monthlyClimate.reduce(
      (sum, m, idx) =>
        sum + Math.max(0, m.tempAvgC - 5) * (MONTH_DAYS[idx] ?? 30),
      0
    )
  );

  const annualPrecipMm = Math.round(
    monthlyClimate.reduce((sum, m) => sum + m.precipMm, 0) *
      (scenario === "drought_heat" ? 0.82 : 1.0)
  );

  const aprToSep = monthlyClimate.slice(3, 9);
  const growingPrecipMm = Math.round(
    aprToSep.reduce((sum, m) => sum + m.precipMm, 0) *
      (scenario === "drought_heat" ? 0.7 : 1.0)
  );

  const rawMaxTemp = Math.max(...monthlyClimate.map((m) => m.tempMaxC));
  const effectiveMaxTempC = Number(
    (rawMaxTemp + (scenario === "drought_heat" ? 3.8 : 0)).toFixed(1)
  );

  const summerMonths = monthlyClimate.slice(5, 8); // Jun-Aug
  const rawMinSummerMoisture = Math.min(
    ...(summerMonths.length > 0 ? summerMonths : monthlyClimate).map(
      (m) => m.rootMoistureIdx
    )
  );
  const effectiveMinSummerMoisturePct = Math.max(
    12,
    Math.round(
      rawMinSummerMoisture * 100 - (scenario === "drought_heat" ? 11 : 0)
    )
  );

  const minWinterTempC = Number(
    Math.min(...monthlyClimate.map((m) => m.tempAvgC)).toFixed(1)
  );

  const inBadenWuerttemberg = isInsideBadenWuerttemberg(lat, lon);

  let agroZoneLabel = "Temperate Arable Belt";
  if (gdd10 >= 1950 && growingPrecipMm >= 480) {
    agroZoneLabel = "Warm Humid / Subtropical Basin";
  } else if (gdd10 >= 1550 && growingPrecipMm < 360) {
    agroZoneLabel = "Hot Dry / Semi-Arid Summer Zone";
  } else if (gdd10 >= 1450) {
    agroZoneLabel = "Warm Continental / Mediterranean Belt";
  } else if (gdd10 >= 1110 && elevationM < 365) {
    agroZoneLabel = inBadenWuerttemberg
      ? "Warm Wine & Loess Basin (Neckar/Rems)"
      : "Warm River & Loess Basin";
  } else if (gdd10 < 915 || elevationM >= 430) {
    agroZoneLabel = inBadenWuerttemberg
      ? "Cool Calcareous Plateau (Gäu / Alb)"
      : "Cool Upland Arable Plateau";
  } else if (gdd10 < 680) {
    agroZoneLabel = "Short-Season Boreal / Highland Zone";
  } else {
    agroZoneLabel = inBadenWuerttemberg
      ? "Filder & Central BW Loess Plateau"
      : "Temperate Loam Arable Zone";
  }

  return {
    agroZoneLabel,
    gdd10,
    gdd5,
    annualPrecipMm,
    growingPrecipMm,
    effectiveMaxTempC,
    effectiveMinSummerMoisturePct,
    minWinterTempC,
    inBadenWuerttemberg,
  };
}

interface CropBiophysicalRule {
  minGdd10: number;
  maxGdd10?: number;
  maxElevationM?: number;
  minWinterAvgC?: number;
  minPh: number;
  maxPh: number;
  maxSafeTempC: number;
  minMoisturePct: number;
}

const CROP_BIOPHYSICAL_RULES: Record<string, CropBiophysicalRule> = {
  winter_wheat: {
    minGdd10: 760,
    maxGdd10: 2700,
    minWinterAvgC: -9,
    minPh: 5.6,
    maxPh: 8.2,
    maxSafeTempC: 34.5,
    minMoisturePct: 32,
  },
  swabian_spelt: {
    minGdd10: 680,
    maxGdd10: 2200,
    minWinterAvgC: -11,
    minPh: 5.4,
    maxPh: 8.3,
    maxSafeTempC: 35.5,
    minMoisturePct: 27,
  },
  malting_barley: {
    minGdd10: 700,
    maxGdd10: 2150,
    minPh: 5.8,
    maxPh: 8.2,
    maxSafeTempC: 34.0,
    minMoisturePct: 28,
  },
  winter_barley: {
    minGdd10: 740,
    maxGdd10: 2500,
    minWinterAvgC: -8,
    minPh: 5.8,
    maxPh: 8.2,
    maxSafeTempC: 35.0,
    minMoisturePct: 28,
  },
  winter_rye: {
    minGdd10: 600,
    maxGdd10: 2200,
    minWinterAvgC: -14,
    minPh: 4.9,
    maxPh: 8.0,
    maxSafeTempC: 35.5,
    minMoisturePct: 22,
  },
  spring_oats: {
    minGdd10: 640,
    maxGdd10: 1450,
    minPh: 5.0,
    maxPh: 7.7,
    maxSafeTempC: 30.8,
    minMoisturePct: 38,
  },
  durum_wheat: {
    minGdd10: 1090,
    maxGdd10: 2900,
    maxElevationM: 410,
    minWinterAvgC: -5,
    minPh: 6.2,
    maxPh: 8.4,
    maxSafeTempC: 38.5,
    minMoisturePct: 25,
  },
  grain_maize: {
    minGdd10: 960,
    maxGdd10: 3600,
    minPh: 5.5,
    maxPh: 8.2,
    maxSafeTempC: 35.0,
    minMoisturePct: 41,
  },
  grain_sorghum: {
    minGdd10: 1080,
    maxGdd10: 4000,
    maxElevationM: 420,
    minPh: 5.4,
    maxPh: 8.5,
    maxSafeTempC: 40.5,
    minMoisturePct: 21,
  },
  winter_rapeseed: {
    minGdd10: 760,
    maxGdd10: 1950,
    minWinterAvgC: -8,
    minPh: 5.8,
    maxPh: 8.1,
    maxSafeTempC: 31.8,
    minMoisturePct: 36,
  },
  sunflower_bw: {
    minGdd10: 1070,
    maxGdd10: 3400,
    maxElevationM: 415,
    minPh: 5.6,
    maxPh: 8.4,
    maxSafeTempC: 38.5,
    minMoisturePct: 23,
  },
  sugar_beet: {
    minGdd10: 920,
    maxGdd10: 2600,
    maxElevationM: 420,
    minPh: 6.2,
    maxPh: 8.2,
    maxSafeTempC: 33.5,
    minMoisturePct: 43,
  },
  sugar_beet_cover: {
    minGdd10: 920,
    maxGdd10: 2600,
    maxElevationM: 420,
    minPh: 6.2,
    maxPh: 8.2,
    maxSafeTempC: 34.5,
    minMoisturePct: 39,
  },
  table_potato: {
    minGdd10: 720,
    maxGdd10: 2100,
    minPh: 5.0,
    maxPh: 7.5,
    maxSafeTempC: 29.8,
    minMoisturePct: 43,
  },
  soybean_bw: {
    minGdd10: 1020,
    maxGdd10: 3500,
    maxElevationM: 430,
    minPh: 5.8,
    maxPh: 8.0,
    maxSafeTempC: 37.5,
    minMoisturePct: 31,
  },
  field_bean: {
    minGdd10: 720,
    maxGdd10: 1650,
    minPh: 6.0,
    maxPh: 8.2,
    maxSafeTempC: 31.2,
    minMoisturePct: 38,
  },
  field_pea: {
    minGdd10: 720,
    maxGdd10: 2450,
    minPh: 5.8,
    maxPh: 8.2,
    maxSafeTempC: 34.5,
    minMoisturePct: 26,
  },
  chickpea: {
    minGdd10: 1180,
    maxGdd10: 3800,
    maxElevationM: 450,
    minPh: 6.0,
    maxPh: 8.6,
    maxSafeTempC: 40.5,
    minMoisturePct: 18,
  },
  lentil_ansa: {
    minGdd10: 820,
    maxGdd10: 2600,
    minPh: 6.3,
    maxPh: 8.4,
    maxSafeTempC: 35.5,
    minMoisturePct: 24,
  },
  alfalfa_lucerne: {
    minGdd10: 780,
    maxGdd10: 3600,
    minPh: 6.3,
    maxPh: 8.5,
    maxSafeTempC: 39.0,
    minMoisturePct: 24,
  },
  white_lupin: {
    minGdd10: 780,
    maxGdd10: 2400,
    minPh: 4.8,
    maxPh: 7.05,
    maxSafeTempC: 34.5,
    minMoisturePct: 26,
  },
  paddy_rice: {
    minGdd10: 1850,
    maxGdd10: 5000,
    maxElevationM: 350,
    minPh: 5.0,
    maxPh: 8.0,
    maxSafeTempC: 41.0,
    minMoisturePct: 62,
  },
  cotton_crop: {
    minGdd10: 2050,
    maxGdd10: 5000,
    maxElevationM: 500,
    minPh: 5.6,
    maxPh: 8.4,
    maxSafeTempC: 42.0,
    minMoisturePct: 35,
  },
};

function inferRuleForCrop(crop: CropSpec): CropBiophysicalRule {
  if (CROP_BIOPHYSICAL_RULES[crop.id]) {
    return CROP_BIOPHYSICAL_RULES[crop.id];
  }

  // Dynamic biophysical rule for user-defined custom crops based on water/heat/family traits
  const highHeat = crop.heatToleranceScore >= 9;
  const lowHeat = crop.heatToleranceScore <= 5;
  const highWater = crop.waterNeedMm >= 520;
  const lowWater = crop.waterNeedMm <= 340;

  return {
    minGdd10: highHeat ? 1080 : lowHeat ? 650 : 800,
    maxGdd10: lowHeat ? 1750 : 3800,
    minPh: 5.5,
    maxPh: 8.2,
    maxSafeTempC: 25 + crop.heatToleranceScore * 1.45,
    minMoisturePct: highWater ? 44 : lowWater ? 22 : 31,
  };
}

/**
 * Evaluates whether a crop is Suitable, Conditional, or Unsuitable for the exact farm
 * based on: (1) regional cultivation & thermal GDD/elevation, (2) NASA SMAP/POWER root moisture
 * & soil water storage, (3) peak summer heat weather, and (4) soil pH/texture/SRTM slope.
 */
export function evaluateCropSuitability(
  crop: CropSpec,
  xray: FarmXrayData,
  scenario: WeatherScenario = "normal",
  options?: { isCustom?: boolean; forceInclude?: boolean }
): CropSuitabilityEvaluation {
  const diag = computeAgroClimateDiagnostics(
    xray.lat,
    xray.lon,
    xray.elevationM,
    xray.monthlyClimate,
    scenario
  );
  const rule = inferRuleForCrop(crop);

  const presetProducedList = AREA_PRODUCED_CROPS[xray.id];
  const explicitProducedSet = new Set(
    xray.producedCropIds?.length > 0
      ? xray.producedCropIds
      : presetProducedList ?? []
  );

  let score = 84;
  let hardBlock = false;
  const warnings: string[] = [];
  const blockers: string[] = [];

  // 1. Thermal GDD, Elevation & Regional Cultivation Check
  if (diag.gdd10 < rule.minGdd10) {
    const deficit = rule.minGdd10 - diag.gdd10;
    if (deficit >= 140) {
      hardBlock = true;
      score -= 48;
      blockers.push(
        `Too cool (${diag.gdd10} GDD₁₀ vs ${rule.minGdd10} needed to mature)`
      );
    } else {
      score -= 22;
      warnings.push(
        `Borderline heat units (${diag.gdd10} GDD₁₀; select early variety)`
      );
    }
  }

  if (rule.maxGdd10 && diag.gdd10 > rule.maxGdd10) {
    const excess = diag.gdd10 - rule.maxGdd10;
    if (excess >= 280) {
      hardBlock = true;
      score -= 42;
      blockers.push(
        `Climate too hot for cool-season ${getLocalizedCropDisplayName(crop, xray)} (${diag.gdd10} GDD₁₀)`
      );
    } else {
      score -= 18;
      warnings.push(`Warm zone reduces cool-season grain fill`);
    }
  }

  if (rule.maxElevationM && xray.elevationM > rule.maxElevationM) {
    const overM = Math.round(xray.elevationM - rule.maxElevationM);
    if (overM >= 45 && diag.gdd10 < rule.minGdd10 + 90) {
      hardBlock = true;
      score -= 36;
      blockers.push(
        `Elevation ${Math.round(xray.elevationM)}m too cool/late-harvest (max ~${rule.maxElevationM}m)`
      );
    } else if (overM > 15) {
      score -= 14;
      warnings.push(
        `Upland ${Math.round(xray.elevationM)}m delays autumn maturity`
      );
    }
  }

  if (
    typeof rule.minWinterAvgC === "number" &&
    diag.minWinterTempC < rule.minWinterAvgC
  ) {
    hardBlock = true;
    score -= 40;
    blockers.push(
      `Winterkill risk (${diag.minWinterTempC}°C coldest month vs ${rule.minWinterAvgC}°C limit)`
    );
  }

  // Special Paddy Rice & Chickpea wet-rot / flood checks
  if (crop.id === "paddy_rice" && (xray.slopePct > 1.8 || diag.annualPrecipMm < 850)) {
    hardBlock = true;
    score -= 50;
    blockers.push(
      `Needs flooded zero-slope basin & >850mm water (farm has ${xray.slopePct.toFixed(1)}% slope, ${diag.annualPrecipMm}mm rain)`
    );
  }

  if (crop.id === "chickpea" && diag.growingPrecipMm > 430 && xray.soil.clayPct >= 26) {
    score -= 24;
    warnings.push(
      `Humid summer (${diag.growingPrecipMm}mm) + ${xray.soil.clayPct}% clay raises Ascochyta blight risk`
    );
  }

  // 2. Soil Moisture & Water Balance Check
  const effectiveWaterSupplyMm = Math.round(
    diag.growingPrecipMm * 0.82 +
      xray.soil.waterHoldingMm * (diag.effectiveMinSummerMoisturePct / 100) +
      (crop.coverCropIncluded ? 26 : 0)
  );
  const waterCoverageRatio =
    effectiveWaterSupplyMm / Math.max(220, crop.waterNeedMm);

  let moistureVerdict = `✓ ${diag.effectiveMinSummerMoisturePct}% Jul moisture (${effectiveWaterSupplyMm}mm supply vs ${crop.waterNeedMm}mm need)`;

  if (
    diag.effectiveMinSummerMoisturePct < rule.minMoisturePct - 9 ||
    waterCoverageRatio < 0.66
  ) {
    hardBlock = true;
    score -= 38;
    moistureVerdict = `✕ Soil too dry (${diag.effectiveMinSummerMoisturePct}% Jul moisture; ${crop.waterNeedMm}mm needed)`;
    blockers.push(
      `Severe moisture deficit (${effectiveWaterSupplyMm}mm available vs ${crop.waterNeedMm}mm crop demand)`
    );
  } else if (
    diag.effectiveMinSummerMoisturePct < rule.minMoisturePct ||
    waterCoverageRatio < 0.84
  ) {
    score -= 19;
    moistureVerdict = `⚠ Tight summer moisture (${diag.effectiveMinSummerMoisturePct}% Jul vs ${crop.waterNeedMm}mm need)`;
    warnings.push(
      `Summer moisture drops to ${diag.effectiveMinSummerMoisturePct}% (${crop.waterNeedMm}mm water demand)`
    );
  } else if (crop.waterNeedMm <= 360 && crop.droughtToleranceScore >= 8) {
    score += 9;
    moistureVerdict = `✓ Drought-safe (${crop.waterNeedMm}mm need fits ${diag.effectiveMinSummerMoisturePct}% Jul moisture)`;
  }

  // 3. Peak Heat Weather Check
  let heatVerdict = `✓ ${diag.effectiveMaxTempC}°C peak summer fits heat score ${crop.heatToleranceScore}/10`;
  if (diag.effectiveMaxTempC > rule.maxSafeTempC + 3.2) {
    hardBlock = true;
    score -= 34;
    heatVerdict = `✕ ${diag.effectiveMaxTempC}°C peak heat causes flowering/seed abortion (limit ~${rule.maxSafeTempC.toFixed(0)}°C)`;
    blockers.push(
      `Peak summer heat (${diag.effectiveMaxTempC}°C) exceeds ${getLocalizedCropDisplayName(crop, xray)} tolerance`
    );
  } else if (diag.effectiveMaxTempC > rule.maxSafeTempC) {
    score -= 17;
    heatVerdict = `⚠ ${diag.effectiveMaxTempC}°C summer heat stresses flowering (best ≤${rule.maxSafeTempC.toFixed(0)}°C)`;
    warnings.push(
      `${diag.effectiveMaxTempC}°C peak heat trims yield without mulch moisture`
    );
  } else if (diag.effectiveMaxTempC >= 30 && crop.heatToleranceScore >= 8) {
    score += 7;
    heatVerdict = `✓ Thrives in ${diag.effectiveMaxTempC}°C summer heat (${crop.heatToleranceScore}/10 heat score)`;
  }

  // 4. Soil pH, Texture & Slope Erosion Check
  let soilSlopeVerdict = `✓ pH ${xray.soil.ph} ${xray.soil.textureClass} · ${xray.slopePct.toFixed(1)}% slope`;
  if (xray.soil.ph < rule.minPh - 0.35 || xray.soil.ph > rule.maxPh + 0.35) {
    hardBlock = true;
    score -= 36;
    soilSlopeVerdict = `✕ Soil pH ${xray.soil.ph} outside ${rule.minPh}–${rule.maxPh} range`;
    blockers.push(
      xray.soil.ph > rule.maxPh
        ? `Soil pH ${xray.soil.ph} causes lime chlorosis (requires pH ≤ ${rule.maxPh})`
        : `Soil pH ${xray.soil.ph} too acidic for root nodulation/uptake (requires pH ≥ ${rule.minPh})`
    );
  } else if (xray.soil.ph < rule.minPh || xray.soil.ph > rule.maxPh) {
    score -= 15;
    soilSlopeVerdict = `⚠ Borderline soil pH ${xray.soil.ph} (ideal ${rule.minPh}–${rule.maxPh})`;
    warnings.push(`Soil pH ${xray.soil.ph} is borderline (optimal ${rule.minPh}–${rule.maxPh})`);
  }

  if (xray.slopePct >= 4.2 && crop.erosionShieldScore <= 3 && !crop.coverCropIncluded) {
    score -= 20;
    soilSlopeVerdict = `⚠ ${xray.slopePct.toFixed(1)}% slope runoff risk on wide rows (use winter mulch)`;
    warnings.push(
      `${xray.slopePct.toFixed(1)}% hillside slope risks spring erosion on wide-row ${getLocalizedCropDisplayName(crop, xray)}`
    );
  }

  const grownInRegion =
    explicitProducedSet.has(crop.id) ||
    (!presetProducedList && !hardBlock && score >= 66);

  if (presetProducedList && !explicitProducedSet.has(crop.id) && !options?.isCustom) {
    // Respect verified sub-regional cultivation lists for standard preset runs
    score -= 14;
  } else if (explicitProducedSet.has(crop.id)) {
    score += 5;
  }

  const clampedScore = Math.max(8, Math.min(99, Math.round(score)));

  let status: CropSuitabilityStatus = "suitable";
  if (hardBlock || clampedScore < 48) {
    status = "unsuitable";
  } else if (warnings.length > 0 && clampedScore < 72) {
    status = "conditional";
  }

  const summaryReason =
    status === "unsuitable"
      ? blockers[0] ?? warnings[0] ?? "Climate or soil parameters outside viable range."
      : status === "conditional"
      ? warnings[0] ?? "Grows with variety/mulch management under summer stress."
      : `${
          grownInRegion ? "Commercially grown in this zone" : "Agro-climatically matched"
        } · ${diag.effectiveMinSummerMoisturePct}% Jul moisture & ${diag.effectiveMaxTempC}°C fit.`;

  const isCustom = Boolean(options?.isCustom || crop.isCustomCrop);
  const includedInPlan =
    options?.forceInclude !== undefined
      ? options.forceInclude && status !== "unsuitable"
      : isCustom && status === "suitable";

  return {
    crop,
    status,
    score: clampedScore,
    grownInRegion,
    agroZoneLabel: diag.agroZoneLabel,
    moistureVerdict,
    heatVerdict,
    soilSlopeVerdict,
    summaryReason,
    isCustom,
    includedInPlan,
  };
}

/**
 * Dynamically computes regionally cultivated crops (`producedCropIds`), baseline defaults,
 * and an authentic regional production note for ANY global/European coordinate!
 */
export function deriveRegionalCropProfile(
  lat: number,
  lon: number,
  elevationM: number,
  slopePct: number,
  monthlyClimate: MonthlyClimatePoint[],
  soil: SoilProfile
): {
  producedCropIds: string[];
  defaultCurrentCropIds: [string, string, string, string];
  localProductionNote: string;
} {
  const tempXrayStub: FarmXrayData = {
    id: "dynamic-probe",
    name: "Probe",
    subRegionTag: "",
    regionLabel: "",
    heroImageUrl: "/images/farm-plieningen.jpg",
    lat,
    lon,
    defaultAreaHa: 165,
    elevationM,
    slopePct,
    isNitrateRestricted: true,
    defaultCurrentCropIds: [
      "winter_wheat",
      "winter_barley",
      "winter_rapeseed",
      "winter_wheat",
    ],
    producedCropIds: [],
    localProductionNote: "",
    bareSoilMonthsPerYear: 2.8,
    estimatedNLossPct: 28,
    plainSummary: "",
    monthlyClimate,
    soil,
    parcels: [],
    liveSourcesUsed: [],
    fetchedAtIso: "2026-11-14T12:00:00Z",
  };

  const diag = computeAgroClimateDiagnostics(
    lat,
    lon,
    elevationM,
    monthlyClimate,
    "normal"
  );

  const evaluations = Object.values(CROPS_STUTTGART)
    .map((crop) => evaluateCropSuitability(crop, tempXrayStub, "normal"))
    .filter((ev) => ev.status !== "unsuitable" && ev.score >= 64)
    .sort((a, b) => b.score - a.score);

  const producedCropIds = evaluations.map((e) => e.crop.id);

  // Guarantee at least 4 resilient crops even in extreme marginal coordinates
  if (producedCropIds.length < 4) {
    for (const fallbackId of [
      "winter_rye",
      "malting_barley",
      "field_pea",
      "grain_sorghum",
      "winter_wheat",
    ]) {
      if (!producedCropIds.includes(fallbackId)) {
        producedCropIds.push(fallbackId);
      }
    }
  }

  const baselineCandidates = producedCropIds.filter(
    (id) => CROPS_STUTTGART[id]?.selectableAsBaseline && !CROPS_STUTTGART[id]?.isLegume
  );
  const c1 = baselineCandidates[0] ?? producedCropIds[0] ?? "winter_wheat";
  const c2 = baselineCandidates[1] ?? producedCropIds[1] ?? "winter_barley";
  const c3 = baselineCandidates[2] ?? producedCropIds[2] ?? c1;

  const topNames = evaluations
    .slice(0, 5)
    .map((e) => getLocalizedCropDisplayName(e.crop, { lat, lon }, "en"))
    .join(", ");

  const localProductionNote = `${diag.agroZoneLabel} (${Math.round(
    elevationM
  )}m · ${diag.gdd10} GDD₁₀ · ${diag.effectiveMinSummerMoisturePct}% Jul moisture): suited for ${topNames}.`;

  return {
    producedCropIds,
    defaultCurrentCropIds: [c1, c2, c3, c1],
    localProductionNote,
  };
}

const CROP_SYNONYM_MAP: Array<{ keywords: string[]; cropId: string }> = [
  { keywords: ["sorghum", "millet", "hirse", "milo", "sudan"], cropId: "grain_sorghum" },
  { keywords: ["chickpea", "garbanzo", "kichererbse", "gram"], cropId: "chickpea" },
  { keywords: ["lentil", "linse", "alb-leisa", "leisa", "masoor"], cropId: "lentil_ansa" },
  { keywords: ["rye", "roggen"], cropId: "winter_rye" },
  { keywords: ["oat", "hafer"], cropId: "spring_oats" },
  { keywords: ["durum", "pasta wheat", "hartweizen", "semolina"], cropId: "durum_wheat" },
  { keywords: ["alfalfa", "lucerne", "luzerne", "clover", "kleegras"], cropId: "alfalfa_lucerne" },
  { keywords: ["lupin", "lupine", "suesslupine", "süßlupine"], cropId: "white_lupin" },
  { keywords: ["potato", "kartoffel"], cropId: "table_potato" },
  { keywords: ["rice", "reis", "paddy"], cropId: "paddy_rice" },
  { keywords: ["cotton", "baumwolle"], cropId: "cotton_crop" },
  { keywords: ["soy", "soja", "edamame"], cropId: "soybean_bw" },
  { keywords: ["sunflower", "sonnenblume"], cropId: "sunflower_bw" },
  { keywords: ["spelt", "dinkel"], cropId: "swabian_spelt" },
  { keywords: ["pea", "erbse"], cropId: "field_pea" },
  { keywords: ["faba", "fava", "field bean", "broad bean", "ackerbohne"], cropId: "field_bean" },
  { keywords: ["malting", "braugerste", "spring barley", "sommergerste"], cropId: "malting_barley" },
  { keywords: ["winter barley", "wintergerste"], cropId: "winter_barley" },
  { keywords: ["rapeseed", "canola", "raps"], cropId: "winter_rapeseed" },
  { keywords: ["corn", "maize", "mais"], cropId: "grain_maize" },
  { keywords: ["sugar beet", "zuckerrübe", "zuckerruebe", "beet"], cropId: "sugar_beet_cover" },
  { keywords: ["wheat", "weizen"], cropId: "winter_wheat" },
];

const SPECIALTY_CUSTOM_PRESETS: Record<
  string,
  Omit<CropSpec, "id" | "isCustomCrop">
> = {
  buckwheat: {
    name: "Buckwheat (Buchweizen)",
    germanSub: "Buchweizen + Winterbegrünung",
    imageUrl: "/images/crop-spelt.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Low-Input Short-Season Pseudocereal",
    nDemandKgHa: 50,
    nFixedCreditKgHa: 0,
    waterNeedMm: 310,
    heatToleranceScore: 8,
    droughtToleranceScore: 8,
    erosionShieldScore: 7,
    baseYieldTonsHa: 2.6,
    pricePerTonEur: 520,
    seedAndOpsCostEurHa: 430,
    localBuyers: "Gluten-Free Food Mills & Regional Health-Grain Buyers",
    growingWindow: "May – Sep",
    plainRole: "Fast-growing pollinator-friendly pseudocereal needing minimal Nitrogen and low water.",
    coverCropIncluded: "Phacelia-Clover Winter Cover",
    coverCropCostEurHa: 72,
    coverCropNRetentionKgHa: 28,
  },
  hemp: {
    name: "Industrial Hemp (Nutzhanf)",
    germanSub: "Nutzhanf (Körner/Faser)",
    imageUrl: "/images/crop-soybean.jpg",
    family: "oilseed",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Deep-Taproot Weed Suppressor",
    nDemandKgHa: 90,
    nFixedCreditKgHa: 10,
    waterNeedMm: 340,
    heatToleranceScore: 9,
    droughtToleranceScore: 8,
    erosionShieldScore: 9,
    baseYieldTonsHa: 1.4,
    pricePerTonEur: 1150,
    seedAndOpsCostEurHa: 690,
    localBuyers: "Food Hempseed Oil Mills & Bio-Fiber Processors",
    growingWindow: "Apr – Sep",
    plainRole: "2m taproot breaks compacted subsoil, suppresses weeds without herbicides, and tolerates dry summers.",
    coverCropIncluded: "Rye-Vetch Winter Cover",
    coverCropCostEurHa: 74,
    coverCropNRetentionKgHa: 28,
  },
  camelina: {
    name: "Camelina (Leindotter)",
    germanSub: "Leindotter (Ölfrucht)",
    imageUrl: "/images/crop-rapeseed.jpg",
    family: "oilseed",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Ultra-Low-Water Oilseed",
    nDemandKgHa: 65,
    nFixedCreditKgHa: 0,
    waterNeedMm: 290,
    heatToleranceScore: 8,
    droughtToleranceScore: 9,
    erosionShieldScore: 8,
    baseYieldTonsHa: 2.1,
    pricePerTonEur: 590,
    seedAndOpsCostEurHa: 440,
    localBuyers: "Specialty Omega-3 Oil Mills & Intercrop Cleaners",
    growingWindow: "Mar – Jul",
    plainRole: "Drought-hardy Swabian heritage oilseed requiring minimal water and Nitrogen.",
    coverCropIncluded: "Clover-Oat Winter Cover",
    coverCropCostEurHa: 72,
    coverCropNRetentionKgHa: 28,
  },
  flax: {
    name: "Oilseed Flax / Linseed (Öllein)",
    germanSub: "Öllein (Leinsamen)",
    imageUrl: "/images/crop-rapeseed.jpg",
    family: "oilseed",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Low-Nitrogen Food Oilseed",
    nDemandKgHa: 70,
    nFixedCreditKgHa: 0,
    waterNeedMm: 350,
    heatToleranceScore: 7,
    droughtToleranceScore: 7,
    erosionShieldScore: 7,
    baseYieldTonsHa: 2.2,
    pricePerTonEur: 560,
    seedAndOpsCostEurHa: 470,
    localBuyers: "Regional Food Oil Mills & Bakery Seed Buyers",
    growingWindow: "Mar – Aug",
    plainRole: "Healthy non-brassica oilseed break crop with low fertilizer demand.",
    coverCropIncluded: "Mustard-Phacelia Winter Cover",
    coverCropCostEurHa: 72,
    coverCropNRetentionKgHa: 28,
  },
  triticale: {
    name: "Winter Triticale",
    germanSub: "Wintertriticale",
    imageUrl: "/images/crop-wheat.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Resilient Wheat×Rye Hybrid",
    nDemandKgHa: 135,
    nFixedCreditKgHa: 0,
    waterNeedMm: 380,
    heatToleranceScore: 8,
    droughtToleranceScore: 8,
    erosionShieldScore: 8,
    baseYieldTonsHa: 7.8,
    pricePerTonEur: 212,
    seedAndOpsCostEurHa: 550,
    localBuyers: "Regional Feed Co-ops & Livestock Producers",
    growingWindow: "Sep – Jul",
    plainRole: "Combines Wheat yield potential with Rye drought hardiness and strong ground cover.",
  },
  quinoa: {
    name: "Quinoa",
    germanSub: "Quinoa + Winterbegrünung",
    imageUrl: "/images/crop-sorghum.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Drought-Tolerant Specialty Grain",
    nDemandKgHa: 85,
    nFixedCreditKgHa: 0,
    waterNeedMm: 300,
    heatToleranceScore: 8,
    droughtToleranceScore: 9,
    erosionShieldScore: 6,
    baseYieldTonsHa: 2.3,
    pricePerTonEur: 820,
    seedAndOpsCostEurHa: 620,
    localBuyers: "Direct Food-Grain Cleaners & Organic/Regio Retail",
    growingWindow: "Apr – Sep",
    plainRole: "Drought-hardy specialty grain suited to well-drained soils and warm dry summers.",
    coverCropIncluded: "Clover-Phacelia Winter Mulch",
    coverCropCostEurHa: 74,
    coverCropNRetentionKgHa: 28,
  },
  cabbage: {
    name: "Pointed Cabbage (Filderkraut)",
    germanSub: "Filderspitzkraut / Kopfkohl",
    imageUrl: "/images/crop-legume-cover.jpg",
    family: "oilseed",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Filder PGI Specialty Vegetable",
    nDemandKgHa: 210,
    nFixedCreditKgHa: 0,
    waterNeedMm: 520,
    heatToleranceScore: 6,
    droughtToleranceScore: 5,
    erosionShieldScore: 4,
    baseYieldTonsHa: 58.0,
    pricePerTonEur: 145,
    seedAndOpsCostEurHa: 3400,
    localBuyers: "Filder Sauerkraut Processors & Regional Fresh Markets",
    growingWindow: "May – Oct",
    plainRole: "High-demand Filder specialty brassica vegetable requiring a strict 4-year clubroot rotation break.",
  },
  filderkraut: {
    name: "Filderkraut Cabbage",
    germanSub: "Filderkraut (g.g.A.)",
    imageUrl: "/images/crop-legume-cover.jpg",
    family: "oilseed",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Filder PGI Specialty Vegetable",
    nDemandKgHa: 210,
    nFixedCreditKgHa: 0,
    waterNeedMm: 520,
    heatToleranceScore: 6,
    droughtToleranceScore: 5,
    erosionShieldScore: 4,
    baseYieldTonsHa: 58.0,
    pricePerTonEur: 145,
    seedAndOpsCostEurHa: 3400,
    localBuyers: "Filder Sauerkraut Processors & Regional Fresh Markets",
    growingWindow: "May – Oct",
    plainRole: "Protected Filder pointed cabbage requiring high N and a 4-year brassica clubroot break.",
  },
  clover: {
    name: "Clover-Grass Ley (Kleegras)",
    germanSub: "Kleegras-Ackerfutter",
    imageUrl: "/images/crop-legume-cover.jpg",
    family: "legume",
    isLegume: true,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Humus & Nitrogen Builder (+80 kg N)",
    nDemandKgHa: 0,
    nFixedCreditKgHa: 80,
    waterNeedMm: 450,
    heatToleranceScore: 7,
    droughtToleranceScore: 7,
    erosionShieldScore: 10,
    baseYieldTonsHa: 9.5,
    pricePerTonEur: 135,
    seedAndOpsCostEurHa: 430,
    localBuyers: "Dairy Farms, Biogas Co-ops & On-Farm Forage",
    growingWindow: "Year-Round Sod",
    plainRole: "Perennial forage legume-grass sod that builds topsoil humus and fixes +80 kg N/ha.",
  },
  kleegras: {
    name: "Clover-Grass Ley (Kleegras)",
    germanSub: "Kleegras-Ackerfutter",
    imageUrl: "/images/crop-legume-cover.jpg",
    family: "legume",
    isLegume: true,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Humus & Nitrogen Builder (+80 kg N)",
    nDemandKgHa: 0,
    nFixedCreditKgHa: 80,
    waterNeedMm: 450,
    heatToleranceScore: 7,
    droughtToleranceScore: 7,
    erosionShieldScore: 10,
    baseYieldTonsHa: 9.5,
    pricePerTonEur: 135,
    seedAndOpsCostEurHa: 430,
    localBuyers: "Dairy Farms, Biogas Co-ops & On-Farm Forage",
    growingWindow: "Year-Round Sod",
    plainRole: "Perennial forage legume-grass sod that builds topsoil humus and fixes +80 kg N/ha.",
  },
  silage: {
    name: "Silage Maize (Silomais)",
    germanSub: "Silomais (Futter / Biogas)",
    imageUrl: "/images/crop-sorghum.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: false,
    bwRecommendationTag: "High Water & Erosion Risk",
    nDemandKgHa: 185,
    nFixedCreditKgHa: 0,
    waterNeedMm: 540,
    heatToleranceScore: 7,
    droughtToleranceScore: 4,
    erosionShieldScore: 2,
    baseYieldTonsHa: 44.0,
    pricePerTonEur: 44,
    seedAndOpsCostEurHa: 980,
    localBuyers: "Regional Livestock & Biogas Plants",
    growingWindow: "May – Sep (Bare Spring)",
    plainRole: "High-biomass forage/biogas maize with wide bare spring rows and high Nitrogen demand.",
  },
};

export interface CustomCropUserParams {
  rawName: string;
  family: CropSpec["family"];
  waterNeedLevel: "low" | "medium" | "high";
  heatPreference: "cool" | "moderate" | "hot";
  pricePerTonEur?: number;
  includeWinterCover?: boolean;
}

export const QUICK_TEST_CROP_IDS = [
  "grain_sorghum",
  "chickpea",
  "lentil_ansa",
  "winter_rye",
  "table_potato",
  "white_lupin",
  "paddy_rice",
] as const;

export function buildOrResolveCustomCrop(
  params: CustomCropUserParams
): CropSpec {
  const clean = params.rawName.trim();
  const lower = clean.toLowerCase();

  // 1. Direct ID match in catalog
  if (CROPS_STUTTGART[lower]) {
    const base = CROPS_STUTTGART[lower];
    return {
      ...base,
      pricePerTonEur: params.pricePerTonEur ?? base.pricePerTonEur,
      isCustomCrop: true,
    };
  }

  // 2. Specialty preset match (Buckwheat, Hemp, Camelina, Flax, Triticale, Quinoa)
  for (const [key, spec] of Object.entries(SPECIALTY_CUSTOM_PRESETS)) {
    if (lower.includes(key)) {
      return {
        ...spec,
        id: `custom_${key}`,
        pricePerTonEur: params.pricePerTonEur ?? spec.pricePerTonEur,
        isCustomCrop: true,
      };
    }
  }

  // 3. Synonym match to calibrated catalog crop
  for (const entry of CROP_SYNONYM_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      const base = CROPS_STUTTGART[entry.cropId];
      if (base) {
        return {
          ...base,
          pricePerTonEur: params.pricePerTonEur ?? base.pricePerTonEur,
          isCustomCrop: true,
        };
      }
    }
  }

  // 4. Fully user-defined custom crop synthesized from agronomic parameters
  const slug =
    "custom_" +
    lower
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 28);

  const isLegume = params.family === "legume";
  const waterNeedMm =
    params.waterNeedLevel === "low"
      ? 315
      : params.waterNeedLevel === "high"
      ? 560
      : 420;
  const droughtScore =
    params.waterNeedLevel === "low"
      ? 9
      : params.waterNeedLevel === "high"
      ? 4
      : 7;
  const heatScore =
    params.heatPreference === "hot"
      ? 9
      : params.heatPreference === "cool"
      ? 5
      : 7;

  const defaultYieldByFamily: Record<CropSpec["family"], number> = {
    cereal: 6.4,
    legume: 3.0,
    oilseed: 3.1,
    root: 42.0,
  };
  const defaultPriceByFamily: Record<CropSpec["family"], number> = {
    cereal: 255,
    legume: 420,
    oilseed: 455,
    root: 110,
  };
  const defaultOpsCostByFamily: Record<CropSpec["family"], number> = {
    cereal: 560,
    legume: 530,
    oilseed: 580,
    root: 1650,
  };

  const imageByFamily: Record<CropSpec["family"], string> = {
    cereal: "/images/crop-spelt.jpg",
    legume: "/images/crop-legume-cover.jpg",
    oilseed: "/images/crop-sunflower.jpg",
    root: "/images/crop-sugarbeet.jpg",
  };

  const includeCover = params.includeWinterCover ?? true;

  return {
    id: slug || "custom_user_crop",
    name: clean || "Custom Crop",
    germanSub: `${clean || "Eigene Kultur"}${includeCover ? " + Zwischenfrucht" : ""}`,
    imageUrl: imageByFamily[params.family],
    family: params.family,
    isLegume,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Farmer Custom Crop",
    nDemandKgHa: isLegume ? 0 : params.family === "oilseed" ? 115 : 130,
    nFixedCreditKgHa: isLegume ? 65 : params.family === "oilseed" ? 10 : 0,
    waterNeedMm,
    heatToleranceScore: heatScore,
    droughtToleranceScore: droughtScore,
    erosionShieldScore: includeCover ? 8 : params.family === "root" ? 3 : 6,
    baseYieldTonsHa: defaultYieldByFamily[params.family],
    pricePerTonEur:
      params.pricePerTonEur ?? defaultPriceByFamily[params.family],
    seedAndOpsCostEurHa: defaultOpsCostByFamily[params.family],
    localBuyers: "Custom Farmer Direct / Regional Contract",
    growingWindow: includeCover ? "Aug (Cover) → Mar – Aug" : "Mar – Aug",
    plainRole: `User-added ${params.family} crop evaluated against live farm soil moisture, summer heat, pH, and slope.`,
    coverCropIncluded: includeCover ? "Mustard-Clover Winter Cover" : undefined,
    coverCropCostEurHa: includeCover ? 74 : undefined,
    coverCropNRetentionKgHa: includeCover ? 30 : undefined,
    isCustomCrop: true,
  };
}
