export type WeatherScenario = "normal" | "drought_heat";

export type AppLanguage = "en" | "de";

export interface SubsidyConfig {
  oeko2LegumeRotation: boolean; // +€60/ha/yr EU GAP Öko-Regelung 2
  faktCoverCrop: boolean; // +€90/ha on cover-crop years (BW FAKT II E1.2)
  faktPulseBonus: boolean; // +€85/ha on legume years (BW FAKT II B1/E2)
}

export interface SpreaderDayForecast {
  dateIso: string;
  dayShortEn: string;
  dayShortDe: string;
  tempMaxC: number;
  tempMinC: number;
  precipMm: number;
  windMaxKmh: number;
  status: "safe" | "caution" | "avoid";
  reasonEn: string;
  reasonDe: string;
}

export interface SpreaderForecastResponse {
  lat: number;
  lon: number;
  liveSource: boolean;
  bestWindowEn: string;
  bestWindowDe: string;
  days: SpreaderDayForecast[];
}

export type GibsLayerId = "none" | "ndvi" | "smap" | "lst";

export type PrimaryGoalId =
  | "cut_fertilizer"
  | "max_profit"
  | "drought_safe"
  | "protect_soil";

export interface MonthlyClimatePoint {
  month: string;
  monthIndex: number;
  tempAvgC: number;
  tempMaxC: number;
  precipMm: number;
  rootMoistureIdx: number; // 0..1
  surfaceMoistureIdx: number; // 0..1
  solarKwhM2: number;
  bareSoilBaseline: boolean;
  stressFlag: "none" | "heat" | "drought" | "leaching" | "erosion";
}

export interface SoilProfile {
  soilName: string;
  textureClass: string;
  clayPct: number;
  siltPct: number;
  sandPct: number;
  organicMatterPct: number;
  ph: number;
  totalNitrogenGkg: number;
  waterHoldingMm: number;
  drainageSummary: string;
  sourceLabel: string;
}

export interface ParcelZone {
  id: string;
  name: string;
  sharePct: number;
  zoneType: "high_retention" | "sloped_erosion" | "drought_prone";
  polygon: [number, number][];
  note: string;
}

export interface FarmXrayData {
  id: string;
  name: string;
  subRegionTag: string;
  regionLabel: string;
  heroImageUrl: string;
  lat: number;
  lon: number;
  defaultAreaHa: number;
  elevationM: number;
  slopePct: number;
  isNitrateRestricted: boolean; // -20% fertilizer cap zone
  defaultCurrentCropIds: [string, string, string, string];
  producedCropIds: string[]; // Strictly crops commercially grown & bought in this sub-region
  localProductionNote: string;
  bareSoilMonthsPerYear: number;
  estimatedNLossPct: number;
  plainSummary: string;
  monthlyClimate: MonthlyClimatePoint[];
  soil: SoilProfile;
  parcels: ParcelZone[];
  liveSourcesUsed: string[];
  fetchedAtIso: string;
}

export interface CropSpec {
  id: string;
  name: string;
  germanSub: string;
  imageUrl: string;
  family: "cereal" | "legume" | "oilseed" | "root";
  isLegume: boolean;
  selectableAsBaseline: boolean;
  bwRecommended: boolean;
  bwRecommendationTag: string; // e.g., "LTZ BW Climate-Recommended"
  nDemandKgHa: number;
  nFixedCreditKgHa: number;
  waterNeedMm: number;
  heatToleranceScore: number;
  droughtToleranceScore: number;
  erosionShieldScore: number;
  baseYieldTonsHa: number;
  pricePerTonEur: number; // Default regional reference price (€/t)
  seedAndOpsCostEurHa: number;
  localBuyers: string;
  growingWindow: string;
  plainRole: string;
  coverCropIncluded?: string;
  coverCropCostEurHa?: number;
  coverCropNRetentionKgHa?: number;
  isCustomCrop?: boolean;
}

export type CropSuitabilityStatus = "suitable" | "conditional" | "unsuitable";

export interface CropSuitabilityEvaluation {
  crop: CropSpec;
  status: CropSuitabilityStatus;
  score: number; // 0..100 biophysical + regional cultivation fit
  grownInRegion: boolean;
  agroZoneLabel: string;
  moistureVerdict: string;
  heatVerdict: string;
  soilSlopeVerdict: string;
  summaryReason: string;
  isCustom: boolean;
  includedInPlan: boolean;
}

export interface RegionalCropPriceQuote {
  cropId: string;
  cropName: string;
  germanSub: string;
  nationalBenchmarkEurTon: number;
  localBasisEurTon: number;
  effectiveLocalPriceEurTon: number;
  basisReason: string;
  marketHub: string;
  priceTrendPct: number;
  producedInArea: boolean;
}

export interface AreaPriceFeedResponse {
  areaId: string;
  areaMarketLabel: string;
  fertPriceEurKgN: number;
  eurUsdRate: number;
  liveSourcesUsed: string[];
  fetchedAtIso: string;
  quotes: Record<string, RegionalCropPriceQuote>;
}

export interface RotationYearStep {
  year: number;
  seasonLabel: string;
  crop: CropSpec;
  appliedPriceEurTon: number;
  realizedYieldTonsHa: number;
  syntheticNAppliedKgHa: number;
  nCarryoverReceivedKgHa: number;
  fertCostEurHa: number;
  grossRevenueEurHa: number;
  subsidyBonusEurHa: number;
  netMarginEurHa: number;
  bareMonths: number;
  fao56EtcMm: number;
  co2eKgHa: number;
  nitrateLeachingKgHa: number;
  suitabilityNote?: string;
  isCustomCrop?: boolean;
}

export interface NasaExplainabilityCard {
  whySuggested: string;
  satelliteAndSoilEvidence: string[];
  quantifiedBenefits: string[];
  informationGapsAndUncertainty: string;
  agronomistReviewChecklist: string[];
}

export interface RotationStrategyResult {
  id: "baseline" | "nitro_slash" | "climate_shield";
  badge: string;
  title: string;
  plainTagline: string;
  isBaseline: boolean;
  goalMatchScore: number;
  nitrateCapSafe: boolean;
  euBonusUnlocked: boolean;
  priceAdvantageNote: string;
  steps: RotationYearStep[];
  avgAnnualNetMarginEurHa: number;
  total4YrFarmNetProfitEur: number;
  profitDeltaVsBaselineEur: number;
  avgSyntheticNKgHa: number;
  syntheticNSavedPctVsBaseline: number;
  total4YrFertCostSavedEur: number;
  avgWaterNeedMm: number;
  waterSavedPctVsBaseline: number;
  bareSoilMonthsAvg: number;
  avgCo2eKgHaYr: number;
  co2eSavedTons4Yr: number;
  avgNitrateLeachingKgHaYr: number;
  nitratePreventedKg4Yr: number;
  waterRetainedM34Yr: number;
  topsoilSavedTons4Yr: number;
  soilHealthSummary: string;
  explainability: NasaExplainabilityCard;
}
