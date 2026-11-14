"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";
import type { GeocodeFarmResult } from "@/app/api/geocode-farm/route";

interface FarmAddressSearchProps {
  onSelectAddress: (item: {
    lat: number;
    lon: number;
    shortTitle: string;
    fullAddress: string;
  }) => void;
  placeholder?: string;
  compact?: boolean;
}

export function FarmAddressSearch({
  onSelectAddress,
  placeholder = "Enter farm address, postal code (e.g. 70599 Plieningen), or village...",
  compact = false,
}: FarmAddressSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeFarmResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setStatusMsg(null);
      try {
        const res = await fetch(
          `/api/geocode-farm?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = (await res.json()) as { results?: GeocodeFarmResult[] };
          const list = data.results || [];
          setResults(list);
          setIsOpen(true);
          if (list.length === 0) {
            setStatusMsg(
              "No matching German address found — try a postal code (e.g. 70599) or village name."
            );
          }
        }
      } catch {
        // Ignore aborted typing requests
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    if (results.length > 0) {
      handlePick(results[0]);
      return;
    }

    setIsSearching(true);
    setStatusMsg(null);
    try {
      const res = await fetch(
        `/api/geocode-farm?q=${encodeURIComponent(trimmed)}`
      );
      if (res.ok) {
        const data = (await res.json()) as { results?: GeocodeFarmResult[] };
        const list = data.results || [];
        setResults(list);
        if (list.length > 0) {
          handlePick(list[0]);
        } else {
          setIsOpen(true);
          setStatusMsg(
            "Address not found — try a nearby village or 5-digit German PLZ."
          );
        }
      }
    } finally {
      setIsSearching(false);
    }
  }

  function handlePick(item: GeocodeFarmResult) {
    setQuery(item.shortTitle);
    setIsOpen(false);
    setStatusMsg(null);
    onSelectAddress({
      lat: item.lat,
      lon: item.lon,
      shortTitle: item.shortTitle,
      fullAddress: item.fullAddress,
    });
  }

  function handleUseGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatusMsg("Browser GPS is unavailable on this device.");
      return;
    }
    setIsLocatingGps(true);
    setStatusMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lon = Number(pos.coords.longitude.toFixed(5));
        const label = `GPS Location (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`;
        setQuery(label);
        setIsOpen(false);
        onSelectAddress({
          lat,
          lon,
          shortTitle: label,
          fullAddress: label,
        });
      },
      () => {
        setIsLocatingGps(false);
        setStatusMsg(
          "Location permission declined — type your address or PLZ instead."
        );
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap sm:flex-nowrap items-center gap-1.5"
      >
        <div className="relative flex-1 min-w-[175px]">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
            onChange={(e) => {
              const nextVal = e.target.value;
              setQuery(nextVal);
              if (nextVal.trim().length < 2) {
                setResults([]);
                setIsOpen(false);
                setStatusMsg(null);
              }
            }}
            placeholder={placeholder}
            aria-label="Enter your farm address, postal code, or village"
            className={`w-full ${
              compact ? "min-h-[38px]" : "min-h-[40px]"
            } text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition-all`}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setIsOpen(false);
                setStatusMsg(null);
              }}
              aria-label="Clear address input"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-zinc-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isSearching || query.trim().length < 2}
          className="min-h-[40px] px-3.5 text-xs sm:text-sm rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
        >
          {isSearching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <MapPin className="w-3.5 h-3.5" />
          )}
          <span>Locate</span>
        </button>

        <button
          type="button"
          onClick={handleUseGps}
          disabled={isLocatingGps}
          title="Use my current GPS location"
          className="min-h-[40px] px-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 inline-flex items-center justify-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
        >
          {isLocatingGps ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
          ) : (
            <LocateFixed className="w-3.5 h-3.5 text-emerald-700" />
          )}
          <span>GPS</span>
        </button>
      </form>

      {statusMsg && !isSearching && results.length === 0 && (
        <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          {statusMsg}
        </p>
      )}

      {isOpen && results.length > 0 && (
        <div
          role="listbox"
          aria-label="Matching farm addresses"
          className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden divide-y divide-zinc-100"
        >
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => handlePick(item)}
              className="w-full text-left px-4 py-3 hover:bg-emerald-50/60 transition-colors flex items-start justify-between gap-3 cursor-pointer"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-950 truncate">
                    {item.shortTitle}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    {item.fullAddress}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] text-zinc-400 shrink-0 tabular-nums mt-0.5">
                {item.lat.toFixed(3)}°N, {item.lon.toFixed(3)}°E
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
