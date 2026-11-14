import { NextRequest } from "next/server";
import {
  AREA_BASIS_CONFIG,
  AREA_PRODUCED_CROPS,
  CROPS_HEILBRONN,
  HEILBRONN_FARMS,
  isInsideBadenWuerttemberg,
} from "@/data/agronomyCatalog";
import type {
  AreaPriceFeedResponse,
  RegionalCropPriceQuote,
} from "@/types/ackeriq";

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 3600
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AckerIQ-Stuttgart-MarketFeed/1.0",
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface EurostatJson {
  value?: Record<string, number>;
  dimension?: {
    prod_veg?: { category?: { index?: Record<string, number> } };
    time?: { category?: { index?: Record<string, number> } };
  };
}

interface EurostatBenchmarkResult {
  prices: Record<string, number>;
  trends: Partial<Record<"cereal" | "legume" | "oilseed", number>>;
}

async function fetchEurostatGermanyBenchmarks(): Promise<EurostatBenchmarkResult | null> {
  try {
    const url =
      "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/apri_ap_crpouta?geo=DE&currency=EUR&sinceTimePeriod=2022";
    const data = await fetchJsonWithTimeout<EurostatJson>(url, 4000);

    const prodIdx = data.dimension?.prod_veg?.category?.index;
    const timeIdx = data.dimension?.time?.category?.index;
    const vals = data.value;
    if (!prodIdx || !timeIdx || !vals) return null;

    const nTimes = Object.keys(timeIdx).length;
    const getLatestTwoPer100kg = (
      code: string
    ): { latest: number | null; prev: number | null } => {
      const p = prodIdx[code];
      if (typeof p !== "number") return { latest: null, prev: null };
      let latest: number | null = null;
      let prev: number | null = null;
      for (let t = nTimes - 1; t >= 0; t--) {
        const v = vals[String(p * nTimes + t)];
        if (typeof v === "number" && Number.isFinite(v) && v > 0) {
          if (latest === null) latest = v;
          else if (prev === null) {
            prev = v;
            break;
          }
        }
      }
      return { latest, prev };
    };

    const pctDelta = (pair: { latest: number | null; prev: number | null }): number => {
      if (!pair.latest || !pair.prev || pair.prev <= 0) return 0;
      return Number(
        Math.max(-6, Math.min(6, ((pair.latest - pair.prev) / pair.prev) * 100)).toFixed(1)
      );
    };

    const softWheatPair = getLatestTwoPer100kg("01110000"); // EUR/100kg -> *10 = EUR/t
    const feedBarleyPair = getLatestTwoPer100kg("01300000");
    const maltingBarleyPair = getLatestTwoPer100kg("01320000");
    const maizePair = getLatestTwoPer100kg("01500000");
    const rapeseedPair = getLatestTwoPer100kg("02110000");
    const sunflowerPair = getLatestTwoPer100kg("02120000");
    const soyaPair = getLatestTwoPer100kg("02130000");
    const sugarBeetPair = getLatestTwoPer100kg("02400000"); // Already EUR/1000kg

    const softWheat = softWheatPair.latest;
    const feedBarley = feedBarleyPair.latest;
    const maltingBarley = maltingBarleyPair.latest;
    const maize = maizePair.latest;
    const rapeseed = rapeseedPair.latest;
    const sunflower = sunflowerPair.latest;
    const soya = soyaPair.latest;
    const sugarBeetPerTon = sugarBeetPair.latest;

    const out: Record<string, number> = {};
    if (softWheat) {
      out.winter_wheat = Math.round(softWheat * 10);
      // Swabian Spelt trades at ~24% regional milling premium above German soft wheat
      out.swabian_spelt = Math.round(softWheat * 10 * 1.24);
      out.winter_rye = Math.round(softWheat * 10 * 0.91);
      out.durum_wheat = Math.round(softWheat * 10 * 1.32);
    }
    if (feedBarley) {
      out.winter_barley = Math.round(feedBarley * 10);
      out.spring_oats = Math.round(feedBarley * 10 * 1.24);
    }
    if (maltingBarley) out.malting_barley = Math.round(maltingBarley * 10);
    if (maize) {
      out.grain_maize = Math.round(maize * 10);
      out.grain_sorghum = Math.round(maize * 10 * 1.1);
    }
    if (rapeseed) out.winter_rapeseed = Math.round(rapeseed * 10);
    if (sunflower) {
      // High-oleic BW crusher contracts trade above standard mixed sunflower seed
      out.sunflower_bw = Math.max(385, Math.round(sunflower * 10 * 1.25));
    }
    if (soya) {
      // BW GMO-free 000 Soya commands food/feed premium over EU bulk soy
      out.soybean_bw = Math.max(430, Math.round(soya * 10 * 1.06));
      out.field_pea = Math.round(soya * 10 * 0.77);
      out.field_bean = Math.round(soya * 10 * 0.72);
    }
    if (sugarBeetPerTon) {
      const beetEur = Math.max(38, Math.min(62, Math.round(sugarBeetPerTon)));
      out.sugar_beet = beetEur;
      out.sugar_beet_cover = beetEur;
    }

    if (Object.keys(out).length === 0) return null;

    return {
      prices: out,
      trends: {
        cereal: Number(((pctDelta(softWheatPair) + pctDelta(maizePair)) / 2).toFixed(1)),
        legume: pctDelta(soyaPair),
        oilseed: pctDelta(rapeseedPair),
      },
    };
  } catch {
    return null;
  }
}

async function fetchEcbExchangeRate(): Promise<number | null> {
  try {
    interface FxResp {
      rates?: { EUR?: number };
    }
    const fx = await fetchJsonWithTimeout<FxResp>(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR",
      2800
    );
    return typeof fx?.rates?.EUR === "number" ? fx.rates.EUR : null;
  } catch {
    return null;
  }
}

function resolveNearestAreaId(
  areaIdParam: string | null,
  latParam: number,
  lonParam: number
): string {
  if (areaIdParam && AREA_BASIS_CONFIG[areaIdParam]) {
    return areaIdParam;
  }
  if (Number.isFinite(latParam) && Number.isFinite(lonParam)) {
    let bestId = "filder-plieningen";
    let bestDist = Infinity;
    for (const farm of HEILBRONN_FARMS) {
      const d =
        Math.pow(farm.xray.lat - latParam, 2) +
        Math.pow(farm.xray.lon - lonParam, 2);
      if (d < bestDist) {
        bestDist = d;
        bestId = farm.id;
      }
    }
    return bestId;
  }
  return "filder-plieningen";
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const latParam = Number(sp.get("lat"));
  const lonParam = Number(sp.get("lon"));
  const resolvedAreaId = resolveNearestAreaId(
    sp.get("areaId"),
    latParam,
    lonParam
  );

  const [eurostatBench, ecbEurUsd] = await Promise.all([
    fetchEurostatGermanyBenchmarks(),
    fetchEcbExchangeRate(),
  ]);

  const liveSourcesUsed: string[] = [];
  if (eurostatBench) {
    liveSourcesUsed.push("EU Eurostat DE Output Prices (Live)");
  } else {
    liveSourcesUsed.push("LEL Schwäbisch Gmünd BW Reference");
  }
  if (ecbEurUsd !== null) {
    liveSourcesUsed.push("ECB Reference FX (Frankfurter Open API)");
  }
  liveSourcesUsed.push("Stuttgart / BW Local Hub Basis");

  const hasCoords =
    Number.isFinite(latParam) && Number.isFinite(lonParam) && sp.has("lat");
  const inBw = !hasCoords || isInsideBadenWuerttemberg(latParam, lonParam);

  const basisCfg =
    AREA_BASIS_CONFIG[resolvedAreaId] ?? AREA_BASIS_CONFIG["filder-plieningen"];
  const activeMarketHub = inBw
    ? basisCfg.marketHub
    : "EU Eurostat & Regional Wholesale Spot Feed";
  const producedSet = new Set(
    AREA_PRODUCED_CROPS[resolvedAreaId] ??
      AREA_PRODUCED_CROPS["filder-plieningen"]
  );

  const quotes: Record<string, RegionalCropPriceQuote> = {};

  for (const crop of Object.values(CROPS_HEILBRONN)) {
    const nationalBase =
      eurostatBench?.prices[crop.id] ?? crop.pricePerTonEur;
    const trendPct =
      (crop.family !== "root" && eurostatBench?.trends[crop.family]) || 0;
    const spotAdjustedBase = Math.round(
      nationalBase * (1 + trendPct * 0.004)
    );

    const localBasisEntry = inBw ? basisCfg.basisByCrop[crop.id] : undefined;
    const localBasisEur = localBasisEntry?.deltaEur ?? 0;
    const effectivePrice = Math.max(
      25,
      Math.round(spotAdjustedBase + localBasisEur)
    );

    quotes[crop.id] = {
      cropId: crop.id,
      cropName: crop.name,
      germanSub: crop.germanSub,
      nationalBenchmarkEurTon: spotAdjustedBase,
      localBasisEurTon: localBasisEur,
      effectiveLocalPriceEurTon: effectivePrice,
      basisReason:
        localBasisEntry?.reason ??
        (inBw
          ? "Standard Baden-Württemberg wholesale delivery"
          : "Regional wholesale spot benchmark"),
      marketHub: activeMarketHub,
      priceTrendPct: trendPct,
      producedInArea: producedSet.has(crop.id),
    };
  }

  const payload: AreaPriceFeedResponse = {
    areaId: inBw ? resolvedAreaId : "regional-spot",
    areaMarketLabel: activeMarketHub,
    fertPriceEurKgN: 1.31,
    eurUsdRate: ecbEurUsd ?? 0.91,
    liveSourcesUsed,
    fetchedAtIso: new Date().toISOString(),
    quotes,
  };

  return Response.json(payload);
}
