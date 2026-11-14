import type { ParcelZone } from "@/types/ackeriq";

/**
 * Computes geodesic polygon area in hectares (ha) from WGS84 [lat, lon] vertices.
 */
export function computePolygonHectares(vertices: [number, number][]): number {
  if (vertices.length < 3) return 0;
  const meanLatRad =
    (vertices.reduce((s, v) => s + v[0], 0) / vertices.length) *
    (Math.PI / 180);
  const metersPerDegLat = 111_320;
  const metersPerDegLon = 111_320 * Math.cos(meanLatRad);

  let areaSqMeters = 0;
  for (let i = 0; i < vertices.length; i++) {
    const [lat1, lon1] = vertices[i];
    const [lat2, lon2] = vertices[(i + 1) % vertices.length];
    const x1 = lon1 * metersPerDegLon;
    const y1 = lat1 * metersPerDegLat;
    const x2 = lon2 * metersPerDegLon;
    const y2 = lat2 * metersPerDegLat;
    areaSqMeters += x1 * y2 - x2 * y1;
  }
  return Math.max(1, Math.round(Math.abs(areaSqMeters) / 2 / 10_000));
}

export function computePolygonCentroid(
  vertices: [number, number][]
): [number, number] {
  if (vertices.length === 0) return [48.706, 9.2158];
  const lat = vertices.reduce((s, p) => s + p[0], 0) / vertices.length;
  const lon = vertices.reduce((s, p) => s + p[1], 0) / vertices.length;
  return [lat, lon];
}

function normalizeRingLatLon(rawCoords: unknown): [number, number][] | null {
  if (!Array.isArray(rawCoords) || rawCoords.length < 3) return null;
  const pts: [number, number][] = [];
  for (const item of rawCoords) {
    if (
      Array.isArray(item) &&
      item.length >= 2 &&
      typeof item[0] === "number" &&
      typeof item[1] === "number"
    ) {
      // RFC 7946 GeoJSON order is [longitude, latitude]
      const lon = item[0];
      const lat = item[1];
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        pts.push([Number(lat.toFixed(6)), Number(lon.toFixed(6))]);
      }
    }
  }
  // Remove duplicate closing point if identical to first vertex
  if (pts.length > 3) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (
      Math.abs(first[0] - last[0]) < 1e-7 &&
      Math.abs(first[1] - last[1]) < 1e-7
    ) {
      pts.pop();
    }
  }
  return pts.length >= 3 ? pts : null;
}

function extractGeoJsonRing(node: unknown): [number, number][] | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const type = obj.type;

  if (type === "Polygon" && Array.isArray(obj.coordinates)) {
    return normalizeRingLatLon(obj.coordinates[0]);
  }
  if (type === "MultiPolygon" && Array.isArray(obj.coordinates)) {
    const firstPoly = obj.coordinates[0];
    if (Array.isArray(firstPoly)) {
      return normalizeRingLatLon(firstPoly[0]);
    }
  }
  if (type === "Feature") {
    return extractGeoJsonRing(obj.geometry);
  }
  if (type === "FeatureCollection" && Array.isArray(obj.features)) {
    for (const feat of obj.features) {
      const ring = extractGeoJsonRing(feat);
      if (ring) return ring;
    }
  }
  if (type === "GeometryCollection" && Array.isArray(obj.geometries)) {
    for (const geom of obj.geometries) {
      const ring = extractGeoJsonRing(geom);
      if (ring) return ring;
    }
  }
  return null;
}

function extractKmlRing(xmlText: string): [number, number][] | null {
  const match = xmlText.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
  if (!match) return null;
  const tokens = match[1].trim().split(/\s+/);
  const rawPairs: [number, number][] = [];
  for (const tok of tokens) {
    const parts = tok.split(",");
    if (parts.length >= 2) {
      const lon = Number(parts[0]);
      const lat = Number(parts[1]);
      if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
        rawPairs.push([lon, lat]);
      }
    }
  }
  return normalizeRingLatLon(rawPairs);
}

/**
 * Parses a farmer's uploaded .geojson, .json, or .kml field boundary file
 * into clean WGS84 [lat, lon] exterior polygon vertices.
 */
export function parseFieldBoundaryFile(
  content: string,
  filename: string
): [number, number][] | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const lower = filename.toLowerCase();
  if (lower.endsWith(".kml") || trimmed.startsWith("<")) {
    return extractKmlRing(trimmed);
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return extractGeoJsonRing(parsed);
  } catch {
    return extractKmlRing(trimmed);
  }
}

/**
 * Scales default sub-parcel polygons around farm center (lat, lon) to match farmAreaHa,
 * or subdivides a custom drawn/uploaded field boundary into 4 georeferenced management zones
 * so ISO 11783 TASKDATA.XML and GeoJSON exports carry true WGS84 polygon coordinates.
 */
export function buildGeoreferencedZones(
  parcels: ParcelZone[],
  centerLat: number,
  centerLon: number,
  defaultAreaHa: number,
  farmAreaHa: number,
  customPolygon?: [number, number][] | null
): Array<ParcelZone & { scaledPolygon: [number, number][] }> {
  if (customPolygon && customPolygon.length >= 3) {
    const lats = customPolygon.map((p) => p[0]);
    const lons = customPolygon.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const midLat = (minLat + maxLat) / 2;
    const midLon = (minLon + maxLon) / 2;

    // Build 4 clean quadrant sub-zones spanning the user's custom parcel extent
    const quadrants: [number, number][][] = [
      [
        [midLat, minLon],
        [maxLat, minLon],
        [maxLat, midLon],
        [midLat, midLon],
      ],
      [
        [midLat, midLon],
        [maxLat, midLon],
        [maxLat, maxLon],
        [midLat, maxLon],
      ],
      [
        [minLat, minLon],
        [midLat, minLon],
        [midLat, midLon],
        [minLat, midLon],
      ],
      [
        [minLat, midLon],
        [midLat, midLon],
        [midLat, maxLon],
        [minLat, maxLon],
      ],
    ];

    return parcels.map((p, idx) => ({
      ...p,
      scaledPolygon: (quadrants[idx % quadrants.length] ?? customPolygon).map(
        ([la, lo]) => [Number(la.toFixed(6)), Number(lo.toFixed(6))]
      ),
    }));
  }

  const baseArea = Math.max(10, defaultAreaHa || 165);
  const linearScale = Math.min(
    3.6,
    Math.max(0.45, Math.sqrt(farmAreaHa / baseArea))
  );

  return parcels.map((parcel) => ({
    ...parcel,
    scaledPolygon: parcel.polygon.map(([pLat, pLon]) => [
      Number((centerLat + (pLat - centerLat) * linearScale).toFixed(6)),
      Number((centerLon + (pLon - centerLon) * linearScale).toFixed(6)),
    ]),
  }));
}
