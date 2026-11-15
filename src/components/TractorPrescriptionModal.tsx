"use client";

import React, { useMemo, useState } from "react";
import { ResilientImage } from "@/components/ResilientImage";
import type { FarmXrayData, RotationStrategyResult } from "@/types/ackeriq";
import { buildFarmAerialUrl } from "@/lib/farmAerialUrl";
import { buildGeoreferencedZones } from "@/lib/fieldBoundaryGeo";
import { Check, Download, FileJson, Tractor, X } from "lucide-react";

interface TractorPrescriptionModalProps {
  xray: FarmXrayData;
  strategy: RotationStrategyResult;
  farmAreaHa: number;
  customPolygon?: [number, number][] | null;
  onClose: () => void;
}

function escapeXml(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatIso11783RingXml(
  ring: [number, number][],
  indent = "        "
): string {
  if (ring.length === 0) return "";
  const closed = [...ring, ring[0]];
  return closed
    .map(
      ([lat, lon]) =>
        `${indent}<PNT A="2" C="${lat.toFixed(6)}" D="${lon.toFixed(6)}"/>`
    )
    .join("\n");
}

export function TractorPrescriptionModal({
  xray,
  strategy,
  farmAreaHa,
  customPolygon,
  onClose,
}: TractorPrescriptionModalProps) {
  const [selectedYearIdx, setSelectedYearIdx] = useState<number>(0);
  const [downloadedFormat, setDownloadedFormat] = useState<
    "isoxml" | "geojson" | null
  >(null);

  const activeStep = strategy.steps[selectedYearIdx] ?? strategy.steps[0];
  const baseN = activeStep.syntheticNAppliedKgHa;

  const georefParcels = useMemo(
    () =>
      buildGeoreferencedZones(
        xray.parcels,
        xray.lat,
        xray.lon,
        xray.defaultAreaHa,
        farmAreaHa,
        customPolygon
      ),
    [xray.parcels, xray.lat, xray.lon, xray.defaultAreaHa, farmAreaHa, customPolygon]
  );

  // Compute variable-rate Nitrogen (kg N/ha) per georeferenced sub-parcel zone
  const zoneRates = georefParcels.map((parcel) => {
    const ha = Math.max(1, Math.round((farmAreaHa * parcel.sharePct) / 100));
    if (baseN === 0) {
      return {
        ...parcel,
        ha,
        rateKgHa: 0,
        colorFill: "#16A34A",
        badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
        label: "0 kg N (Legume Fixation)",
      };
    }
    if (parcel.zoneType === "sloped_erosion") {
      const r = Math.max(20, Math.round(baseN * 0.82));
      return {
        ...parcel,
        ha,
        rateKgHa: r,
        colorFill: "#F59E0B",
        badgeBg: "bg-amber-50 text-amber-900 border-amber-200",
        label: `${r} kg N/ha (-18% Slope Cap)`,
      };
    }
    if (parcel.zoneType === "drought_prone") {
      const r = Math.max(20, Math.round(baseN * 0.88));
      return {
        ...parcel,
        ha,
        rateKgHa: r,
        colorFill: "#0EA5E9",
        badgeBg: "bg-sky-50 text-sky-900 border-sky-200",
        label: `${r} kg N/ha (Dry Ridge Rate)`,
      };
    }
    const r = Math.round(baseN * 1.08);
    return {
      ...parcel,
      ha,
      rateKgHa: r,
      colorFill: "#15803D",
      badgeBg: "bg-emerald-50 text-emerald-900 border-emerald-200",
      label: `${r} kg N/ha (High-Yield Valley)`,
    };
  });

  // Exterior partfield boundary (custom drawn/uploaded polygon or bounding hull of 4 sub-parcels)
  const exteriorRing: [number, number][] = useMemo(() => {
    if (customPolygon && customPolygon.length >= 3) {
      return customPolygon;
    }
    const allPts = georefParcels.flatMap((p) => p.scaledPolygon);
    const lats = allPts.map((p) => p[0]);
    const lons = allPts.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    return [
      [minLat, minLon],
      [maxLat, minLon],
      [maxLat, maxLon],
      [minLat, maxLon],
    ];
  }, [customPolygon, georefParcels]);

  function handleDownloadIsoxml() {
    const areaSqMeters = Math.round(farmAreaHa * 10_000);
    const cropLabel = escapeXml(activeStep.crop.name.split(" (")[0]);
    const farmLabel = escapeXml(xray.name);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ISO11783_TaskData VersionMajor="4" VersionMinor="3" ManagementSoftwareManufacturer="AckerIQ" ManagementSoftwareVersion="2026.2" DataTransferOrigin="1">
  <!-- Georeferenced Partfield Boundary (WGS84) -->
  <PFD A="PFD-1" C="${farmLabel}" D="${areaSqMeters}">
    <PLN A="1" C="Exterior Field Boundary">
      <LSG A="1">
${formatIso11783RingXml(exteriorRing, "        ")}
      </LSG>
    </PLN>
  </PFD>
  <!-- Variable-Rate Nitrogen Prescription Task (DDI 0002: Application Rate mg/m2 = kg/ha * 100) -->
  <TSK A="TSK-1" B="${farmLabel} - ${cropLabel} (Yr ${activeStep.year})" E="PFD-1" G="1">
${zoneRates
  .map(
    (z, idx) => `    <TZN A="${idx + 1}" B="${escapeXml(z.name)} (${z.ha} ha)">
      <PLN A="2" C="${escapeXml(z.name)}">
        <LSG A="1">
${formatIso11783RingXml(z.scaledPolygon, "          ")}
        </LSG>
      </PLN>
      <PDV A="0002" B="${z.rateKgHa * 100}" C="PDP-1"/>
    </TZN>`
  )
  .join("\n")}
  </TSK>
</ISO11783_TaskData>`;

    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TASKDATA_Yr${activeStep.year}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadedFormat("isoxml");
    setTimeout(() => setDownloadedFormat(null), 3000);
  }

  function handleDownloadGeoJson() {
    const featureCollection = {
      type: "FeatureCollection",
      name: `AckerIQ_VRA_Yr${activeStep.year}`,
      properties: {
        farmName: xray.name,
        farmAreaHa,
        year: activeStep.year,
        crop: activeStep.crop.name.split(" (")[0],
        fao56EtcMm: activeStep.fao56EtcMm,
        ipccCo2eKgHa: activeStep.co2eKgHa,
        boundarySource:
          customPolygon && customPolygon.length >= 3
            ? "custom_field_polygon"
            : "sub_parcel_grid",
      },
      features: zoneRates.map((z, idx) => {
        const closedGeoJsonRing = [
          ...z.scaledPolygon.map(([lat, lon]) => [lon, lat]),
          [z.scaledPolygon[0][1], z.scaledPolygon[0][0]],
        ];
        return {
          type: "Feature",
          id: `zone-${idx + 1}`,
          properties: {
            zoneId: idx + 1,
            zoneName: z.name,
            zoneType: z.zoneType,
            areaHa: z.ha,
            targetNitrogenKgHa: z.rateKgHa,
            crop: activeStep.crop.name.split(" (")[0],
          },
          geometry: {
            type: "Polygon",
            coordinates: [closedGeoJsonRing],
          },
        };
      }),
    };

    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AckerIQ_Prescription_Yr${activeStep.year}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadedFormat("geojson");
    setTimeout(() => setDownloadedFormat(null), 3000);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tractor variable-rate Nitrogen prescription map"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="max-w-6xl w-full max-h-[92vh] overflow-y-auto rounded-3xl bg-white border border-zinc-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Bar */}
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
              <Tractor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-zinc-950">
                  Tractor Variable-Rate N Map
                </h2>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  ISO 11783-10 · WGS84
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                {xray.name}
                {customPolygon && customPolygon.length >= 3
                  ? ` · Custom Polygon (${customPolygon.length} GPS pts)`
                  : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close tractor map preview"
            className="w-9 h-9 rounded-xl border border-zinc-200 hover:bg-zinc-50 flex items-center justify-center text-zinc-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Year Switcher */}
        <div className="px-5 py-3 bg-zinc-50/80 border-b border-zinc-200/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {strategy.steps.map((s, idx) => (
              <button
                key={s.year}
                type="button"
                onClick={() => setSelectedYearIdx(idx)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                  idx === selectedYearIdx
                    ? "bg-emerald-700 border-emerald-700 text-white"
                    : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                Yr {s.year}: {s.crop.name.split(" (")[0]}
              </button>
            ))}
          </div>

          <span className="font-mono text-xs font-semibold text-zinc-700">
            Avg: {baseN} kg N/ha
          </span>
        </div>

        {/* Visual Split: Satellite Photo + Zone Prescription Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Left: Real Satellite / Orthophoto View of Owner's Farm + 4-Zone ISOXML Overlay */}
          <div className="relative h-[360px] md:h-full md:min-h-[470px] md:col-span-7 bg-zinc-900 overflow-hidden">
            <ResilientImage
              src={buildFarmAerialUrl({
                lat: xray.lat,
                lon: xray.lon,
                farmAreaHa,
                mode: "field",
              })}
              alt={`Live satellite prescription view of ${xray.name}`}
              eager
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/35" />

            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-xs text-[10px] font-mono font-semibold text-white">
              {xray.lat.toFixed(4)}°N, {xray.lon.toFixed(4)}°E · Live Satellite
            </span>

            {/* Floating Terminal Prescription Overlay */}
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/95 backdrop-blur-md p-3.5 border border-white/60 shadow-lg">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 mb-2">
                <span>TERMINAL ZONE MAP · {farmAreaHa} HA</span>
                <span className="font-mono text-emerald-700">PLN / PNT GPS</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {zoneRates.map((z) => (
                  <div
                    key={z.id}
                    className="rounded-xl p-2.5 text-white flex flex-col justify-between"
                    style={{ backgroundColor: z.colorFill }}
                  >
                    <span className="text-[10px] font-medium opacity-90 truncate">
                      {z.name} ({z.ha} ha)
                    </span>
                    <span className="text-sm font-mono font-bold tabular-nums mt-0.5">
                      {z.rateKgHa} kg N/ha
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Clean Zone Breakdown + 1-Click ISOXML & GeoJSON Exports */}
          <div className="md:col-span-5 p-5 sm:p-6 flex flex-col justify-between gap-4 bg-white">
            <div className="space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Georeferenced Sub-Parcel Spreading Rates
              </div>

              {zoneRates.map((z) => (
                <div
                  key={z.id}
                  className="rounded-xl border border-zinc-200/90 p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-zinc-950 truncate">
                      {z.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono truncate">
                      {z.ha} ha · {z.scaledPolygon[0][0].toFixed(4)}°N,{" "}
                      {z.scaledPolygon[0][1].toFixed(4)}°E
                    </div>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border tabular-nums shrink-0 ${z.badgeBg}`}
                  >
                    {z.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDownloadIsoxml}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              >
                {downloadedFormat === "isoxml" ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span>TASKDATA.XML Saved</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Export ISOXML</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadGeoJson}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-900 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {downloadedFormat === "geojson" ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>GeoJSON Saved</span>
                  </>
                ) : (
                  <>
                    <FileJson className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Export GeoJSON</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
