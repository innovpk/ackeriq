import { NextRequest } from "next/server";
import { isInsideBadenWuerttemberg } from "@/lib/farmAerialUrl";

function computeEpsg3857Bbox(
  lat: number,
  lon: number,
  widthPx: number,
  heightPx: number,
  spanMetersY: number
): string {
  const clampedLat = Math.max(-82, Math.min(82, lat));
  const rad = (clampedLat * Math.PI) / 180;
  const cosLat = Math.max(0.15, Math.cos(rad));

  const spanMetersX = spanMetersY * (widthPx / heightPx);

  const mx = (lon * 20037508.34) / 180;
  const my =
    (Math.log(Math.tan(((90 + clampedLat) * Math.PI) / 360)) * 20037508.34) /
    Math.PI;

  const dxMerc = spanMetersX / 2 / cosLat;
  const dyMerc = spanMetersY / 2 / cosLat;

  return [
    (mx - dxMerc).toFixed(2),
    (my - dyMerc).toFixed(2),
    (mx + dxMerc).toFixed(2),
    (my + dyMerc).toFixed(2),
  ].join(",");
}

async function fetchImageBuffer(
  url: string,
  timeoutMs: number
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AckerIQ-Stuttgart-NASASpaceApps/1.0",
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < 6000) return null;
    return { bytes, contentType: ct };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const latParam = Number(sp.get("lat"));
  const lonParam = Number(sp.get("lon"));
  const haParam = Number(sp.get("ha"));
  const mode = sp.get("mode") || "field";

  const lat = Number.isFinite(latParam) && sp.has("lat") ? latParam : 48.706;
  const lon = Number.isFinite(lonParam) && sp.has("lon") ? lonParam : 9.215;
  const farmAreaHa =
    Number.isFinite(haParam) && haParam > 0 ? haParam : 165;

  let widthPx = 960;
  let heightPx = 540;
  let spanMetersY = 950;

  if (mode === "closeup") {
    widthPx = 800;
    heightPx = 540;
    spanMetersY = 280; // ~280m x 415m ultra-crisp 20cm close-up of farmstead & crop rows
  } else if (mode === "thumb") {
    widthPx = 320;
    heightPx = 320;
    spanMetersY = 520;
  } else {
    // Scale framing to match owner's farm size (hectares)
    const sideMeters = Math.sqrt(Math.max(5, farmAreaHa) * 10_000);
    spanMetersY = Math.max(460, Math.min(3600, Math.round(sideMeters * 1.28)));
  }

  const bbox = computeEpsg3857Bbox(lat, lon, widthPx, heightPx, spanMetersY);

  // 1. Try Official State of Baden-Württemberg LGL 20cm Orthophoto (DOP20) first
  if (isInsideBadenWuerttemberg(lat, lon)) {
    const lglUrl = `https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_LGL-BW_ATKIS_DOP_20_C?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=IMAGES_DOP_20_RGB&SRS=EPSG:3857&BBOX=${bbox}&WIDTH=${widthPx}&HEIGHT=${heightPx}&FORMAT=image/jpeg&STYLES=`;
    const lglImg = await fetchImageBuffer(lglUrl, 3600);
    // Out-of-coverage blank white WMS tiles are < 12KB; real orthophotos are 35KB-220KB
    if (lglImg && lglImg.bytes.byteLength > 13_500) {
      return new Response(lglImg.bytes, {
        status: 200,
        headers: {
          "Content-Type": lglImg.contentType,
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          "X-Imagery-Source": "LGL-BW DOP20 (20cm Aerial)",
        },
      });
    }
  }

  // 2. Global High-Resolution Satellite Fallback (Esri World Imagery)
  const esriUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=${widthPx},${heightPx}&format=jpg&f=image`;
  const esriImg = await fetchImageBuffer(esriUrl, 4500);
  if (esriImg) {
    return new Response(esriImg.bytes, {
      status: 200,
      headers: {
        "Content-Type": esriImg.contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Imagery-Source": "Esri World Imagery Satellite",
      },
    });
  }

  // 3. Offline / Network Fallback Redirect to Local Aerial Hero
  return Response.redirect(
    new URL("/images/heilbronn-aerial-hero.jpg", request.url),
    302
  );
}
