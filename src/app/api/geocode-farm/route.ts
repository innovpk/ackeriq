import { NextRequest } from "next/server";

export interface GeocodeFarmResult {
  id: string;
  shortTitle: string;
  fullAddress: string;
  lat: number;
  lon: number;
}

async function fetchWithTimeout<T>(url: string, timeoutMs = 3500): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AckerIQ-Stuttgart-NASASpaceApps/1.0",
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function formatCoordLabel(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lon).toFixed(4)}°${ew}`;
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return Response.json({ results: [] });
  }

  // Support direct "lat, lon" coordinate input globally (e.g., "49.142, 9.218" or "41.878, -93.097")
  const coordMatch = q.match(
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/
  );
  if (coordMatch) {
    const lat = Number(coordMatch[1]);
    const lon = Number(coordMatch[2]);
    if (lat >= -65 && lat <= 72 && lon >= -180 && lon <= 180) {
      const inGermany = lat >= 47 && lat <= 55 && lon >= 5 && lon <= 16;
      const formatted = formatCoordLabel(lat, lon);
      return Response.json({
        results: [
          {
            id: `coord-${lat}-${lon}`,
            shortTitle: `GPS Pin (${formatted})`,
            fullAddress: `${formatted} · ${inGermany ? "Germany" : "Global Coordinate"}`,
            lat,
            lon,
          },
        ] satisfies GeocodeFarmResult[],
      });
    }
  }

  // 1. Primary: Photon (Komoot OSM Geocoder — biased toward Stuttgart/BW first, with global support)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      q
    )}&lat=48.7758&lon=9.1829&limit=10`;

    interface PhotonResp {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: {
          osm_id?: number;
          name?: string;
          street?: string;
          housenumber?: string;
          postcode?: string;
          city?: string;
          county?: string;
          state?: string;
          country?: string;
          countrycode?: string;
        };
      }>;
    }

    const data = await fetchWithTimeout<PhotonResp>(photonUrl, 3200);
    const allFeatures = [...(data.features || [])].sort((a, b) => {
      const aDe = (a.properties?.countrycode || "").toUpperCase() === "DE" ? 0 : 1;
      const bDe = (b.properties?.countrycode || "").toUpperCase() === "DE" ? 0 : 1;
      return aDe - bDe;
    });

    if (allFeatures.length > 0) {
      const results: GeocodeFarmResult[] = [];
      const seen = new Set<string>();

      for (const f of allFeatures) {
        const coords = f.geometry?.coordinates;
        const p = f.properties;
        if (!coords || !p) continue;
        const [lon, lat] = coords;
        const cc = (p.countrycode || "").toUpperCase();

        const streetPart = p.street
          ? `${p.street}${p.housenumber ? ` ${p.housenumber}` : ""}`
          : p.name || "";
        const cityPart = [p.postcode, p.city || p.name]
          .filter(Boolean)
          .join(" ");
        const shortTitle =
          streetPart && p.city && streetPart !== p.city
            ? `${streetPart}, ${cityPart}`
            : cityPart || streetPart || "Farm Location";

        const fullAddress = [
          streetPart,
          cityPart !== streetPart ? cityPart : null,
          p.county,
          p.state,
          cc && cc !== "DE" ? p.country || cc : null,
        ]
          .filter(Boolean)
          .join(", ");

        const dedupeKey = `${shortTitle}-${lat.toFixed(3)}-${lon.toFixed(3)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        results.push({
          id: `osm-${p.osm_id ?? results.length}-${lat.toFixed(4)}`,
          shortTitle,
          fullAddress: fullAddress || shortTitle,
          lat: Number(lat.toFixed(5)),
          lon: Number(lon.toFixed(5)),
        });

        if (results.length >= 5) break;
      }

      if (results.length > 0) {
        return Response.json({ results });
      }
    }
  } catch {
    // Fall through to Nominatim backup
  }

  // 2. Fallback: OpenStreetMap Nominatim (Region Stuttgart viewbox priority, global unbounded support)
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&viewbox=8.65,49.05,9.55,48.45&bounded=0&limit=5&addressdetails=1&q=${encodeURIComponent(
      q
    )}`;

    interface NomItem {
      place_id: number;
      lat: string;
      lon: string;
      display_name: string;
      address?: {
        road?: string;
        house_number?: string;
        postcode?: string;
        village?: string;
        town?: string;
        city?: string;
        county?: string;
        state?: string;
        country?: string;
        country_code?: string;
      };
    }

    const items = await fetchWithTimeout<NomItem[]>(nomUrl, 3500);
    const results: GeocodeFarmResult[] = (items || []).map((item) => {
      const a = item.address || {};
      const locality = a.village || a.town || a.city || "";
      const street = a.road
        ? `${a.road}${a.house_number ? ` ${a.house_number}` : ""}`
        : "";
      const plzLocality = [a.postcode, locality].filter(Boolean).join(" ");
      const shortTitle =
        street && plzLocality
          ? `${street}, ${plzLocality}`
          : plzLocality || item.display_name.split(",").slice(0, 2).join(",");

      return {
        id: `nom-${item.place_id}`,
        shortTitle,
        fullAddress: item.display_name.split(",").slice(0, 4).join(","),
        lat: Number(Number(item.lat).toFixed(5)),
        lon: Number(Number(item.lon).toFixed(5)),
      };
    });

    return Response.json({ results });
  } catch {
    return Response.json({ results: [] });
  }
}
