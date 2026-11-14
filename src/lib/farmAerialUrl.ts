export type AerialViewMode = "closeup" | "field" | "thumb";

/**
 * Builds a deterministic local API URL that streams real 20cm Baden-Württemberg
 * LGL orthophoto imagery (with automatic global Esri World Imagery fallback)
 * centered on the farm owner's exact GPS coordinates.
 */
export function buildFarmAerialUrl(params: {
  lat: number;
  lon: number;
  farmAreaHa?: number;
  mode?: AerialViewMode;
}): string {
  const lat = Number.isFinite(params.lat) ? params.lat : 48.706;
  const lon = Number.isFinite(params.lon) ? params.lon : 9.215;
  const mode: AerialViewMode = params.mode ?? "field";
  const ha = Math.max(5, Math.round(params.farmAreaHa ?? 120));

  const qs = new URLSearchParams({
    lat: lat.toFixed(5),
    lon: lon.toFixed(5),
    ha: String(ha),
    mode,
  });

  return `/api/farm-aerial?${qs.toString()}`;
}

export function isInsideBadenWuerttemberg(lat: number, lon: number): boolean {
  return lat >= 47.53 && lat <= 49.79 && lon >= 7.51 && lon <= 10.5;
}
