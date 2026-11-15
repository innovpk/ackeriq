"use client";

import React, { useEffect, useRef, useState } from "react";
import type * as LType from "leaflet";
import { ResilientImage } from "@/components/ResilientImage";
import type { AppLanguage, FarmXrayData } from "@/types/ackeriq";
import {
  buildFarmAerialUrl,
  isInsideBadenWuerttemberg,
} from "@/lib/farmAerialUrl";
import {
  Crosshair,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Satellite,
} from "lucide-react";

interface OwnerFarmSatelliteViewProps {
  xray: FarmXrayData;
  farmAreaHa: number;
  lang?: AppLanguage;
}

export function OwnerFarmSatelliteView({
  xray,
  farmAreaHa,
  lang = "en",
}: OwnerFarmSatelliteViewProps) {
  const [showZones, setShowZones] = useState<boolean>(true);
  const [interactivePanZoom, setInteractivePanZoom] = useState<boolean>(false);
  const [expandedFullWidth, setExpandedFullWidth] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(17);
  const [liveCenter, setLiveCenter] = useState<{ lat: number; lon: number }>({
    lat: xray.lat,
    lon: xray.lon,
  });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LType.Map | null>(null);

  const fieldSatelliteUrl = buildFarmAerialUrl({
    lat: xray.lat,
    lon: xray.lon,
    farmAreaHa,
    mode: "field",
  });

  const closeupAerialUrl = buildFarmAerialUrl({
    lat: xray.lat,
    lon: xray.lon,
    farmAreaHa,
    mode: "closeup",
  });

  const inBw = isInsideBadenWuerttemberg(xray.lat, xray.lon);
  const sourceBadge = inBw
    ? "LGL-BW DOP20 (20cm Real Aerial)"
    : "Esri World Imagery Satellite";

  const sideMeters = Math.round(Math.sqrt(Math.max(5, farmAreaHa) * 10_000));

  // Mount live interactive 20cm pan/zoom satellite map right inside Step 3 when toggled
  useEffect(() => {
    if (!interactivePanZoom) return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;

    async function mountCloseUpMap() {
      if (!mapContainerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (
        cancelled ||
        !mapContainerRef.current ||
        !mapContainerRef.current.isConnected
      ) {
        return;
      }

      const map = L.map(mapContainerRef.current, {
        center: [xray.lat, xray.lon],
        zoom: 17,
        minZoom: 12,
        maxZoom: 20,
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      });

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxNativeZoom: 18,
          maxZoom: 20,
          zIndex: 1,
        }
      ).addTo(map);

      if (isInsideBadenWuerttemberg(xray.lat, xray.lon)) {
        L.tileLayer
          .wms(
            "https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_LGL-BW_ATKIS_DOP_20_C",
            {
              layers: "IMAGES_DOP_20_RGB",
              format: "image/jpeg",
              transparent: false,
              maxZoom: 20,
              minZoom: 14,
              zIndex: 2,
            }
          )
          .addTo(map);
      }

      L.circleMarker([xray.lat, xray.lon], {
        radius: 6,
        color: "#ffffff",
        weight: 2,
        fillColor: "#10b981",
        fillOpacity: 1,
      }).addTo(map);

      map.on("moveend zoomend", () => {
        const c = map.getCenter();
        setLiveCenter({
          lat: Number(c.lat.toFixed(4)),
          lon: Number(c.lng.toFixed(4)),
        });
        setZoomLevel(map.getZoom());
      });

      mapRef.current = map;
      setZoomLevel(17);
      setLiveCenter({
        lat: Number(xray.lat.toFixed(4)),
        lon: Number(xray.lon.toFixed(4)),
      });

      if (mapContainerRef.current && typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => {
          const activeMap = mapRef.current;
          const el = mapContainerRef.current;
          if (cancelled || !activeMap || !el || !el.isConnected) return;
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          try {
            activeMap.invalidateSize({ animate: false, pan: false });
          } catch {
            // Ignore transient resize during toggle
          }
        });
        ro.observe(mapContainerRef.current);
      }
    }

    mountCloseUpMap();

    return () => {
      cancelled = true;
      if (ro) {
        ro.disconnect();
        ro = null;
      }
      const m = mapRef.current;
      mapRef.current = null;
      if (m) {
        try {
          m.stop();
          m.off();
          m.remove();
        } catch {
          // Ignore teardown race
        }
      }
    };
  }, [interactivePanZoom, xray.lat, xray.lon]);

  // Trigger Leaflet layout refresh when toggling between split and full-width
  useEffect(() => {
    if (!interactivePanZoom || !mapRef.current) return;
    const id = setTimeout(() => {
      try {
        mapRef.current?.invalidateSize({ animate: false, pan: false });
      } catch {
        // Ignore
      }
    }, 60);
    return () => clearTimeout(id);
  }, [expandedFullWidth, interactivePanZoom]);

  const handleZoomDelta = (delta: number) => {
    const m = mapRef.current;
    if (!m) return;
    const next = Math.min(20, Math.max(12, m.getZoom() + delta));
    m.setZoom(next, { animate: false });
    setZoomLevel(next);
  };

  const handleRecenter = () => {
    const m = mapRef.current;
    if (!m) return;
    m.setView([xray.lat, xray.lon], 17, { animate: false });
    setZoomLevel(17);
    setLiveCenter({
      lat: Number(xray.lat.toFixed(4)),
      lon: Number(xray.lon.toFixed(4)),
    });
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* 1. Left (7 cols): Full Owner's Farm Real Satellite / Orthophoto Footprint */}
      {!expandedFullWidth && (
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200/90 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Satellite className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="text-xs font-bold text-zinc-950">
                {lang === "de"
                  ? `Echtes Hof-Satellitenbild (${farmAreaHa} ha)`
                  : `Owner's Real Farm Satellite View (${farmAreaHa} ha)`}
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-800">
                {sourceBadge}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowZones((v) => !v)}
              className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors border ${
                showZones
                  ? "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700"
                  : "bg-zinc-900 border-zinc-900 text-white"
              }`}
            >
              {showZones ? (
                <>
                  <EyeOff className="w-3 h-3 text-zinc-500" />
                  <span>
                    {lang === "de" ? "Reines Luftbild" : "Pure Satellite"}
                  </span>
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3" />
                  <span>
                    {lang === "de" ? "4 Zonen zeigen" : "Show 4 Zones"}
                  </span>
                </>
              )}
            </button>
          </div>

          <div className="relative min-h-[300px] sm:min-h-[360px] lg:h-[calc(100dvh-295px)] lg:min-h-[430px] flex-1 w-full bg-zinc-900 overflow-hidden select-none">
            <ResilientImage
              src={fieldSatelliteUrl}
              alt={`Live satellite orthophoto of ${xray.name} at ${xray.lat.toFixed(
                4
              )}N, ${xray.lon.toFixed(4)}E`}
              eager
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
            />

            {/* Optional Translucent 4-Zone Agronomic Overlay on Real Imagery */}
            {showZones && (
              <div className="absolute inset-0 flex items-center justify-center p-5 pointer-events-none">
                <div className="w-[74%] h-[82%] grid grid-cols-2 grid-rows-2 gap-1.5">
                  {xray.parcels.slice(0, 4).map((parcel) => {
                    const zoneHa = Math.max(
                      1,
                      Math.round((farmAreaHa * parcel.sharePct) / 100)
                    );
                    const borderTint =
                      parcel.zoneType === "sloped_erosion"
                        ? "border-amber-400 bg-amber-500/20"
                        : parcel.zoneType === "drought_prone"
                        ? "border-rose-400 bg-rose-500/20"
                        : "border-emerald-400 bg-emerald-500/18";
                    return (
                      <div
                        key={parcel.id}
                        className={`rounded-lg border-2 ${borderTint} flex flex-col items-center justify-center p-1.5 text-center backdrop-blur-[0.5px]`}
                      >
                        <span className="px-2 py-0.5 rounded-full bg-black/75 text-white font-mono text-[10px] font-bold">
                          {zoneHa} ha
                        </span>
                        <span className="mt-0.5 px-1.5 py-0.5 rounded bg-black/60 text-white/95 text-[10px] font-medium truncate max-w-full">
                          {parcel.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Center Farm Pin */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <span className="w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-md block" />
            </div>

            {/* Bottom Coordinate & Scale HUD */}
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
              <span className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-xs text-[11px] font-mono text-white inline-flex items-center gap-1.5">
                <Crosshair className="w-3 h-3 text-emerald-400" />
                {xray.lat.toFixed(4)}°N, {xray.lon.toFixed(4)}°E
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-xs text-[11px] font-mono font-semibold text-zinc-900">
                ~{sideMeters}m × {sideMeters}m
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Right (5 cols or 12 cols when expanded): 20cm Real Close-Up with In-Place Interactive Pan / Zoom */}
      <div
        className={`${
          expandedFullWidth ? "lg:col-span-12" : "lg:col-span-5"
        } rounded-2xl border border-zinc-200/90 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.04)] flex flex-col`}
      >
        <div className="px-4 py-3 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-zinc-950">
            {lang === "de"
              ? "20cm Nahaufnahme (Hof & Fahrgassen)"
              : "20cm Real Close-Up (Farm & Crop Rows)"}
          </span>

          <div className="flex items-center gap-1.5">
            {interactivePanZoom && (
              <button
                type="button"
                onClick={() => setExpandedFullWidth((v) => !v)}
                className="min-h-[28px] px-2 py-0.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                title={
                  expandedFullWidth
                    ? "Return to split satellite view"
                    : "Expand interactive 20cm satellite across full width"
                }
              >
                {expandedFullWidth ? (
                  <>
                    <Minimize2 className="w-3 h-3" />
                    <span>{lang === "de" ? "Geteilt" : "Split View"}</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3 h-3" />
                    <span>{lang === "de" ? "Groß" : "Expand"}</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setInteractivePanZoom((prev) => {
                  const next = !prev;
                  if (!next) setExpandedFullWidth(false);
                  return next;
                });
              }}
              aria-pressed={interactivePanZoom}
              className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors border ${
                interactivePanZoom
                  ? "bg-emerald-700 border-emerald-700 text-white"
                  : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800"
              }`}
            >
              <Move className="w-3 h-3" />
              <span>
                {interactivePanZoom
                  ? lang === "de"
                    ? "Aktiv · Ziehen/Zoomen"
                    : "Live Pan / Zoom On"
                  : lang === "de"
                  ? "Schwenken / Zoom"
                  : "Pan / Zoom"}
              </span>
            </button>
          </div>
        </div>

        <div className="relative min-h-[300px] sm:min-h-[360px] lg:h-[calc(100dvh-295px)] lg:min-h-[430px] flex-1 w-full bg-zinc-900 overflow-hidden select-none">
          {interactivePanZoom ? (
            <>
              <div
                ref={mapContainerRef}
                className="absolute inset-0 w-full h-full z-10 cursor-grab active:cursor-grabbing"
              />

              {/* Crisp In-Card Zoom & Recenter Controls */}
              <div className="absolute top-2.5 right-2.5 z-20 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => handleZoomDelta(1)}
                  aria-label="Zoom in"
                  className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white text-zinc-900 border border-zinc-200 shadow-md flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleZoomDelta(-1)}
                  aria-label="Zoom out"
                  className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white text-zinc-900 border border-zinc-200 shadow-md flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRecenter}
                  aria-label="Reset center"
                  title={lang === "de" ? "Zentrieren" : "Recenter on farm"}
                  className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white text-emerald-800 border border-zinc-200 shadow-md flex items-center justify-center cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="absolute bottom-2.5 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
                <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-[11px] font-mono text-white truncate">
                  {liveCenter.lat.toFixed(4)}°N, {liveCenter.lon.toFixed(4)}°E ·
                  z{zoomLevel}
                </span>
                <span className="px-2 py-1 rounded-lg bg-emerald-700/95 text-[11px] font-mono font-semibold text-white shrink-0">
                  {lang === "de" ? "Ziehen zum Bewegen" : "Drag to Pan"}
                </span>
              </div>
            </>
          ) : (
            <div
              onClick={() => setInteractivePanZoom(true)}
              title={
                lang === "de"
                  ? "Klicken für interaktives Schwenken & Zoomen"
                  : "Click to enable live interactive pan & zoom"
              }
              className="absolute inset-0 cursor-zoom-in"
            >
              <ResilientImage
                src={closeupAerialUrl}
                alt={`20cm high-resolution aerial close-up of ${xray.name}`}
                eager
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />

              {/* Target Reticle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-white/80 flex items-center justify-center pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow" />
              </div>

              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                <span className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-xs text-[11px] font-medium text-white truncate">
                  {xray.name}
                </span>
                <span className="px-2 py-1 rounded-lg bg-emerald-700/95 text-[11px] font-mono font-semibold text-white shrink-0">
                  {xray.elevationM}m · {xray.slopePct.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
