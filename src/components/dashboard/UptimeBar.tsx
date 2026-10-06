"use client";

import React from "react";
import { UptimeMetrics } from "@/types";

interface UptimeBarProps {
  metrics: UptimeMetrics;
}

function getUptimeColor(pct: number): string {
  if (pct >= 99.0) return "text-emerald-400";
  if (pct >= 95.0) return "text-amber-400";
  return "text-red-400";
}

function getUptimeBg(pct: number): string {
  if (pct >= 99.0) return "bg-emerald-500";
  if (pct >= 95.0) return "bg-amber-500";
  return "bg-red-500";
}

export function UptimeBar({ metrics }: UptimeBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <div className="rounded bg-zinc-900/60 p-2 border border-zinc-800">
          <div className="text-zinc-400 text-[10px] uppercase font-mono tracking-wider">
            24 Hours
          </div>
          <div className={`text-sm font-semibold font-mono ${getUptimeColor(metrics.uptime24h)}`}>
            {metrics.uptime24h.toFixed(2)}%
          </div>
        </div>

        <div className="rounded bg-zinc-900/60 p-2 border border-zinc-800">
          <div className="text-zinc-400 text-[10px] uppercase font-mono tracking-wider">
            7 Days
          </div>
          <div className={`text-sm font-semibold font-mono ${getUptimeColor(metrics.uptime7d)}`}>
            {metrics.uptime7d.toFixed(2)}%
          </div>
        </div>

        <div className="rounded bg-zinc-900/60 p-2 border border-zinc-800">
          <div className="text-zinc-400 text-[10px] uppercase font-mono tracking-wider">
            30 Days
          </div>
          <div className={`text-sm font-semibold font-mono ${getUptimeColor(metrics.uptime30d)}`}>
            {metrics.uptime30d.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Visual Uptime Bar (last 24h) */}
      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${getUptimeBg(metrics.uptime24h)}`}
          style={{ width: `${Math.max(2, metrics.uptime24h)}%` }}
        />
      </div>
    </div>
  );
}
