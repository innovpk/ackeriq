import { NextRequest } from "next/server";
import type {
  SpreaderDayForecast,
  SpreaderForecastResponse,
} from "@/types/ackeriq";

const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DE_DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function classifySpreaderDay(
  dateStr: string,
  tMax: number,
  tMin: number,
  precipMm: number,
  windKmh: number
): SpreaderDayForecast {
  const dt = new Date(`${dateStr}T12:00:00Z`);
  const dow = Number.isNaN(dt.getUTCDay()) ? 1 : dt.getUTCDay();

  let status: SpreaderDayForecast["status"] = "safe";
  let reasonEn = "Ideal window";
  let reasonDe = "Optimales Streufenster";

  if (tMin <= -0.5) {
    status = "avoid";
    reasonEn = "Frost (DüV Ban)";
    reasonDe = "Frostboden (Sperrfrist)";
  } else if (precipMm >= 10) {
    status = "avoid";
    reasonEn = "Heavy Rain Runoff";
    reasonDe = "Starkregen-Abschwemmung";
  } else if (windKmh >= 30) {
    status = "avoid";
    reasonEn = "High Wind Drift";
    reasonDe = "Zu viel Windabdrift";
  } else if (precipMm >= 4) {
    status = "caution";
    reasonEn = "Light Rain Risk";
    reasonDe = "Schauerrisiko";
  } else if (windKmh >= 22) {
    status = "caution";
    reasonEn = "Breezy — Morning Only";
    reasonDe = "Böig — nur morgens";
  } else if (tMax >= 28) {
    status = "caution";
    reasonEn = "Hot — NH3 Loss Risk";
    reasonDe = "Hitze — NH3-Verlust";
  }

  return {
    dateIso: dateStr,
    dayShortEn: EN_DAYS[dow],
    dayShortDe: DE_DAYS[dow],
    tempMaxC: Math.round(tMax),
    tempMinC: Math.round(tMin),
    precipMm: Number(precipMm.toFixed(1)),
    windMaxKmh: Math.round(windKmh),
    status,
    reasonEn,
    reasonDe,
  };
}

function buildFallbackDays(): SpreaderDayForecast[] {
  const base = [
    { offset: 0, tMax: 14, tMin: 5, rain: 1.2, wind: 14 },
    { offset: 1, tMax: 16, tMin: 6, rain: 0.0, wind: 12 },
    { offset: 2, tMax: 13, tMin: 7, rain: 14.5, wind: 26 },
    { offset: 3, tMax: 12, tMin: 4, rain: 6.2, wind: 21 },
    { offset: 4, tMax: 17, tMin: 5, rain: 0.4, wind: 11 },
    { offset: 5, tMax: 18, tMin: 7, rain: 0.0, wind: 15 },
    { offset: 6, tMax: 15, tMin: 6, rain: 5.4, wind: 24 },
  ];
  const now = new Date();
  return base.map((b) => {
    const d = new Date(now.getTime() + b.offset * 86400_000);
    const iso = d.toISOString().slice(0, 10);
    return classifySpreaderDay(iso, b.tMax, b.tMin, b.rain, b.wind);
  });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const latParam = Number(sp.get("lat"));
  const lonParam = Number(sp.get("lon"));
  const lat = Number.isFinite(latParam) && sp.has("lat") ? latParam : 48.706;
  const lon = Number.isFinite(lonParam) && sp.has("lon") ? lonParam : 9.215;

  let days: SpreaderDayForecast[] | null = null;
  let liveSource = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
      4
    )}&longitude=${lon.toFixed(
      4
    )}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=Europe%2FBerlin&forecast_days=7`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      interface OpenMeteoDailyResp {
        daily?: {
          time?: string[];
          temperature_2m_max?: number[];
          temperature_2m_min?: number[];
          precipitation_sum?: number[];
          wind_speed_10m_max?: number[];
        };
      }
      const data = (await res.json()) as OpenMeteoDailyResp;
      const d = data.daily;
      if (d?.time && d.time.length >= 7) {
        days = d.time.slice(0, 7).map((dateStr, i) =>
          classifySpreaderDay(
            dateStr,
            d.temperature_2m_max?.[i] ?? 15,
            d.temperature_2m_min?.[i] ?? 6,
            d.precipitation_sum?.[i] ?? 0,
            d.wind_speed_10m_max?.[i] ?? 14
          )
        );
        liveSource = true;
      }
    }
  } catch {
    // Use Stuttgart regional fallback
  }

  const finalDays = days ?? buildFallbackDays();
  const bestDay =
    finalDays.find((d) => d.status === "safe") ??
    finalDays.find((d) => d.status === "caution");

  const bestWindowEn = bestDay
    ? `Best spreader window: ${bestDay.dayShortEn} (${bestDay.precipMm} mm rain, ${bestDay.windMaxKmh} km/h wind)`
    : "Wet/windy week ahead — hold mineral N applications";

  const bestWindowDe = bestDay
    ? `Bestes Streufenster: ${bestDay.dayShortDe} (${bestDay.precipMm} mm Regen, ${bestDay.windMaxKmh} km/h Wind)`
    : "Nasse/windige Woche — Mineraldüngung verschieben";

  const payload: SpreaderForecastResponse = {
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
    liveSource,
    bestWindowEn,
    bestWindowDe,
    days: finalDays,
  };

  return Response.json(payload);
}
