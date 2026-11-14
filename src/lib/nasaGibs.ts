import type { GibsLayerId } from "@/types/ackeriq";

export interface GibsLayerSpec {
  label: string;
  url: string;
  maxNativeZoom: number;
  legend: string;
  compositeDate: string;
}

function formatUtcIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Computes exact 8-day MODIS Julian composite boundary (DOY = 1 + 8*k)
 * with an 18-day processing latency buffer so NASA GIBS WMTS always serves HTTP 200 tiles.
 */
function getLatestModis8DayDate(referenceDate: Date): string {
  const safeTarget = new Date(referenceDate.getTime() - 18 * 86_400_000);
  const year = safeTarget.getUTCFullYear();
  const startOfYearUtc = Date.UTC(year, 0, 1);
  const currentUtc = Date.UTC(
    year,
    safeTarget.getUTCMonth(),
    safeTarget.getUTCDate()
  );
  const doy = Math.floor((currentUtc - startOfYearUtc) / 86_400_000) + 1;
  const alignedDoy = 1 + Math.floor((doy - 1) / 8) * 8;
  const compositeDate = new Date(startOfYearUtc + (alignedDoy - 1) * 86_400_000);
  return formatUtcIsoDate(compositeDate);
}

/**
 * Computes recent daily composite date (12-day latency margin for SMAP L4 & MODIS LST).
 */
function getLatestDailyGibsDate(referenceDate: Date): string {
  const safeDaily = new Date(referenceDate.getTime() - 12 * 86_400_000);
  return formatUtcIsoDate(safeDaily);
}

export function buildDynamicGibsLayers(
  isoTimestamp: string
): Record<Exclude<GibsLayerId, "none">, GibsLayerSpec> {
  const parsed = new Date(isoTimestamp);
  const referenceDate = Number.isNaN(parsed.getTime())
    ? new Date("2026-11-14T12:00:00Z")
    : parsed;
  const ndviDate = getLatestModis8DayDate(referenceDate);
  const dailyDate = getLatestDailyGibsDate(referenceDate);

  return {
    ndvi: {
      label: "NDVI",
      url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${ndviDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`,
      maxNativeZoom: 9,
      legend: `NASA MODIS NDVI (${ndviDate})`,
      compositeDate: ndviDate,
    },
    smap: {
      label: "Moisture",
      url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/SMAP_L4_Analyzed_Root_Zone_Soil_Moisture/default/${dailyDate}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
      maxNativeZoom: 6,
      legend: `NASA SMAP Root Moisture (${dailyDate})`,
      compositeDate: dailyDate,
    },
    lst: {
      label: "Heat",
      url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${dailyDate}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
      maxNativeZoom: 7,
      legend: `NASA MODIS Surface Temp (${dailyDate})`,
      compositeDate: dailyDate,
    },
  };
}
