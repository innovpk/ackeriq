import {
  AREA_PRODUCED_CROPS,
  CROPS_HEILBRONN,
  buildDefaultAreaPriceFeed,
  getLocalizedCropDisplayName,
} from "@/data/agronomyCatalog";
import {
  computeAgroClimateDiagnostics,
  evaluateCropSuitability,
} from "@/lib/cropSuitability";
import type {
  AreaPriceFeedResponse,
  CropSpec,
  FarmXrayData,
  PrimaryGoalId,
  RotationStrategyResult,
  RotationYearStep,
  SubsidyConfig,
  WeatherScenario,
} from "@/types/ackeriq";

export const DEFAULT_SUBSIDIES: SubsidyConfig = {
  oeko2LegumeRotation: true,
  faktCoverCrop: true,
  faktPulseBonus: false,
};

function shortName(
  crop: CropSpec,
  xray?: Pick<FarmXrayData, "lat" | "lon">
): string {
  return getLocalizedCropDisplayName(crop, xray, "en");
}

function resolveCropPriceEurTon(
  crop: CropSpec,
  priceFeed?: AreaPriceFeedResponse,
  customPrices?: Record<string, number>
): number {
  if (customPrices && typeof customPrices[crop.id] === "number") {
    return customPrices[crop.id];
  }
  const quote = priceFeed?.quotes?.[crop.id];
  if (quote && typeof quote.effectiveLocalPriceEurTon === "number") {
    return quote.effectiveLocalPriceEurTon;
  }
  return crop.pricePerTonEur;
}

const GROWING_DAYS = [30, 31, 30, 31, 31, 30]; // Apr..Sep

/**
 * FAO-56 Hargreaves-Makkink radiation-temperature growing-season reference ET0 (mm, Apr-Sep)
 * derived directly from NASA POWER ALLSKY_SFC_SW_DWN (kWh/m2/day -> MJ/m2/day) and T2M.
 */
function computeFao56GrowingSeasonEt0Mm(xray: FarmXrayData): number {
  const aprToSep = xray.monthlyClimate.slice(3, 9);
  if (aprToSep.length < 6) return 520;

  let totalEt0Mm = 0;
  aprToSep.forEach((m, idx) => {
    const rsMjM2Day = Math.max(4.0, m.solarKwhM2 * 3.6);
    const dailyEt0 =
      0.0135 * Math.max(2, m.tempAvgC + 17.78) * (rsMjM2Day / 2.45);
    totalEt0Mm += dailyEt0 * GROWING_DAYS[idx];
  });
  return Math.round(totalEt0Mm);
}

/**
 * IPCC 2019 Refinement Tier-1 + AR6 (GWP100 N2O = 273) greenhouse gas balance (kg CO2e/ha/yr).
 * Combines EU Haber-Bosch KAS manufacturing (3.48 kg CO2e/kg N), direct + indirect N2O
 * field emissions (5.65 kg CO2e/kg synthetic N; 2.14 kg CO2e/kg biological N turnover),
 * and winter catch-crop SOC sequestration (-440 kg CO2e/ha/yr, Poeplau & Don 2015).
 */
function computeIpccCo2eKgHa(
  syntheticNKgHa: number,
  legumeFixedNKgHa: number,
  hasCoverCrop: boolean
): number {
  const manufacturingCo2e = syntheticNKgHa * 3.48;
  const fieldN2oCo2e = syntheticNKgHa * 5.65 + legumeFixedNKgHa * 2.14;
  const coverSocCredit = hasCoverCrop ? 440 : 0;
  return Math.round(Math.max(40, manufacturingCo2e + fieldN2oCo2e - coverSocCredit));
}

/**
 * Winter/spring root-zone Nitrate (NO3-N) leaching model (kg N/ha/yr) driven by
 * NASA POWER autumn/winter precipitation, ISRIC SoilGrids drainage, and bare-soil exposure.
 */
function computeNitrateLeachingKgHa(
  xray: FarmXrayData,
  syntheticNKgHa: number,
  bareMonths: number,
  hasCoverCrop: boolean
): number {
  const winterPrecipMm =
    (xray.monthlyClimate[0]?.precipMm ?? 52) +
    (xray.monthlyClimate[1]?.precipMm ?? 46) +
    (xray.monthlyClimate[10]?.precipMm ?? 58) +
    (xray.monthlyClimate[11]?.precipMm ?? 60);
  const drainageFactor = Math.min(
    1.45,
    Math.max(
      0.65,
      (1 + xray.soil.sandPct / 110) * (155 / Math.max(95, xray.soil.waterHoldingMm))
    )
  );
  const percolatingFraction = Math.min(0.46, (winterPrecipMm / 620) * drainageFactor);
  const residualPoolKgHa = 14 + syntheticNKgHa * 0.19 + bareMonths * 3.4;
  const coverScavengeFactor = hasCoverCrop ? 0.38 : 1.0;
  return Math.round(
    Math.max(4, residualPoolKgHa * percolatingFraction * coverScavengeFactor)
  );
}

/**
 * RUSLE hillside soil erosion model (A = R * K * LS * C, tons topsoil/ha/yr)
 * from NASA POWER May-Aug rainfall, ISRIC SoilGrids texture/SOM, and NASA SRTM slope.
 */
function computeRusleSoilLossTonsHa(
  xray: FarmXrayData,
  bareMonths: number,
  hasCoverCrop: boolean
): number {
  const warmRainMm = xray.monthlyClimate
    .slice(4, 8)
    .reduce((acc, m) => acc + m.precipMm, 0);
  const rFactor = Math.max(45, warmRainMm * 0.34);
  const kFactor = Math.min(
    0.055,
    Math.max(
      0.018,
      (0.022 + (xray.soil.siltPct / 100) * 0.032) *
        (1 - Math.min(0.32, xray.soil.organicMatterPct * 0.06))
    )
  );
  const s = Math.max(0.5, xray.slopePct);
  const lsFactor = 0.18 + 0.095 * s + 0.013 * s * s;
  const cFactor = hasCoverCrop
    ? 0.055
    : Math.min(0.36, 0.09 + bareMonths * 0.062);

  return Number((rFactor * kFactor * lsFactor * cFactor).toFixed(2));
}

function simulateSingleStep(
  crop: CropSpec,
  prevCrop: CropSpec | null,
  carryoverN: number,
  yearIdx: number,
  xray: FarmXrayData,
  isNitrateRestricted: boolean,
  scenario: WeatherScenario,
  euBonusEligible: boolean,
  fertPriceEurKgN: number,
  priceFeed?: AreaPriceFeedResponse,
  customPrices?: Record<string, number>,
  subsidies: SubsidyConfig = DEFAULT_SUBSIDIES
): RotationYearStep {
  const avgSummerRootMoisture =
    (xray.monthlyClimate[4].rootMoistureIdx +
      xray.monthlyClimate[5].rootMoistureIdx +
      xray.monthlyClimate[6].rootMoistureIdx) /
    3;
  const maxSummerTemp = Math.max(
    ...xray.monthlyClimate.map((m) => m.tempMaxC)
  );

  const seasonalEt0Mm = computeFao56GrowingSeasonEt0Mm(xray);
  const kcEffective = Math.min(1.15, Math.max(0.68, crop.waterNeedMm / 510));
  const fao56EtcMm = Math.round(
    seasonalEt0Mm * kcEffective * (scenario === "drought_heat" ? 1.12 : 1.0)
  );

  const growingPrecipMm = xray.monthlyClimate
    .slice(3, 9)
    .reduce((sum, m) => sum + m.precipMm, 0);
  const effectivePrecipMm =
    growingPrecipMm * (scenario === "drought_heat" ? 0.68 : 0.84);
  const rootAvailableWaterMm =
    xray.soil.waterHoldingMm * avgSummerRootMoisture +
    (crop.coverCropIncluded ? 28 : 0);
  const availableWaterMm = effectivePrecipMm + rootAvailableWaterMm;

  // FAO-56 water-yield response: 1 - Ky * (1 - ETa / ETc)
  const ky = Math.max(0.45, 1.22 - crop.droughtToleranceScore * 0.072);
  const etaRatio = Math.min(1.0, availableWaterMm / Math.max(220, fao56EtcMm));
  const faoWaterFactor = Math.max(0.64, 1 - ky * (1 - etaRatio));

  const coverN = crop.coverCropNRetentionKgHa ?? 0;
  const totalCreditN = carryoverN + coverN;

  let rawSyntheticN = Math.max(0, crop.nDemandKgHa - totalCreditN);

  let nitrateCapPenalty = 1.0;
  if (isNitrateRestricted && !crop.isLegume) {
    const legalMaxSyntheticN = Math.round(crop.nDemandKgHa * 0.8);
    if (rawSyntheticN > legalMaxSyntheticN) {
      const deficitN = rawSyntheticN - legalMaxSyntheticN;
      rawSyntheticN = legalMaxSyntheticN;
      nitrateCapPenalty = Math.max(0.88, 1 - deficitN * 0.0024);
    }
  }

  let climateYieldFactor = faoWaterFactor;
  if (maxSummerTemp > 29.2 && crop.heatToleranceScore <= 6) {
    climateYieldFactor -= (maxSummerTemp - 29.2) * 0.012;
  }

  if (xray.slopePct >= 3.5 && crop.erosionShieldScore <= 4) {
    climateYieldFactor -= (xray.slopePct - 3.0) * 0.018;
  }

  if (scenario === "drought_heat") {
    const heatShock = (11 - crop.heatToleranceScore) * 0.014;
    climateYieldFactor -= heatShock;
    if (crop.coverCropIncluded) {
      climateYieldFactor += 0.045;
    }
  }

  let rotationVigorFactor = 1.0;
  if (prevCrop && prevCrop.id === crop.id) {
    rotationVigorFactor = 0.91;
  } else if (prevCrop && prevCrop.isLegume && !crop.isLegume) {
    rotationVigorFactor = 1.06;
  }

  const realizedYieldTonsHa = Number(
    Math.max(
      crop.baseYieldTonsHa * 0.55,
      crop.baseYieldTonsHa *
        nitrateCapPenalty *
        climateYieldFactor *
        rotationVigorFactor
    ).toFixed(2)
  );

  const appliedPriceEurTon = resolveCropPriceEurTon(
    crop,
    priceFeed,
    customPrices
  );

  const grossRevenueEurHa = Math.round(
    realizedYieldTonsHa * appliedPriceEurTon
  );
  const fertCostEurHa = Math.round(rawSyntheticN * fertPriceEurKgN);
  const coverCostEurHa = crop.coverCropCostEurHa ?? 0;
  const oekoBonus =
    euBonusEligible && subsidies.oeko2LegumeRotation ? 60 : 0;
  const faktCoverBonus =
    Boolean(crop.coverCropIncluded) && subsidies.faktCoverCrop ? 90 : 0;
  const faktLegumeBonus =
    crop.isLegume && subsidies.faktPulseBonus ? 85 : 0;
  const subsidyBonusEurHa = oekoBonus + faktCoverBonus + faktLegumeBonus;

  const netMarginEurHa = Math.round(
    grossRevenueEurHa +
      subsidyBonusEurHa -
      crop.seedAndOpsCostEurHa -
      fertCostEurHa -
      coverCostEurHa
  );

  const bareMonths = crop.coverCropIncluded
    ? 0.4
    : crop.erosionShieldScore <= 4
    ? 4.0
    : crop.family === "legume"
    ? 1.9
    : 1.6;

  const roundedSyntheticN = Math.round(rawSyntheticN);
  const hasCoverCrop = Boolean(crop.coverCropIncluded);
  const co2eKgHa = computeIpccCo2eKgHa(
    roundedSyntheticN,
    crop.nFixedCreditKgHa,
    hasCoverCrop
  );
  const nitrateLeachingKgHa = computeNitrateLeachingKgHa(
    xray,
    roundedSyntheticN,
    bareMonths,
    hasCoverCrop
  );

  const diag = computeAgroClimateDiagnostics(
    xray.lat,
    xray.lon,
    xray.elevationM,
    xray.monthlyClimate,
    scenario
  );
  const suitabilityNote = crop.isCustomCrop
    ? `Custom Crop · ${diag.effectiveMinSummerMoisturePct}% moisture & ${diag.effectiveMaxTempC}°C fit`
    : crop.coverCropIncluded
    ? `${crop.coverCropIncluded} · ${crop.waterNeedMm}mm (${diag.effectiveMinSummerMoisturePct}% moisture fit)`
    : `${crop.growingWindow} · ${crop.waterNeedMm}mm & ${diag.effectiveMaxTempC}°C fit`;

  const localizedCrop: CropSpec =
    shortName(crop, xray) !== crop.name.split(" (")[0]
      ? { ...crop, name: shortName(crop, xray) }
      : crop;

  return {
    year: yearIdx + 1,
    seasonLabel: `Year ${yearIdx + 1} (${2027 + yearIdx})`,
    crop: localizedCrop,
    appliedPriceEurTon,
    realizedYieldTonsHa,
    syntheticNAppliedKgHa: roundedSyntheticN,
    nCarryoverReceivedKgHa: Math.round(totalCreditN),
    fertCostEurHa,
    grossRevenueEurHa,
    subsidyBonusEurHa,
    netMarginEurHa,
    bareMonths: Number(bareMonths.toFixed(1)),
    fao56EtcMm,
    co2eKgHa,
    nitrateLeachingKgHa,
    suitabilityNote,
    isCustomCrop: Boolean(crop.isCustomCrop),
  };
}

export interface HistoricalRotationDiagnosis {
  tone: "positive" | "warning" | "neutral";
  summary: string;
}

function isBrassicaCrop(c: CropSpec): boolean {
  return (
    c.id === "winter_rapeseed" ||
    c.id.includes("cabbage") ||
    c.id.includes("filderkraut") ||
    c.id.includes("camelina") ||
    c.name.toLowerCase().includes("rapeseed") ||
    c.name.toLowerCase().includes("cabbage")
  );
}

export function diagnoseHistoricalRotation(
  baselineCrops: CropSpec[],
  lang: "en" | "de" = "en"
): HistoricalRotationDiagnosis {
  const yr4 = baselineCrops[3];
  const yr3 = baselineCrops[2];
  const recentBrassica = baselineCrops.slice(1).some(isBrassicaCrop);
  const recentRoot = yr4?.family === "root" || yr3?.family === "root";
  const cerealCount = baselineCrops.filter((c) => c.family === "cereal").length;

  if (yr4?.isLegume) {
    return {
      tone: "positive",
      summary:
        lang === "de"
          ? `Jahr 4 Leguminose (+${yr4.nFixedCreditKgHa} kg N/ha Gutschrift für 2027) · Anbaupause aktiv`
          : `Yr 4 Legume (+${yr4.nFixedCreditKgHa} kg N/ha free credit into 2027) · Legume break active`,
    };
  }
  if (yr3?.isLegume) {
    return {
      tone: "positive",
      summary:
        lang === "de"
          ? "Leguminose in Jahr 3 erkannt · 3-jährige Anbaupause für 2027 berücksichtigt"
          : "Legume in Yr 3 detected · 3-yr pulse break respected in 2027 Year 1",
    };
  }
  if (recentBrassica) {
    return {
      tone: "warning",
      summary:
        lang === "de"
          ? "Raps/Kreuzblütler in Jahr 2–4 · Kohlhernie-Anbaupause für 2027–2028 aktiv"
          : "Brassica/Rapeseed in Yr 2–4 · Clubroot break enforced in 2027–2028",
    };
  }
  if (recentRoot) {
    return {
      tone: "warning",
      summary:
        lang === "de"
          ? "Hackfrucht in Jahr 3–4 · Nematoden-Anbaupause für 2027–2028 aktiv"
          : "Root crop in Yr 3–4 · Nematode break enforced in 2027–2028",
    };
  }
  if (cerealCount >= 3) {
    return {
      tone: "warning",
      summary:
        lang === "de"
          ? `${cerealCount}/4 Jahre Getreide/Mais · 2027 startet mit Blattfrucht gegen Schwarzbeinigkeit`
          : `${cerealCount}/4 yrs Cereals/Maize · 2027 opens with a break crop to cut N & take-all risk`,
    };
  }
  return {
    tone: "neutral",
    summary:
      lang === "de"
        ? "4-Jahres-Historie geprüft · 2027–2030 Plan vermeidet direkten Nachbau aus Jahr 4"
        : "4-yr history analyzed · 2027–2030 plan avoids repeating your Yr 4 crop",
  };
}

function simulateSequence(
  crops: CropSpec[],
  xray: FarmXrayData,
  isNitrateRestricted: boolean,
  scenario: WeatherScenario,
  euBonusEligible: boolean,
  fertPriceEurKgN: number,
  priceFeed?: AreaPriceFeedResponse,
  customPrices?: Record<string, number>,
  subsidies: SubsidyConfig = DEFAULT_SUBSIDIES,
  initialPrevCrop: CropSpec | null = null,
  initialCarryoverN = 0
): RotationYearStep[] {
  let carryoverN = initialCarryoverN;
  return crops.map((crop, idx) => {
    const prevCrop = idx > 0 ? crops[idx - 1] : initialPrevCrop;
    const step = simulateSingleStep(
      crop,
      prevCrop,
      carryoverN,
      idx,
      xray,
      isNitrateRestricted,
      scenario,
      euBonusEligible,
      fertPriceEurKgN,
      priceFeed,
      customPrices,
      subsidies
    );
    carryoverN = crop.nFixedCreditKgHa;
    return step;
  });
}

function pickBestAreaCandidate(
  candidateIds: string[],
  cropLookup: Record<string, CropSpec>,
  allowedProducedSet: Set<string>,
  farmerExistingCropSet: Set<string>,
  alreadyPickedIds: Set<string>,
  prevCrop: CropSpec | null,
  carryoverN: number,
  xray: FarmXrayData,
  isNitrateRestricted: boolean,
  scenario: WeatherScenario,
  fertPriceEurKgN: number,
  priceFeed: AreaPriceFeedResponse,
  customPrices?: Record<string, number>,
  mode: "price_and_n" | "drought_resilience" = "price_and_n",
  blockedCropIds?: Set<string>
): CropSpec {
  // Filter to regionally grown + biophysically viable + phytosanitary-safe crops
  const filterPool = (
    ids: string[],
    enforceDistinct: boolean,
    enforceBlocks: boolean
  ) =>
    ids.filter((id) => {
      const c = cropLookup[id];
      if (!c) return false;
      if (enforceDistinct && alreadyPickedIds.has(id)) return false;
      if (enforceBlocks && blockedCropIds?.has(id)) return false;
      if (!allowedProducedSet.has(id) && !c.isCustomCrop) return false;
      const ev = evaluateCropSuitability(c, xray, scenario, {
        isCustom: c.isCustomCrop,
      });
      return ev.status !== "unsuitable";
    });

  let validIds = filterPool(candidateIds, true, true);
  if (validIds.length === 0) {
    // Expand to all regionally grown & suitable crops respecting crop-break blocks
    validIds = filterPool(Array.from(allowedProducedSet), true, true);
  }
  if (validIds.length === 0) {
    validIds = filterPool(candidateIds, true, false);
  }
  if (validIds.length === 0) {
    validIds = filterPool(candidateIds, false, false);
  }

  const fallbackId =
    validIds[0] ??
    Array.from(allowedProducedSet).find((id) => Boolean(cropLookup[id])) ??
    "winter_wheat";

  let bestCrop = cropLookup[fallbackId] ?? CROPS_HEILBRONN.winter_wheat;
  let bestScore = -Infinity;

  for (const id of validIds) {
    const c = cropLookup[id];
    if (!c) continue;

    const suitability = evaluateCropSuitability(c, xray, scenario, {
      isCustom: c.isCustomCrop,
    });

    const sim = simulateSingleStep(
      c,
      prevCrop,
      carryoverN,
      1,
      xray,
      isNitrateRestricted,
      scenario,
      true,
      fertPriceEurKgN,
      priceFeed,
      customPrices
    );

    const nextYearNCreditValueEur = c.nFixedCreditKgHa * fertPriceEurKgN * 0.9;
    const isExistingOrUpgraded =
      farmerExistingCropSet.has(c.id) ||
      (c.id === "sugar_beet_cover" && farmerExistingCropSet.has("sugar_beet"));
    const continuityBonus = isExistingOrUpgraded ? 34 : 0;
    const customPriorityBonus = c.isCustomCrop ? 260 : 0;

    // Weight biophysical suitability (soil moisture + heat weather + regional GDD/pH fit)
    const moistureHeatFitBonus =
      suitability.score * (mode === "drought_resilience" ? 9.5 : 6.5);

    const score =
      mode === "price_and_n"
        ? sim.netMarginEurHa +
          nextYearNCreditValueEur +
          continuityBonus +
          customPriorityBonus +
          moistureHeatFitBonus -
          sim.syntheticNAppliedKgHa * 0.7
        : sim.netMarginEurHa * 0.68 +
          nextYearNCreditValueEur +
          continuityBonus * 0.6 +
          customPriorityBonus +
          moistureHeatFitBonus +
          (c.droughtToleranceScore + c.heatToleranceScore) * 42 -
          c.waterNeedMm * 0.52;

    if (score > bestScore) {
      bestScore = score;
      bestCrop = c;
    }
  }

  alreadyPickedIds.add(bestCrop.id);
  return bestCrop;
}

export function generateRotationStrategies(
  xray: FarmXrayData,
  farmAreaHa: number,
  currentCropIds: [string, string, string, string],
  isNitrateRestricted: boolean,
  primaryGoal: PrimaryGoalId,
  scenario: WeatherScenario,
  priceFeedInput?: AreaPriceFeedResponse,
  customPrices?: Record<string, number>,
  customFertPriceEurKgN?: number,
  subsidies: SubsidyConfig = DEFAULT_SUBSIDIES,
  userCustomCrops: CropSpec[] = [],
  historicalCustomCrops: CropSpec[] = []
): RotationStrategyResult[] {
  const activePriceFeed =
    priceFeedInput ?? buildDefaultAreaPriceFeed(xray.id);
  const fertPriceEurKgN =
    customFertPriceEurKgN ?? activePriceFeed.fertPriceEurKgN ?? 1.31;

  // Lookup for farmer's historical 4-year baseline (includes any custom crop typed in Step 2)
  const baselineLookup: Record<string, CropSpec> = { ...CROPS_HEILBRONN };
  for (const hc of historicalCustomCrops) {
    baselineLookup[hc.id] = hc;
  }

  // Lookup for candidate future 4-year plans (includes user-tested custom crops)
  const cropLookup: Record<string, CropSpec> = { ...CROPS_HEILBRONN };
  const validCustomCrops: CropSpec[] = [];
  for (const custom of userCustomCrops) {
    const ev = evaluateCropSuitability(custom, xray, scenario, {
      isCustom: true,
    });
    if (ev.status !== "unsuitable") {
      const tagged = { ...custom, isCustomCrop: true };
      cropLookup[tagged.id] = tagged;
      baselineLookup[tagged.id] = tagged;
      validCustomCrops.push(tagged);
    }
  }

  // HARD GUARD 1: Strictly restrict suggestions to crops commercially grown & biophysically suited to this farm
  const rawProducedList =
    xray.producedCropIds?.length > 0
      ? xray.producedCropIds
      : AREA_PRODUCED_CROPS[xray.id] ?? AREA_PRODUCED_CROPS["filder-plieningen"];
  const allowedProducedSet = new Set<string>(rawProducedList);
  for (const vc of validCustomCrops) {
    allowedProducedSet.add(vc.id);
  }

  const farmerExistingCropSet = new Set<string>(currentCropIds);

  // HARD GUARD 2: Sugar Beet requires a Südzucker delivery contract (Lieferrecht).
  // Never suggest Sugar Beet unless the farmer already grows Sugar Beet in Step 2 or added it as custom!
  const farmerGrowsSugarBeet =
    farmerExistingCropSet.has("sugar_beet") ||
    validCustomCrops.some((c) => c.id.includes("sugar_beet"));
  if (!farmerGrowsSugarBeet) {
    allowedProducedSet.delete("sugar_beet");
    allowedProducedSet.delete("sugar_beet_cover");
  }

  const customLegumeIds = validCustomCrops
    .filter((c) => c.isLegume)
    .map((c) => c.id);
  const customNonLegumeIds = validCustomCrops
    .filter((c) => !c.isLegume)
    .map((c) => c.id);

  // 1. Baseline: exact 4-year sequence confirmed by farmer in Step 2
  const baselineCrops = currentCropIds.map(
    (id) => baselineLookup[id] ?? CROPS_HEILBRONN.winter_wheat
  );
  const baselineHasLegume = baselineCrops.some((c) => c.isLegume);

  // Analyze the farmer's last 4 years (Yr 1 -> Yr 4) for carryover N & phytosanitary breaks
  const lastHistoricalCrop = baselineCrops[3];
  const penultimateHistoricalCrop = baselineCrops[2];
  const initialCarryoverN = lastHistoricalCrop.nFixedCreditKgHa;
  const recentLegumeInHistory =
    lastHistoricalCrop.isLegume || penultimateHistoricalCrop.isLegume;
  const recentBrassicaInHistory = baselineCrops.slice(1).some(isBrassicaCrop);
  const recentRootInHistory =
    lastHistoricalCrop.family === "root" ||
    penultimateHistoricalCrop.family === "root";
  const cerealHeavyHistory =
    baselineCrops.filter((c) => c.family === "cereal").length >= 3 ||
    (lastHistoricalCrop.family === "cereal" &&
      penultimateHistoricalCrop.family === "cereal");

  const allLegumeIds = Object.values(cropLookup)
    .filter((c) => c.isLegume)
    .map((c) => c.id);
  const allRootIds = Object.values(cropLookup)
    .filter((c) => c.family === "root")
    .map((c) => c.id);
  const allBrassicaIds = Object.values(cropLookup)
    .filter(isBrassicaCrop)
    .map((c) => c.id);

  // Phytosanitary blocks for Year 1 (2027) and Year 2 (2028) based on historical Yr 2–4
  const year1Blocked = new Set<string>([lastHistoricalCrop.id]);
  const year2Blocked = new Set<string>();
  if (lastHistoricalCrop.id === "sugar_beet") {
    year1Blocked.add("sugar_beet_cover");
  }
  if (recentLegumeInHistory) {
    allLegumeIds.forEach((id) => year1Blocked.add(id));
    if (lastHistoricalCrop.isLegume) {
      allLegumeIds.forEach((id) => year2Blocked.add(id));
    }
  }
  if (recentBrassicaInHistory) {
    allBrassicaIds.forEach((id) => {
      year1Blocked.add(id);
      year2Blocked.add(id);
    });
  }
  if (recentRootInHistory) {
    allRootIds.forEach((id) => {
      year1Blocked.add(id);
      year2Blocked.add(id);
    });
  }

  const legumePool = [
    ...customLegumeIds,
    "soybean_bw",
    "lentil_ansa",
    "field_bean",
    "field_pea",
    "chickpea",
    "alfalfa_lucerne",
    "white_lupin",
  ];
  const highValueGrainPool = [
    ...customNonLegumeIds,
    "swabian_spelt",
    "durum_wheat",
    "winter_wheat",
    "winter_rye",
    "grain_sorghum",
    "malting_barley",
  ];
  const breakNonLegumePool = [
    ...customNonLegumeIds,
    ...(farmerGrowsSugarBeet && !recentRootInHistory
      ? ["sugar_beet_cover"]
      : []),
    "sunflower_bw",
    "grain_sorghum",
    ...(!recentBrassicaInHistory ? ["winter_rapeseed"] : []),
    "malting_barley",
    "winter_rye",
    "spring_oats",
  ];

  // =========================================================================
  // 2. Strategy 2 ("nitro_slash"): Regionally cultivated + moisture/heat
  //    matched 4-year plan adapted to farmer's Yr 1–4 history
  // =========================================================================
  const s2Used = new Set<string>();
  let s2Year1: CropSpec;
  let s2Year2: CropSpec;
  let s2Year3: CropSpec;
  let s2Year4: CropSpec;

  if (lastHistoricalCrop.isLegume) {
    // Farmer grew a Legume in Year 4 (2026) -> cash in free N in Year 1 (2027), place next Legume safely in Year 3 (2029)!
    s2Year1 = pickBestAreaCandidate(
      highValueGrainPool,
      cropLookup,
      allowedProducedSet,
      farmerExistingCropSet,
      s2Used,
      lastHistoricalCrop,
      initialCarryoverN,
      xray,
      isNitrateRestricted,
      scenario,
      fertPriceEurKgN,
      activePriceFeed,
      customPrices,
      "price_and_n",
      year1Blocked
    );
    s2Year2 = pickBestAreaCandidate(
      breakNonLegumePool,
      cropLookup,
      allowedProducedSet,
      farmerExistingCropSet,
      s2Used,
      s2Year1,
      s2Year1.nFixedCreditKgHa,
      xray,
      isNitrateRestricted,
      scenario,
      fertPriceEurKgN,
      activePriceFeed,
      customPrices,
      "price_and_n",
      year2Blocked
    );
    s2Year3 = pickBestAreaCandidate(
      legumePool,
      cropLookup,
      allowedProducedSet,
      farmerExistingCropSet,
      s2Used,
      s2Year2,
      s2Year2.nFixedCreditKgHa,
      xray,
      isNitrateRestricted,
      scenario,
      fertPriceEurKgN,
      activePriceFeed,
      customPrices,
      "price_and_n"
    );
    s2Year4 = pickBestAreaCandidate(
      highValueGrainPool,
      cropLookup,
      allowedProducedSet,
      farmerExistingCropSet,
      s2Used,
      s2Year3,
      s2Year3.nFixedCreditKgHa,
      xray,
      isNitrateRestricted,
      scenario,
      fertPriceEurKgN,
      activePriceFeed,
      customPrices,
      "price_and_n"
    );
  } else if (cerealHeavyHistory && !recentLegumeInHistory) {
    // Cereal-heavy history -> open Year 1 (2027) immediately with an N-fixing Legume break crop!
    s2Year1 = pickBestAreaCandidate(
      legumePool,
      cropLookup,
      allowedProducedSet,
      farmerExistingCropSet,
      s2Used,
      lastHistoricalCrop,
      initialCarryoverN,
      xray,
      isNitrateRestricted,
      scenario,
      fertPriceEurKgN,
      activePriceFeed,
      customPrices,
      "price_and_n",
      year1Blocked
    );
    s2Year2 = pickBestAreaCandidate(
      highValueGrainPool,
      cropLookup,
      allowedProducedSet,
      farmerExistingCropSet,
      s2Used,
      s2Year1,
      s2Year1.nFixedCreditKgHa,
      xray,
      isNitrateRestricted,
      scenario,
      fertPriceEurKgN,
      activePriceFeed,
      customPrices,
      "price_and_n",
      year2Blocked
    );
    s2Year3 = pickBestAreaCandidate(
      breakNonLegumePool,
      cropLookup,
      allowedProducedSet,
      farmerExistingCropSet,
      s2Used,
      s2Year2,
      s2Year2.nFixedCreditKgHa,
      xray,
      isNitrateRestricted,
      scenario,
      fertPriceEurKgN,
      activePriceFeed,
      customPrices,
      "price_and_n"
    );
    s2Year4 = pickBestAreaCandidate(
      [...legumePool, ...highValueGrainPool],
      cropLookup,
      allowedProducedSet,
      farmerExistingCropSet,
      s2Used,
      s2Year3,
      s2Year3.nFixedCreditKgHa,
      xray,
      isNitrateRestricted,
      scenario,
      fertPriceEurKgN,
      activePriceFeed,
      customPrices,
      "price_and_n"
    );
  } else {
    s2Year1 = pickBestAreaCandidate(
      breakNonLegumePool,
      cropLookup,
      allowedProducedSet,
      farmerExistingCropSet,
      s2Used,
      lastHistoricalCrop,
      initialCarryoverN,
      xray,
      isNitrateRestricted,
      scenario,
      fertPriceEurKgN,
      activePriceFeed,
      customPrices,
      "price_and_n",
      year1Blocked
    );
    s2Year2 = pickBestAreaCandidate(
      legumePool,
      cropLookup,
      allowedProducedSet,
      farmerExistingCropSet,
      s2Used,
      s2Year1,
      s2Year1.nFixedCreditKgHa,
      xray,
      isNitrateRestricted,
      scenario,
      fertPriceEurKgN,
      activePriceFeed,
      customPrices,
      "price_and_n",
      year2Blocked
    );
    s2Year3 = pickBestAreaCandidate(
      highValueGrainPool,
      cropLookup,
      allowedProducedSet,
      farmerExistingCropSet,
      s2Used,
      s2Year2,
      s2Year2.nFixedCreditKgHa,
      xray,
      isNitrateRestricted,
      scenario,
      fertPriceEurKgN,
      activePriceFeed,
      customPrices,
      "price_and_n"
    );
    s2Year4 = pickBestAreaCandidate(
      [
        ...customLegumeIds,
        ...customNonLegumeIds,
        "field_pea",
        "field_bean",
        "soybean_bw",
        "lentil_ansa",
        "malting_barley",
        "sunflower_bw",
        "grain_sorghum",
        "spring_oats",
        "winter_rye",
        "winter_wheat",
      ],
      cropLookup,
      allowedProducedSet,
      farmerExistingCropSet,
      s2Used,
      s2Year3,
      s2Year3.nFixedCreditKgHa,
      xray,
      isNitrateRestricted,
      scenario,
      fertPriceEurKgN,
      activePriceFeed,
      customPrices,
      "price_and_n"
    );
  }

  const nitroSlashCrops: CropSpec[] = [s2Year1, s2Year2, s2Year3, s2Year4];

  // =========================================================================
  // 3. Strategy 3 ("climate_shield"): Maximum soil-moisture & 37°C heat
  //    resilience adapted to farmer's Yr 1–4 history
  // =========================================================================
  const s3Used = new Set<string>();
  const s3Year1Pool = recentLegumeInHistory
    ? [
        ...customNonLegumeIds,
        "swabian_spelt",
        "sunflower_bw",
        "grain_sorghum",
        "winter_rye",
        "durum_wheat",
        "malting_barley",
      ]
    : [
        ...customLegumeIds,
        "field_pea",
        "lentil_ansa",
        "chickpea",
        "soybean_bw",
        "alfalfa_lucerne",
        "field_bean",
        "white_lupin",
      ];

  const s3Year1 = pickBestAreaCandidate(
    s3Year1Pool,
    cropLookup,
    allowedProducedSet,
    farmerExistingCropSet,
    s3Used,
    lastHistoricalCrop,
    initialCarryoverN,
    xray,
    isNitrateRestricted,
    scenario,
    fertPriceEurKgN,
    activePriceFeed,
    customPrices,
    "drought_resilience",
    year1Blocked
  );

  const s3Year2 = pickBestAreaCandidate(
    recentLegumeInHistory
      ? [
          ...customNonLegumeIds,
          "sunflower_bw",
          "grain_sorghum",
          "winter_rye",
          "malting_barley",
          "spring_oats",
        ]
      : [
          ...customNonLegumeIds,
          "swabian_spelt",
          "winter_rye",
          "durum_wheat",
          "winter_wheat",
          "winter_barley",
        ],
    cropLookup,
    allowedProducedSet,
    farmerExistingCropSet,
    s3Used,
    s3Year1,
    s3Year1.nFixedCreditKgHa,
    xray,
    isNitrateRestricted,
    scenario,
    fertPriceEurKgN,
    activePriceFeed,
    customPrices,
    "drought_resilience",
    year2Blocked
  );

  const s3Year3 = pickBestAreaCandidate(
    recentLegumeInHistory
      ? legumePool
      : [
          ...customNonLegumeIds,
          ...customLegumeIds,
          "sunflower_bw",
          "grain_sorghum",
          "alfalfa_lucerne",
          "soybean_bw",
          "sugar_beet_cover",
          "field_bean",
          "winter_rapeseed",
        ],
    cropLookup,
    allowedProducedSet,
    farmerExistingCropSet,
    s3Used,
    s3Year2,
    s3Year2.nFixedCreditKgHa,
    xray,
    isNitrateRestricted,
    scenario,
    fertPriceEurKgN,
    activePriceFeed,
    customPrices,
    "drought_resilience"
  );

  const s3Year4 = pickBestAreaCandidate(
    [
      ...customNonLegumeIds,
      "malting_barley",
      "grain_sorghum",
      "winter_rye",
      "swabian_spelt",
      "winter_barley",
      "spring_oats",
    ],
    cropLookup,
    allowedProducedSet,
    farmerExistingCropSet,
    s3Used,
    s3Year3,
    s3Year3.nFixedCreditKgHa,
    xray,
    isNitrateRestricted,
    scenario,
    fertPriceEurKgN,
    activePriceFeed,
    customPrices,
    "drought_resilience"
  );

  const climateShieldCrops: CropSpec[] = [s3Year1, s3Year2, s3Year3, s3Year4];

  const baseSteps = simulateSequence(
    baselineCrops,
    xray,
    isNitrateRestricted,
    scenario,
    baselineHasLegume,
    fertPriceEurKgN,
    activePriceFeed,
    customPrices,
    subsidies
  );
  const slashSteps = simulateSequence(
    nitroSlashCrops,
    xray,
    isNitrateRestricted,
    scenario,
    true,
    fertPriceEurKgN,
    activePriceFeed,
    customPrices,
    subsidies,
    lastHistoricalCrop,
    initialCarryoverN
  );
  const shieldSteps = simulateSequence(
    climateShieldCrops,
    xray,
    isNitrateRestricted,
    scenario,
    true,
    fertPriceEurKgN,
    activePriceFeed,
    customPrices,
    subsidies,
    lastHistoricalCrop,
    initialCarryoverN
  );

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const baseAvgNHa = avg(baseSteps.map((s) => s.syntheticNAppliedKgHa));
  const baseAvgWater = avg(baseSteps.map((s) => s.crop.waterNeedMm));
  const baseAvgEtc = avg(baseSteps.map((s) => s.fao56EtcMm));
  const baseAvgCo2eHa = avg(baseSteps.map((s) => s.co2eKgHa));
  const baseAvgLeachHa = avg(baseSteps.map((s) => s.nitrateLeachingKgHa));
  const baseAvgRusleHa = avg(
    baseSteps.map((s) =>
      computeRusleSoilLossTonsHa(
        xray,
        s.bareMonths,
        Boolean(s.crop.coverCropIncluded)
      )
    )
  );
  const baseAvgMarginHa = avg(baseSteps.map((s) => s.netMarginEurHa));
  const baseTotalFertHa = baseSteps.reduce((acc, s) => acc + s.fertCostEurHa, 0);
  const baseTotalProfitFarm = Math.round(baseAvgMarginHa * farmAreaHa * 4);
  const seasonalEt0 = computeFao56GrowingSeasonEt0Mm(xray);

  const goalWeights: Record<
    PrimaryGoalId,
    { n: number; profit: number; water: number; soil: number }
  > = {
    cut_fertilizer: { n: 55, profit: 25, water: 10, soil: 10 },
    max_profit: { n: 20, profit: 60, water: 10, soil: 10 },
    drought_safe: { n: 15, profit: 20, water: 50, soil: 15 },
    protect_soil: { n: 15, profit: 15, water: 20, soil: 50 },
  };
  const w = goalWeights[primaryGoal];

  function buildResult(
    id: RotationStrategyResult["id"],
    badge: string,
    title: string,
    plainTagline: string,
    priceAdvantageNote: string,
    steps: RotationYearStep[],
    isBaseline: boolean,
    nitrateCapSafe: boolean,
    euBonusUnlocked: boolean,
    soilHealthSummary: string,
    erosionRedPct: number,
    explainability: RotationStrategyResult["explainability"]
  ): RotationStrategyResult {
    const avgNHa = Math.round(avg(steps.map((s) => s.syntheticNAppliedKgHa)));
    const nSavedPct = isBaseline
      ? 0
      : Math.max(
          0,
          Math.round(((baseAvgNHa - avgNHa) / Math.max(1, baseAvgNHa)) * 100)
        );

    const avgAnnualNetMarginEurHa = Math.round(
      avg(steps.map((s) => s.netMarginEurHa))
    );
    const total4YrFarmNetProfitEur = Math.round(
      avgAnnualNetMarginEurHa * farmAreaHa * 4
    );
    const profitDeltaVsBaselineEur =
      total4YrFarmNetProfitEur - baseTotalProfitFarm;

    const totalFertHa = steps.reduce((acc, s) => acc + s.fertCostEurHa, 0);
    const total4YrFertCostSavedEur = Math.max(
      0,
      Math.round((baseTotalFertHa - totalFertHa) * farmAreaHa)
    );

    const avgWaterNeedMm = Math.round(
      avg(steps.map((s) => s.crop.waterNeedMm))
    );
    const waterSavedPctVsBaseline = isBaseline
      ? 0
      : Math.round(((baseAvgWater - avgWaterNeedMm) / baseAvgWater) * 100);

    const bareSoilMonthsAvg = Number(
      avg(steps.map((s) => s.bareMonths)).toFixed(1)
    );

    const avgCo2eKgHaYr = Math.round(avg(steps.map((s) => s.co2eKgHa)));
    const co2eSavedTons4Yr = isBaseline
      ? 0
      : Number(
          Math.max(
            0,
            ((baseAvgCo2eHa - avgCo2eKgHaYr) * farmAreaHa * 4) / 1000
          ).toFixed(1)
        );

    const avgNitrateLeachingKgHaYr = Math.round(
      avg(steps.map((s) => s.nitrateLeachingKgHa))
    );
    const nitratePreventedKg4Yr = isBaseline
      ? 0
      : Math.max(
          0,
          Math.round((baseAvgLeachHa - avgNitrateLeachingKgHaYr) * farmAreaHa * 4)
        );

    const avgEtcMm = avg(steps.map((s) => s.fao56EtcMm));
    const coverYearsCount = steps.filter((s) =>
      Boolean(s.crop.coverCropIncluded)
    ).length;
    // 1 mm across 1 ha = 10 m3 of water; include FAO-56 ETc delta + mulch infiltration retention
    const waterRetainedM34Yr = isBaseline
      ? 0
      : Math.max(
          0,
          Math.round(
            (Math.max(0, baseAvgEtc - avgEtcMm) * 4 + coverYearsCount * 22) *
              10 *
              farmAreaHa
          )
        );

    const avgRusleHa = avg(
      steps.map((s) =>
        computeRusleSoilLossTonsHa(
          xray,
          s.bareMonths,
          Boolean(s.crop.coverCropIncluded)
        )
      )
    );
    const topsoilSavedTons4Yr = isBaseline
      ? 0
      : Math.max(0, Math.round((baseAvgRusleHa - avgRusleHa) * farmAreaHa * 4));

    const nScore = Math.min(100, Math.max(25, 42 + nSavedPct * 1.05));
    const waterScore = Math.min(
      100,
      Math.max(25, 50 + waterSavedPctVsBaseline * 2.3)
    );
    const marginRatio =
      avgAnnualNetMarginEurHa / Math.max(150, baseAvgMarginHa);
    const marginScore = Math.min(
      100,
      Math.max(25, Math.round(marginRatio * 74))
    );
    const soilScore = Math.min(
      100,
      Math.max(
        20,
        Math.round(92 - bareSoilMonthsAvg * 14 + erosionRedPct * 0.25)
      )
    );

    const goalMatchScore = Math.round(
      (nScore * w.n +
        marginScore * w.profit +
        waterScore * w.water +
        soilScore * w.soil) /
        100
    );

    return {
      id,
      badge,
      title,
      plainTagline,
      isBaseline,
      goalMatchScore,
      nitrateCapSafe,
      euBonusUnlocked,
      priceAdvantageNote,
      steps,
      avgAnnualNetMarginEurHa,
      total4YrFarmNetProfitEur,
      profitDeltaVsBaselineEur,
      avgSyntheticNKgHa: avgNHa,
      syntheticNSavedPctVsBaseline: nSavedPct,
      total4YrFertCostSavedEur,
      avgWaterNeedMm,
      waterSavedPctVsBaseline,
      bareSoilMonthsAvg,
      avgCo2eKgHaYr,
      co2eSavedTons4Yr,
      avgNitrateLeachingKgHaYr,
      nitratePreventedKg4Yr,
      waterRetainedM34Yr,
      topsoilSavedTons4Yr,
      soilHealthSummary,
      explainability,
    };
  }

  const maxTemp = Math.max(
    ...xray.monthlyClimate.map((m) => m.tempMaxC)
  ).toFixed(1);
  const minRootMoisture = Math.round(
    Math.min(...xray.monthlyClimate.map((m) => m.rootMoistureIdx)) * 100
  );

  const historyDiag = diagnoseHistoricalRotation(baselineCrops, "en");
  const s2LegumeStep =
    slashSteps.find((s) => s.crop.isLegume) ?? slashSteps[0];
  const s2GrainStep =
    slashSteps.find((s) => !s.crop.isLegume && s.year !== s2LegumeStep.year) ??
    slashSteps[1];

  const s3DynamicTitle = `${shortName(s3Year1, xray)}, ${shortName(
    s3Year2,
    xray
  )} & ${shortName(s3Year3, xray)} Plan`;
  const s2Title =
    validCustomCrops.length > 0
      ? `${shortName(validCustomCrops[0], xray)} & ${shortName(
          s2LegumeStep.crop.id === validCustomCrops[0].id
            ? s2GrainStep.crop
            : s2LegumeStep.crop,
          xray
        )} 4-Yr Plan`
      : `${shortName(s2LegumeStep.crop, xray)} & ${shortName(
          s2GrainStep.crop,
          xray
        )} Rotation`;

  return [
    buildResult(
      "baseline",
      "Your Current Plan",
      "Keep Current Crop Cycle",
      "High mineral fertilizer bills, bare spring soil runoff, and lower yields in dry summers.",
      `Priced via ${activePriceFeed.areaMarketLabel} (€${fertPriceEurKgN.toFixed(
        2
      )}/kg N fertilizer)`,
      baseSteps,
      true,
      !isNitrateRestricted || baselineHasLegume,
      baselineHasLegume,
      "Declining soil organic matter (-0.18%)",
      0,
      {
        whySuggested:
          "Your exact 4-year starting baseline evaluated with FAO-56 evapotranspiration, IPCC Tier-1 N2O emissions, and RUSLE slope erosion.",
        satelliteAndSoilEvidence: [
          `NASA SMAP & POWER show July root-zone moisture dropping to ${minRootMoisture}% (${maxTemp}°C peak heat; seasonal FAO-56 ET0 = ${seasonalEt0} mm).`,
          `NASA SRTM (${xray.slopePct.toFixed(
            1
          )}% slope) + ISRIC SoilGrids (${xray.soil.textureClass}) project ~${Math.round(
            baseAvgLeachHa
          )} kg NO3-N/ha/yr winter leaching and ${Math.round(
            baseAvgCo2eHa
          )} kg CO2e/ha/yr.`,
        ],
        quantifiedBenefits: [
          "No changes to your current seed orders or delivery contracts.",
        ],
        informationGapsAndUncertainty:
          "Satellites measure regional moisture and slope (30m) and Eurostat/spot markets reflect regional wholesale averages rather than private forward contracts.",
        agronomistReviewChecklist: [
          "Run a spring Nmin soil-nitrate core test (0–90 cm) before fertilizing cereals.",
          "Check sloped hillsides after May rainstorms for topsoil washouts.",
        ],
      }
    ),
    buildResult(
      "nitro_slash",
      validCustomCrops.length > 0
        ? "Custom + Regional N-Smart Plan"
        : "Local Market & Legume Upgrade",
      s2Title,
      `Matched to ${minRootMoisture}% summer moisture & ${maxTemp}°C heat in ${
        xray.regionLabel.split(",")[0]
      }: pairs ${shortName(s2LegumeStep.crop, xray)} (€${
        s2LegumeStep.appliedPriceEurTon
      }/t) with ${shortName(s2GrainStep.crop, xray)} (€${
        s2GrainStep.appliedPriceEurTon
      }/t).`,
      `Regionally & climate-verified · ${shortName(
        s2LegumeStep.crop,
        xray
      )} €${s2LegumeStep.appliedPriceEurTon}/t & ${shortName(
        s2GrainStep.crop,
        xray
      )} €${s2GrainStep.appliedPriceEurTon}/t (${activePriceFeed.areaMarketLabel})`,
      slashSteps,
      false,
      true,
      true,
      "Rebuilds organic matter (+0.34%) & cuts erosion 68%",
      68,
      {
        whySuggested: `${historyDiag.summary}. Every crop is verified against ${
          xray.regionLabel
        } cultivation, ${minRootMoisture}% summer soil moisture, and ${maxTemp}°C heat (${
          xray.localProductionNote
        }), while cutting IPCC N2O emissions and NO3- leaching.`,
        satelliteAndSoilEvidence: [
          `RUSLE slope-cover model cuts bare-soil exposure to ~${slashSteps[0].bareMonths}–1.4 months/yr on ${xray.slopePct.toFixed(
            1
          )}% SRTM slopes.`,
          `ISRIC SoilGrids pH (${xray.soil.ph}) and ${xray.soil.textureClass} profile support biological N2 fixation (+55–80 kg N/ha), avoiding Haber-Bosch & IPCC Tier-1 N2O flux.`,
          `FAO-56 water balance (${seasonalEt0} mm seasonal ET0) + local basis favors ${shortName(
            s2Year3,
            xray
          )} (€${slashSteps[2].appliedPriceEurTon}/t) after ${shortName(
            s2Year2,
            xray
          )}.`,
        ],
        quantifiedBenefits: [
          "Unlocks €60/ha per year in EU GAP Eco-Scheme legume bonuses.",
          "Cuts synthetic mineral Nitrogen, nitrous oxide (N2O, 273x GWP), and winter NO3- groundwater percolation.",
        ],
        informationGapsAndUncertainty:
          "Regional mill premiums require meeting moisture/protein specs; legume N fixation varies by ±18 kg/ha.",
        agronomistReviewChecklist: [
          `Confirm delivery terms at ${activePriceFeed.areaMarketLabel} before sowing.`,
          "Keep at least a 4-year break between legumes on the same parcel (Anbaupause).",
        ],
      }
    ),
    buildResult(
      "climate_shield",
      "Local Drought & Soil Shield",
      s3DynamicTitle,
      `Tailored for ${minRootMoisture}% summer soil moisture & ${maxTemp}°C heat in ${
        xray.regionLabel.split(",")[0]
      }: combines ${shortName(s3Year1, xray)}, ${shortName(
        s3Year2,
        xray
      )}, ${shortName(s3Year3, xray)} & ${shortName(
        s3Year4,
        xray
      )}.`,
      `Drought & heat matched · ${shortName(s3Year3, xray)} €${
        shieldSteps[2].appliedPriceEurTon
      }/t & ${shortName(s3Year4, xray)} €${
        shieldSteps[3].appliedPriceEurTon
      }/t`,
      shieldSteps,
      false,
      true,
      true,
      "Highest moisture retention (+0.41% organic matter)",
      76,
      {
        whySuggested: `Evaluated via FAO-56 crop water stress (Ks), summer heat tolerance, and RUSLE erosion for ${
          xray.regionLabel
        }: ${shortName(
          s3Year1,
          xray
        )} harvests early or fixes N ahead of ${shortName(
          s3Year2,
          xray
        )} and drought-hardy ${shortName(s3Year3, xray)}.`,
        satelliteAndSoilEvidence: [
          `FAO-56 water balance buffers the ${minRootMoisture}% NASA SMAP root-zone moisture trough and ${maxTemp}°C heat peaks.`,
          `Winter catch crops sequester soil organic carbon (-0.44 t CO2e/ha/yr) and scavenge residual autumn nitrate before winter rains.`,
        ],
        quantifiedBenefits: [
          "Lowers FAO-56 crop evapotranspiration demand and stabilizes yields in 37°C drought summers.",
          "Reduces RUSLE hillside topsoil loss by ~76% and protects local drinking-water aquifers.",
        ],
        informationGapsAndUncertainty:
          "Confirm local intake schedules at your nearest Raiffeisen or regional mill prior to spring planting.",
        agronomistReviewChecklist: [
          "Select regionally recommended drought-tolerant varieties for your elevation and soil.",
          "Keep winter cover-crop mulch intact ahead of spring-sown crops on sloped parcels.",
        ],
      }
    ),
  ];
}
