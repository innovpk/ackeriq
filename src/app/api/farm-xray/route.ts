import { NextRequest } from "next/server";
import {
  MONTHS,
  HEILBRONN_FARMS,
  buildHeilbronnParcels,
  isInsideBadenWuerttemberg,
  resolveNearestHeilbronnPreset,
} from "@/data/agronomyCatalog";
import { deriveRegionalCropProfile } from "@/lib/cropSuitability";
import type {
  ClimateShiftAnomaly,
  FarmXrayData,
  MonthlyClimatePoint,
  SoilProfile,
} from "@/types/ackeriq";

const MONTH_KEYS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 4200
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "AckerIQ-Stuttgart-NASASpaceApps/1.0",
        ...(init.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchNasaPowerMonthly(
  lat: number,
  lon: number
): Promise<MonthlyClimatePoint[] | null> {
  try {
    const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_MAX,PRECTOTCORR,GWETROOT,GWETTOP,ALLSKY_SFC_SW_DWN&community=AG&longitude=${lon.toFixed(
      4
    )}&latitude=${lat.toFixed(4)}&format=JSON`;

    interface PowerResp {
      properties?: {
        parameter?: Record<string, Record<string, number>>;
      };
    }
    const data = await fetchJsonWithTimeout<PowerResp>(url, {}, 4800);
    const p = data.properties?.parameter;
    if (!p || !p.T2M) return null;

    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    return MONTH_KEYS.map((mk, idx) => {
      const tempAvgC = Number((p.T2M?.[mk] ?? 10).toFixed(1));
      const tempMaxC = Number((p.T2M_MAX?.[mk] ?? tempAvgC + 5).toFixed(1));
      const dailyPrecip = p.PRECTOTCORR?.[mk] ?? 2.0;
      const precipMm = Math.max(8, Math.round(dailyPrecip * daysInMonth[idx]));
      const rootMoistureIdx = Number(
        Math.min(0.95, Math.max(0.2, p.GWETROOT?.[mk] ?? 0.55)).toFixed(2)
      );
      const surfaceMoistureIdx = Number(
        Math.min(0.95, Math.max(0.18, p.GWETTOP?.[mk] ?? 0.52)).toFixed(2)
      );
      const solarKwhM2 = Number((p.ALLSKY_SFC_SW_DWN?.[mk] ?? 3.5).toFixed(1));

      const bareSoilBaseline = idx <= 2 || idx === 7 || idx === 11;

      let stressFlag: MonthlyClimatePoint["stressFlag"] = "none";
      if (tempMaxC >= 28.5) stressFlag = "heat";
      else if (rootMoistureIdx <= 0.45) stressFlag = "drought";
      else if (precipMm >= 65 && idx >= 2 && idx <= 5) stressFlag = "erosion";
      else if (bareSoilBaseline && precipMm >= 50) stressFlag = "leaching";

      return {
        month: MONTHS[idx],
        monthIndex: idx,
        tempAvgC,
        tempMaxC,
        precipMm,
        rootMoistureIdx,
        surfaceMoistureIdx,
        solarKwhM2,
        bareSoilBaseline,
        stressFlag,
      };
    });
  } catch {
    return null;
  }
}

/**
 * Multi-decade NASA POWER historical vs. recent summer climate-shift anomaly
 * (1991–2005 baseline vs. 2015–2024 recent summer Jun–Aug T2M_MAX & GWETROOT).
 */
async function fetchNasaPowerClimateShift(
  lat: number,
  lon: number
): Promise<ClimateShiftAnomaly | null> {
  try {
    const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M_MAX,GWETROOT&community=AG&start=1991&end=2024&longitude=${lon.toFixed(
      4
    )}&latitude=${lat.toFixed(4)}&format=JSON`;

    interface PowerMonthlyResp {
      properties?: {
        parameter?: {
          T2M_MAX?: Record<string, number>;
          GWETROOT?: Record<string, number>;
        };
      };
    }

    const data = await fetchJsonWithTimeout<PowerMonthlyResp>(url, {}, 4600);
    const tMap = data.properties?.parameter?.T2M_MAX;
    const mMap = data.properties?.parameter?.GWETROOT;
    if (!tMap || !mMap) return null;

    const summerMonths = ["06", "07", "08"];
    const collectMean = (
      series: Record<string, number>,
      startYear: number,
      endYear: number
    ): number | null => {
      let sum = 0;
      let count = 0;
      for (let y = startYear; y <= endYear; y++) {
        for (const mm of summerMonths) {
          const val = series[`${y}${mm}`];
          if (typeof val === "number" && Number.isFinite(val) && val > -90) {
            sum += val;
            count++;
          }
        }
      }
      return count >= 9 ? sum / count : null;
    };

    const baseTemp = collectMean(tMap, 1991, 2005);
    const recentTemp = collectMean(tMap, 2015, 2024);
    const baseMoist = collectMean(mMap, 1991, 2005);
    const recentMoist = collectMean(mMap, 2015, 2024);

    if (
      baseTemp === null ||
      recentTemp === null ||
      baseMoist === null ||
      recentMoist === null
    ) {
      return null;
    }

    return {
      baselinePeriod: "1991–2005",
      recentPeriod: "2015–2024",
      summerTempDeltaC: Number((recentTemp - baseTemp).toFixed(1)),
      summerMoistureDeltaPct: Math.round((recentMoist - baseMoist) * 100),
      liveMeasured: true,
    };
  } catch {
    return null;
  }
}

async function fetchSrtmTerrain(
  lat: number,
  lon: number
): Promise<{ elevationM: number; slopePct: number } | null> {
  try {
    const lats = `${lat.toFixed(5)},${(lat + 0.0009).toFixed(5)},${lat.toFixed(5)}`;
    const lons = `${lon.toFixed(5)},${lon.toFixed(5)},${(lon + 0.0013).toFixed(5)}`;
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
    const data = await fetchJsonWithTimeout<{ elevation?: number[] }>(url, {}, 3500);
    if (!data.elevation || data.elevation.length < 3) return null;

    const [e0, eNorth, eEast] = data.elevation;
    const dzNorth = (eNorth - e0) / 100;
    const dzEast = (eEast - e0) / 100;
    const rawSlopePct = Math.sqrt(dzNorth * dzNorth + dzEast * dzEast) * 100;
    const slopePct = Number(Math.min(14, Math.max(0.8, rawSlopePct)).toFixed(1));

    return {
      elevationM: Math.round(e0),
      slopePct,
    };
  } catch {
    return null;
  }
}

async function fetchSoilGrids(lat: number, lon: number): Promise<Partial<SoilProfile> | null> {
  try {
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon.toFixed(
      4
    )}&lat=${lat.toFixed(
      4
    )}&property=clay&property=silt&property=sand&property=soc&property=phh2o&property=nitrogen&depth=0-30cm&value=mean`;

    interface SoilGridsResp {
      properties?: {
        layers?: Array<{
          name: string;
          depths?: Array<{ values?: { mean?: number | null } }>;
        }>;
      };
    }
    const data = await fetchJsonWithTimeout<SoilGridsResp>(url, {}, 4000);
    const layers = data.properties?.layers;
    if (!layers) return null;

    const getVal = (name: string): number | null => {
      const layer = layers.find((l) => l.name === name);
      const v = layer?.depths?.[0]?.values?.mean;
      return typeof v === "number" ? v : null;
    };

    const clayRaw = getVal("clay");
    const siltRaw = getVal("silt");
    const sandRaw = getVal("sand");
    const socRaw = getVal("soc");
    const phRaw = getVal("phh2o");
    const nRaw = getVal("nitrogen");

    if (clayRaw === null && phRaw === null) return null;

    const clayPct = clayRaw !== null ? Math.round(clayRaw / 10) : 21;
    const siltPct = siltRaw !== null ? Math.round(siltRaw / 10) : 61;
    const sandPct =
      sandRaw !== null ? Math.round(sandRaw / 10) : Math.max(5, 100 - clayPct - siltPct);
    const organicMatterPct =
      socRaw !== null
        ? Number(Math.min(5.5, Math.max(1.1, (socRaw / 10) * 0.172)).toFixed(1))
        : 2.0;
    const ph = phRaw !== null ? Number((phRaw / 10).toFixed(1)) : 7.1;
    const totalNitrogenGkg =
      nRaw !== null ? Number((nRaw / 100).toFixed(2)) : 1.35;

    const textureClass =
      siltPct >= 55
        ? "Silt Loam (Loess)"
        : clayPct >= 28
        ? "Clay Loam"
        : "Sandy Loam";

    const waterHoldingMm = Math.round(115 + siltPct * 1.15 + organicMatterPct * 12);

    return {
      textureClass,
      clayPct,
      siltPct,
      sandPct,
      organicMatterPct,
      ph,
      totalNitrogenGkg,
      waterHoldingMm,
    };
  } catch {
    return null;
  }
}

async function fetchReversePlaceName(
  lat: number,
  lon: number
): Promise<{ farmTitle: string; regionLabel: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(
      4
    )}&lon=${lon.toFixed(4)}&zoom=12`;
    interface NomResp {
      address?: {
        village?: string;
        suburb?: string;
        town?: string;
        city?: string;
        county?: string;
        state?: string;
        country?: string;
        country_code?: string;
      };
    }
    const res = await fetchJsonWithTimeout<NomResp>(url, {}, 3000);
    const a = res.address;
    if (!a) return null;
    const locality =
      a.village || a.town || a.suburb || a.city || a.county || "Arable Field";
    const cc = (a.country_code || "").toUpperCase();
    const regionTail =
      cc && cc !== "DE"
        ? [a.state || a.county, a.country].filter(Boolean).join(", ")
        : a.county || a.state || "Germany";
    return {
      farmTitle: `Farm near ${locality}`,
      regionLabel: [locality, regionTail].filter(Boolean).join(", "),
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const presetId = sp.get("presetId");
  const customAddressLabel = (sp.get("addressLabel") || "").trim();
  const customFullAddress = (sp.get("fullAddress") || "").trim();
  const latParam = Number(sp.get("lat"));
  const lonParam = Number(sp.get("lon"));

  const matchedPreset = presetId
    ? HEILBRONN_FARMS.find((p) => p.id === presetId)
    : undefined;

  const lat =
    Number.isFinite(latParam) && sp.has("lat")
      ? latParam
      : matchedPreset?.xray.lat ?? 48.706;
  const lon =
    Number.isFinite(lonParam) && sp.has("lon")
      ? lonParam
      : matchedPreset?.xray.lon ?? 9.215;

  const fallbackPreset =
    matchedPreset ?? resolveNearestHeilbronnPreset(lat, lon);

  const [livePower, liveClimateShift, liveTerrain, liveSoilGrids, livePlace] =
    await Promise.all([
      fetchNasaPowerMonthly(lat, lon),
      fetchNasaPowerClimateShift(lat, lon),
      fetchSrtmTerrain(lat, lon),
      fetchSoilGrids(lat, lon),
      !matchedPreset && !customAddressLabel
        ? fetchReversePlaceName(lat, lon)
        : Promise.resolve(null),
    ]);

  const liveSourcesUsed: string[] = ["NASA GIBS Satellite"];
  if (livePower) liveSourcesUsed.push("NASA POWER Weather (Live)");
  else liveSourcesUsed.push("NASA POWER Weather");

  if (liveClimateShift) {
    liveSourcesUsed.push("NASA POWER Climate Shift (1991–2024)");
  }

  if (liveTerrain) {
    liveSourcesUsed.push("NASA SRTM / Copernicus DEM Slope (Live)");
  }
  if (liveSoilGrids) liveSourcesUsed.push("ISRIC SoilGrids (Live)");
  else liveSourcesUsed.push("BW Soil Survey");

  const elevationM = liveTerrain?.elevationM ?? fallbackPreset.xray.elevationM;
  const slopePct = matchedPreset
    ? matchedPreset.xray.slopePct
    : liveTerrain?.slopePct ?? fallbackPreset.xray.slopePct;

  const monthlyClimate = livePower ?? fallbackPreset.xray.monthlyClimate;
  const climateShift: ClimateShiftAnomaly = liveClimateShift ?? {
    baselinePeriod: "1991–2005",
    recentPeriod: "2015–2024",
    summerTempDeltaC: 1.5,
    summerMoistureDeltaPct: -7,
    liveMeasured: false,
  };

  const inBw = isInsideBadenWuerttemberg(lat, lon);

  const mergedSoil: SoilProfile = {
    ...fallbackPreset.xray.soil,
    ...(liveSoilGrids || {}),
    soilName: matchedPreset
      ? matchedPreset.xray.soil.soilName
      : `${liveSoilGrids?.textureClass ?? "Loess Silt-Loam"} (${
          livePlace?.regionLabel.split(",")[0] ??
          (inBw ? "Baden-Württemberg" : `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`)
        })`,
    sourceLabel: liveSoilGrids
      ? "ISRIC SoilGrids (Live 0–30cm)"
      : fallbackPreset.xray.soil.sourceLabel,
  };

  const estimatedNLossPct = matchedPreset
    ? matchedPreset.xray.estimatedNLossPct
    : Math.min(40, Math.max(22, Math.round(22 + slopePct * 2.1)));

  const maxSummerTemp = Math.max(...monthlyClimate.map((m) => m.tempMaxC));
  const minSummerMoisturePct = Math.round(
    Math.min(...monthlyClimate.map((m) => m.rootMoistureIdx)) * 100
  );
  const plainSummary = matchedPreset
    ? matchedPreset.xray.plainSummary
    : `At ${slopePct.toFixed(1)}% slope, ${minSummerMoisturePct}% summer root moisture, and ${maxSummerTemp.toFixed(
        1
      )}°C peak heat, bare spring soil puts ~${estimatedNLossPct}% of applied Nitrogen at risk.`;

  const resolvedCustomTitle = customAddressLabel
    ? `Farm — ${customAddressLabel}`
    : livePlace?.farmTitle ??
      (inBw
        ? `Field near ${fallbackPreset.shortLabel.split(" (")[0]}`
        : `Arable Farm (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`);
  const resolvedCustomRegion =
    customFullAddress ||
    customAddressLabel ||
    livePlace?.regionLabel ||
    `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;

  const dynamicRegional = matchedPreset
    ? null
    : deriveRegionalCropProfile(
        lat,
        lon,
        elevationM,
        slopePct,
        monthlyClimate,
        mergedSoil
      );

  const responsePayload: FarmXrayData = {
    ...fallbackPreset.xray,
    id: matchedPreset
      ? matchedPreset.id
      : `custom-${lat.toFixed(4)}-${lon.toFixed(4)}`,
    name: matchedPreset ? matchedPreset.xray.name : resolvedCustomTitle,
    subRegionTag: matchedPreset
      ? matchedPreset.xray.subRegionTag
      : inBw
      ? `Custom BW Farm · Nearest Hub: ${fallbackPreset.shortLabel.split(" (")[0]}`
      : `Live Agro-Climate Zone · ${resolvedCustomRegion.split(",")[0]}`,
    regionLabel: matchedPreset
      ? matchedPreset.xray.regionLabel
      : resolvedCustomRegion,
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
    defaultAreaHa: matchedPreset ? matchedPreset.xray.defaultAreaHa : 165,
    elevationM,
    slopePct,
    isNitrateRestricted: matchedPreset
      ? matchedPreset.xray.isNitrateRestricted
      : inBw
      ? fallbackPreset.xray.isNitrateRestricted
      : false,
    producedCropIds: matchedPreset
      ? matchedPreset.xray.producedCropIds
      : dynamicRegional!.producedCropIds,
    defaultCurrentCropIds: matchedPreset
      ? matchedPreset.xray.defaultCurrentCropIds
      : dynamicRegional!.defaultCurrentCropIds,
    localProductionNote: matchedPreset
      ? matchedPreset.xray.localProductionNote
      : dynamicRegional!.localProductionNote,
    estimatedNLossPct,
    plainSummary,
    monthlyClimate,
    climateShift,
    soil: mergedSoil,
    parcels: buildHeilbronnParcels(lat, lon, slopePct),
    liveSourcesUsed,
    fetchedAtIso: new Date().toISOString(),
  };

  return Response.json(responsePayload);
}
