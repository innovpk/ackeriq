"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type * as LType from "leaflet";
import type { AppLanguage, FarmXrayData, GibsLayerId } from "@/types/ackeriq";
import { isInsideBadenWuerttemberg } from "@/lib/farmAerialUrl";
import { buildDynamicGibsLayers } from "@/lib/nasaGibs";
import {
  computePolygonCentroid,
  computePolygonHectares,
  parseFieldBoundaryFile,
} from "@/lib/fieldBoundaryGeo";
import {
  Check,
  Crosshair,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  PenTool,
  RotateCcw,
  Upload,
  ZoomIn,
} from "lucide-react";

interface InteractiveFarmMapProps {
  xray: FarmXrayData;
  farmAreaHa: number;
  isScanning: boolean;
  lang?: AppLanguage;
  onMapClickCoordinate: (lat: number, lon: number) => void;
  onDrawnAreaChange?: (ha: number) => void;
  onCustomBoundaryChange?: (vertices: [number, number][] | null) => void;
}

export function InteractiveFarmMap({
  xray,
  farmAreaHa,
  isScanning,
  lang = "en",
  onMapClickCoordinate,
  onDrawnAreaChange,
  onCustomBoundaryChange,
}: InteractiveFarmMapProps) {
  const [gibsRefIso, setGibsRefIso] = useState<string | null>(null);
  const gibsLayers = useMemo(
    () => buildDynamicGibsLayers(gibsRefIso ?? xray.fetchedAtIso),
    [gibsRefIso, xray.fetchedAtIso]
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const leafletModRef = useRef<typeof LType | null>(null);
  const parcelLayerGroupRef = useRef<LType.LayerGroup | null>(null);
  const gibsTileRef = useRef<LType.TileLayer | null>(null);
  const bwDopLayerRef = useRef<LType.TileLayer.WMS | null>(null);

  const clickCallbackRef = useRef(onMapClickCoordinate);
  const drawnAreaCallbackRef = useRef(onDrawnAreaChange);
  const customBoundaryCallbackRef = useRef(onCustomBoundaryChange);
  const isDrawingRef = useRef<boolean>(false);
  const hasCustomPolyRef = useRef<boolean>(false);
  const latestViewRef = useRef({
    lat: xray.lat,
    lon: xray.lon,
    zoom: 14,
  });

  const [activeGibs, setActiveGibs] = useState<GibsLayerId>("none");
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [showZoneOverlay, setShowZoneOverlay] = useState<boolean>(true);
  const [isCloseupZoom, setIsCloseupZoom] = useState<boolean>(false);
  const [customVertices, setCustomVertices] = useState<Array<[number, number]>>(
    []
  );
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number }>(
    {
      lat: xray.lat,
      lon: xray.lon,
    }
  );
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    clickCallbackRef.current = onMapClickCoordinate;
  }, [onMapClickCoordinate]);

  useEffect(() => {
    drawnAreaCallbackRef.current = onDrawnAreaChange;
  }, [onDrawnAreaChange]);

  useEffect(() => {
    customBoundaryCallbackRef.current = onCustomBoundaryChange;
  }, [onCustomBoundaryChange]);

  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);

  useEffect(() => {
    hasCustomPolyRef.current = customVertices.length >= 3;
    customBoundaryCallbackRef.current?.(
      customVertices.length >= 3 ? customVertices : null
    );
  }, [customVertices]);

  async function handleBoundaryFileSelect(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const ring = parseFieldBoundaryFile(text, file.name);
      if (!ring || ring.length < 3) {
        setImportNotice(
          lang === "de"
            ? "Kein gültiges Polygon in Datei gefunden."
            : "No valid field polygon found in file."
        );
        setTimeout(() => setImportNotice(null), 3500);
        return;
      }

      setIsDrawing(false);
      setShowZoneOverlay(true);
      setCustomVertices(ring);

      const calcHa = computePolygonHectares(ring);
      onDrawnAreaChange?.(calcHa);

      const [cLat, cLon] = computePolygonCentroid(ring);
      onMapClickCoordinate(cLat, cLon);

      const L = leafletModRef.current;
      const map = mapRef.current;
      if (L && map) {
        map.fitBounds(L.latLngBounds(ring), {
          padding: [28, 28],
          animate: false,
        });
      }

      setImportNotice(
        lang === "de"
          ? `${file.name} geladen (${calcHa} ha)`
          : `Imported ${file.name} (${calcHa} ha)`
      );
      setTimeout(() => setImportNotice(null), 3500);
    } catch {
      setImportNotice(
        lang === "de"
          ? "Datei konnte nicht gelesen werden."
          : "Could not read boundary file."
      );
      setTimeout(() => setImportNotice(null), 3500);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || !containerRef.current.isConnected) {
        return;
      }

      leafletModRef.current = L;

      const map = L.map(containerRef.current, {
        center: [xray.lat, xray.lon],
        zoom: 14,
        maxZoom: 20,
        zoomControl: true,
        attributionControl: true,
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
          attribution:
            "Imagery &copy; LGL-BW DOP20 &amp; Esri &mdash; NASA Earthdata",
        }
      ).addTo(map);

      // Official 20cm Baden-Württemberg Aerial Orthophoto WMS (sharp rooftops, barns & crop rows)
      const bwDop = L.tileLayer.wms(
        "https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_LGL-BW_ATKIS_DOP_20_C",
        {
          layers: "IMAGES_DOP_20_RGB",
          format: "image/jpeg",
          transparent: false,
          maxZoom: 20,
          minZoom: 14,
          zIndex: 2,
        }
      );
      if (isInsideBadenWuerttemberg(xray.lat, xray.lon)) {
        bwDop.addTo(map);
      }
      bwDopLayerRef.current = bwDop;

      L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        {
          maxNativeZoom: 17,
          maxZoom: 17,
          opacity: 0.75,
          zIndex: 4,
        }
      ).addTo(map);

      L.control
        .scale({ imperial: false, metric: true, position: "bottomleft" })
        .addTo(map);

      const group = L.layerGroup().addTo(map);
      parcelLayerGroupRef.current = group;

      map.on("mousemove", (e: LType.LeafletMouseEvent) => {
        setCursorCoords({
          lat: Number(e.latlng.lat.toFixed(4)),
          lon: Number(e.latlng.lng.toFixed(4)),
        });
      });

      map.on("click", (e: LType.LeafletMouseEvent) => {
        if (isDrawingRef.current) {
          setCustomVertices((prev) => {
            const next: Array<[number, number]> = [
              ...prev,
              [e.latlng.lat, e.latlng.lng],
            ];
            if (next.length >= 3 && drawnAreaCallbackRef.current) {
              const calcHa = Math.max(
                1,
                Math.round(computePolygonHectares(next))
              );
              drawnAreaCallbackRef.current(calcHa);
            }
            return next;
          });
          return;
        }
        if (!hasCustomPolyRef.current) {
          clickCallbackRef.current(e.latlng.lat, e.latlng.lng);
        }
      });

      mapRef.current = map;
      setMapReady(true);

      if (containerRef.current && typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => {
          const activeMap = mapRef.current;
          const el = containerRef.current;
          if (cancelled || !activeMap || !el || !el.isConnected) return;
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;

          try {
            activeMap.invalidateSize({ animate: false, pan: false });
            if (!isDrawingRef.current && !hasCustomPolyRef.current) {
              activeMap.setView(
                [latestViewRef.current.lat, latestViewRef.current.lon],
                latestViewRef.current.zoom,
                { animate: false }
              );
            }
          } catch {
            // Safely ignore transient layout pass during step unmount
          }
        });
        ro.observe(containerRef.current);
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (ro) {
        ro.disconnect();
        ro = null;
      }
      const m = mapRef.current;
      mapRef.current = null;
      parcelLayerGroupRef.current = null;
      gibsTileRef.current = null;
      bwDopLayerRef.current = null;
      if (m) {
        try {
          m.stop();
          m.off();
          m.remove();
        } catch {
          // Ignore teardown if pane was already detached
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sizeZoomTier =
    farmAreaHa < 65 ? 15 : farmAreaHa <= 260 ? 14 : farmAreaHa <= 850 ? 13 : 12;

  useEffect(() => {
    const targetZoom =
      activeGibs !== "none" ? 9 : isCloseupZoom ? 18 : sizeZoomTier;
    latestViewRef.current = { lat: xray.lat, lon: xray.lon, zoom: targetZoom };
    const map = mapRef.current;
    const bwDop = bwDopLayerRef.current;

    if (
      !map ||
      !mapReady ||
      !containerRef.current ||
      !containerRef.current.isConnected
    ) {
      return;
    }

    try {
      if (bwDop) {
        if (isInsideBadenWuerttemberg(xray.lat, xray.lon)) {
          if (!map.hasLayer(bwDop)) bwDop.addTo(map);
        } else if (map.hasLayer(bwDop)) {
          map.removeLayer(bwDop);
        }
      }

      if (!isDrawingRef.current && !hasCustomPolyRef.current) {
        map.setView([xray.lat, xray.lon], targetZoom, { animate: false });
      }
    } catch {
      // Ignore if map container is detaching
    }
    setCursorCoords({ lat: xray.lat, lon: xray.lon });
  }, [xray.lat, xray.lon, activeGibs, isCloseupZoom, sizeZoomTier, mapReady]);

  // Render either Custom Drawn Boundary OR 4-Zone Scaled Grid
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletModRef.current;
    const group = parcelLayerGroupRef.current;
    if (!map || !L || !group || !mapReady) return;

    group.clearLayers();

    // 1. Custom User-Drawn Field Polygon Mode
    if (customVertices.length > 0) {
      if (customVertices.length >= 3) {
        const calcHa = computePolygonHectares(customVertices);
        const customPoly = L.polygon(customVertices, {
          color: "#FFFFFF",
          weight: 2.5,
          fillColor: "#16A34A",
          fillOpacity: 0.35,
        });
        customPoly.addTo(group);

        const cLat =
          customVertices.reduce((s, p) => s + p[0], 0) / customVertices.length;
        const cLon =
          customVertices.reduce((s, p) => s + p[1], 0) / customVertices.length;

        L.marker([cLat, cLon], {
          interactive: false,
          icon: L.divIcon({
            className: "",
            html: `<div style="transform:translate(-50%,-50%);display:inline-block;padding:3px 9px;border-radius:999px;background:rgba(6,78,59,0.92);color:#fff;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;font-weight:700;white-space:nowrap;border:1.5px solid #fff;">${calcHa.toFixed(
              1
            )} ha</div>`,
          }),
        }).addTo(group);
      } else if (customVertices.length === 2) {
        L.polyline(customVertices, {
          color: "#10B981",
          weight: 2.5,
          dashArray: "6 4",
        }).addTo(group);
      }

      customVertices.forEach((pt) => {
        L.circleMarker(pt, {
          radius: 5.5,
          color: "#065F46",
          weight: 2,
          fillColor: "#FFFFFF",
          fillOpacity: 1,
        }).addTo(group);
      });

      return;
    }

    // 2. Default 4-Zone Scaled Grid Mode
    const areaScale = Math.sqrt(Math.max(5, farmAreaHa) / 100);

    const resolveParcelStyle = (
      zoneType: FarmXrayData["parcels"][number]["zoneType"]
    ): { stroke: string; fill: string; tag: string; fillOpacity: number } => {
      const baseOpacity = activeGibs === "none" ? 0.28 : 0.16;

      if (zoneType === "sloped_erosion") {
        return {
          stroke: "#F59E0B",
          fill: "#D97706",
          tag: "Hillside Runoff Risk",
          fillOpacity: baseOpacity,
        };
      }
      if (zoneType === "drought_prone") {
        return {
          stroke: "#FB7185",
          fill: "#E11D48",
          tag: "Dries Fast in Summer",
          fillOpacity: baseOpacity,
        };
      }
      return {
        stroke: "#22C55E",
        fill: "#16A34A",
        tag: "Holds Moisture Well",
        fillOpacity: baseOpacity,
      };
    };

    if (showZoneOverlay) {
      xray.parcels.forEach((parcel) => {
        const style = resolveParcelStyle(parcel.zoneType);
        const scaledPolygon: Array<[number, number]> = parcel.polygon.map(
          ([pLat, pLon]) => [
            xray.lat + (pLat - xray.lat) * areaScale,
            xray.lon + (pLon - xray.lon) * areaScale,
          ]
        );
        const parcelHa = Math.max(
          1,
          Math.round((farmAreaHa * parcel.sharePct) / 100)
        );

        const poly = L.polygon(scaledPolygon, {
          color: style.stroke,
          weight: 2.3,
          fillColor: style.fill,
          fillOpacity: style.fillOpacity,
        });

        poly.bindTooltip(
          `<div style="font-family: ui-sans-serif, system-ui; font-size: 12px; line-height: 1.4;">
            <strong>${parcel.name} — ${parcelHa} ha</strong> (${parcel.sharePct}% of ${farmAreaHa} ha)<br/>
            <span style="color:#15803D; font-weight:600;">${style.tag}</span><br/>
            <span style="color:#52525B;">${parcel.note}</span>
          </div>`,
          { sticky: true }
        );

        poly.addTo(group);

        if (activeGibs === "none") {
          const centerLat =
            scaledPolygon.reduce((sum, pt) => sum + pt[0], 0) /
            scaledPolygon.length;
          const centerLon =
            scaledPolygon.reduce((sum, pt) => sum + pt[1], 0) /
            scaledPolygon.length;

          L.marker([centerLat, centerLon], {
            interactive: false,
            icon: L.divIcon({
              className: "",
              html: `<div style="transform:translate(-50%,-50%);display:inline-block;padding:1px 6px;border-radius:999px;background:rgba(24,24,27,0.72);color:#fff;font-family:ui-monospace,SFMono-Regular,monospace;font-size:10px;font-weight:600;white-space:nowrap;pointer-events:none;">${parcelHa} ha</div>`,
            }),
          }).addTo(group);
        }
      });
    }

    L.circleMarker([xray.lat, xray.lon], {
      radius: 7,
      color: "#FFFFFF",
      weight: 2.5,
      fillColor: "#15803D",
      fillOpacity: 1,
    })
      .bindTooltip(
        `${xray.name} · ${farmAreaHa} ha (${xray.lat.toFixed(3)}°N, ${xray.lon.toFixed(3)}°E)`
      )
      .addTo(group);
  }, [
    xray,
    farmAreaHa,
    activeGibs,
    customVertices,
    showZoneOverlay,
    mapReady,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletModRef.current;
    if (!map || !L || !mapReady) return;

    if (gibsTileRef.current) {
      map.removeLayer(gibsTileRef.current);
      gibsTileRef.current = null;
    }

    if (activeGibs !== "none") {
      const cfg = gibsLayers[activeGibs];
      const layer = L.tileLayer(cfg.url, {
        opacity: 0.68,
        maxNativeZoom: cfg.maxNativeZoom,
        maxZoom: 18,
      });
      layer.addTo(map);
      gibsTileRef.current = layer;
    }
  }, [activeGibs, gibsLayers, mapReady]);

  const drawnHa =
    customVertices.length >= 3 ? computePolygonHectares(customVertices) : 0;

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white overflow-hidden flex flex-col h-full shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.04)]">
      {/* Clean Light Map Toolbar + Draw Field Polygon + GeoJSON/KML Import */}
      <div className="px-4 py-3 bg-zinc-50/80 border-b border-zinc-200/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Layers className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="text-xs font-semibold text-zinc-800 mr-0.5">
            {lang === "de" ? "Satellitenkarte" : "Field Satellite Map"}
          </span>

          {/* Draw Real Field Boundary Button */}
          <button
            type="button"
            onClick={() => {
              if (isDrawing) {
                setIsDrawing(false);
                if (customVertices.length >= 3) {
                  const [cLat, cLon] = computePolygonCentroid(customVertices);
                  onMapClickCoordinate(cLat, cLon);
                }
              } else {
                setCustomVertices([]);
                setIsDrawing(true);
              }
            }}
            className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors border ${
              isDrawing
                ? "bg-amber-600 border-amber-600 text-white"
                : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900"
            }`}
          >
            {isDrawing ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{lang === "de" ? "Fertig" : "Done"}</span>
              </>
            ) : (
              <>
                <PenTool className="w-3.5 h-3.5 text-emerald-700" />
                <span>{lang === "de" ? "Zeichnen" : "Draw Field"}</span>
              </>
            )}
          </button>

          {/* Upload Real GeoJSON / KML Parcel Boundary */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml"
            onChange={handleBoundaryFileSelect}
            className="hidden"
            aria-label="Import field boundary GeoJSON or KML"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={
              lang === "de"
                ? "Schlaggrenze als GeoJSON oder KML importieren (z.B. FIONA-Export)"
                : "Import real field boundary (.geojson or .kml)"
            }
            className="min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors border bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-800"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-700" />
            <span>{lang === "de" ? "GeoJSON / KML" : "Import GeoJSON"}</span>
          </button>

          {/* 20cm Close-Up Aerial Zoom of Owner's Real Farmstead & Fields */}
          <button
            type="button"
            onClick={() => {
              setActiveGibs("none");
              const nextCloseup = !isCloseupZoom;
              setIsCloseupZoom(nextCloseup);
              if (nextCloseup) {
                setShowZoneOverlay(false);
              } else {
                setShowZoneOverlay(true);
              }
            }}
            title={
              lang === "de"
                ? "Echte 20cm-Luftbild-Nahaufnahme Ihres Hofes"
                : "Zoom into crisp 20cm real satellite/aerial view of owner's farm"
            }
            className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors border ${
              isCloseupZoom
                ? "bg-emerald-700 border-emerald-700 text-white"
                : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-800"
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>
              {isCloseupZoom
                ? lang === "de"
                  ? "Gesamtfeld"
                  : "Full Field"
                : lang === "de"
                ? "Hof-Zoom (20cm)"
                : "20cm Zoom"}
            </span>
          </button>

          {/* Toggle Zone Boxes On / Pure Unobstructed Satellite */}
          <button
            type="button"
            onClick={() => setShowZoneOverlay((v) => !v)}
            title={
              lang === "de"
                ? "Zonen-Überlagerung ein-/ausblenden für reines Satellitenbild"
                : "Hide or show colored zone boxes for unobstructed real satellite view"
            }
            className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors border ${
              !showZoneOverlay
                ? "bg-zinc-900 border-zinc-900 text-white"
                : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700"
            }`}
          >
            {showZoneOverlay ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                <span>{lang === "de" ? "Reines Bild" : "Pure Satellite"}</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>{lang === "de" ? "Zonen zeigen" : "Show Zones"}</span>
              </>
            )}
          </button>

          {customVertices.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsDrawing(false);
                setCustomVertices([]);
              }}
              className="min-h-[30px] px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{lang === "de" ? "Raster" : "Reset"}</span>
            </button>
          )}
        </div>

        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="NASA satellite map layers"
        >
          <button
            type="button"
            onClick={() => setActiveGibs("none")}
            className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
              activeGibs === "none"
                ? "bg-emerald-700 border-emerald-700 text-white"
                : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {lang === "de" ? "Foto" : "Photo"}
          </button>
          {(Object.keys(gibsLayers) as Array<Exclude<GibsLayerId, "none">>).map(
            (key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setGibsRefIso(new Date().toISOString());
                  setActiveGibs(key);
                }}
                className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  activeGibs === key
                    ? "bg-emerald-700 border-emerald-700 text-white"
                    : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {gibsLayers[key].label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Map Viewport — Fluid & Fits 100% Inside Visible Viewport */}
      <div
        className={`relative h-[290px] sm:h-[340px] lg:h-[calc(100dvh-260px)] lg:min-h-[320px] lg:max-h-[520px] flex-1 w-full bg-zinc-100 ${
          isDrawing ? "cursor-crosshair" : ""
        }`}
      >
        <div ref={containerRef} className="w-full h-full" />

        {/* GeoJSON / KML Import Feedback Pill */}
        {importNotice && (
          <div
            role="status"
            aria-live="polite"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-[490] px-3.5 py-1.5 rounded-full bg-emerald-900/95 text-white text-xs font-medium shadow-md whitespace-nowrap"
          >
            {importNotice}
          </div>
        )}

        {/* Draw Mode Floating Instruction Pill */}
        {isDrawing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[460] px-3.5 py-1.5 rounded-full bg-amber-950/90 text-white text-xs font-medium shadow-md whitespace-nowrap">
            {customVertices.length < 3
              ? lang === "de"
                ? `Feldecken anklicken (${customVertices.length}/3 Punkte)...`
                : `Click field corners on map (${customVertices.length}/3 points)...`
              : lang === "de"
              ? `Gezeichnet: ${drawnHa} ha — weitere Punkte oder "Fertig"`
              : `Drawn: ${drawnHa} ha — add corners or click "Done"`}
          </div>
        )}

        {isScanning && (
          <div
            role="status"
            aria-live="polite"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] px-4 py-2 rounded-full bg-white/95 text-zinc-900 border border-emerald-600/40 shadow-md flex items-center gap-2 text-xs font-medium"
          >
            <Loader2 className="w-3.5 h-3.5 text-emerald-700 animate-spin" />
            <span>
              {lang === "de"
                ? "NASA Klima-, Hang- & Bodendaten laden..."
                : "Scanning NASA weather, slope & soil..."}
            </span>
          </div>
        )}

        <div className="absolute bottom-3 right-3 z-[400] bg-white/95 backdrop-blur-xs text-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 font-mono text-[11px] flex items-center gap-2 shadow-sm">
          <Crosshair className="w-3.5 h-3.5 text-emerald-700" />
          <span className="tabular-nums">
            {cursorCoords.lat.toFixed(4)}°N, {cursorCoords.lon.toFixed(4)}°E
          </span>
        </div>
      </div>

      {/* Simple Plain-English / German Legend */}
      <div className="px-4 py-2.5 bg-zinc-50/80 border-t border-zinc-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
            {lang === "de" ? "Gute Feuchte" : "Good Moisture"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
            {lang === "de" ? "Hangerosion" : "Slope Runoff"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
            {lang === "de" ? "Juli-Hitzestress" : "July Heat Stress"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" />
            {lang === "de" ? "Winter-Auswaschung" : "Winter Leaching"}
          </span>
        </div>
        <span className="font-mono text-[11px] text-zinc-500">
          {activeGibs === "none"
            ? `${xray.elevationM}m · ${xray.slopePct.toFixed(1)}% slope`
            : gibsLayers[activeGibs].legend}
        </span>
      </div>
    </div>
  );
}
