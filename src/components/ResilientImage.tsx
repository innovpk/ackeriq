"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useRef, useState } from "react";
import { Sprout } from "lucide-react";

const STATIC_ASSET_VERSION = "2";
const MAX_RETRIES = 4;
const RETRY_DELAYS_MS = [650, 1500, 3000, 5500];

function buildVersionedSrc(rawSrc: string, retryAttempt: number): string {
  const isLocalStatic = rawSrc.startsWith("/images/");
  if (!isLocalStatic && retryAttempt === 0) {
    return rawSrc;
  }

  const separator = rawSrc.includes("?") ? "&" : "?";
  const parts: string[] = [];
  if (isLocalStatic) {
    parts.push(`v=${STATIC_ASSET_VERSION}`);
  }
  if (retryAttempt > 0) {
    parts.push(`retry=${retryAttempt}`);
  }
  return `${rawSrc}${separator}${parts.join("&")}`;
}

export interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
  sizes?: string;
}

function ResilientImageInner({
  src,
  alt,
  className = "object-cover",
  eager = false,
  sizes,
}: ResilientImageProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryAttempt, setRetryAttempt] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const effectiveSrc = buildVersionedSrc(src, retryAttempt);

  const handleLoad = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
    if (retryAttempt < MAX_RETRIES) {
      const delay =
        RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setHasError(false);
        setRetryAttempt((prev) => prev + 1);
      }, delay);
    }
  };

  return (
    <>
      {alt ? <span className="sr-only">{alt}</span> : null}

      {/* Clean agronomic surface underneath while loading or auto-retrying */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-zinc-900 to-emerald-900 flex items-center justify-center pointer-events-none"
      >
        {hasError && (
          <Sprout className="w-6 h-6 text-emerald-400/55 animate-pulse" />
        )}
      </div>

      {!hasError && (
        <img
          src={effectiveSrc}
          alt=""
          aria-hidden="true"
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          decoding={eager ? "sync" : "async"}
          fetchPriority={eager ? "high" : "auto"}
          onLoad={handleLoad}
          onError={handleError}
          className={`absolute inset-0 w-full h-full ${className}`}
        />
      )}
    </>
  );
}

export function ResilientImage(props: ResilientImageProps) {
  return <ResilientImageInner key={props.src} {...props} />;
}
