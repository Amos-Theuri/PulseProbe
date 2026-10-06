"use client";

import React, { useState } from "react";
import { SparklinePoint } from "@/types";

interface LatencySparklineProps {
  points: SparklinePoint[];
  width?: number;
  height?: number;
}

export function LatencySparkline({
  points,
  width = 240,
  height = 48,
}: LatencySparklineProps) {
  const [hoveredPoint, setHoveredPoint] = useState<SparklinePoint | null>(null);

  if (!points || points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-zinc-500 border border-dashed border-zinc-700/50 rounded"
        style={{ width, height }}
      >
        Awaiting ping data...
      </div>
    );
  }

  const padding = 4;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  const latencies = points.map((p) => p.responseTimeMs);
  const minLatency = Math.min(...latencies, 0);
  const maxLatency = Math.max(...latencies, 50); // Minimum scale 50ms

  // Generate SVG coordinates
  const coords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? graphWidth / 2 + padding
        : padding + (idx / (points.length - 1)) * graphWidth;
    const ratio = (p.responseTimeMs - minLatency) / (maxLatency - minLatency || 1);
    const y = padding + graphHeight - ratio * graphHeight;
    return { x, y, point: p };
  });

  const pathD = coords.reduce(
    (acc, curr, idx) =>
      idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`,
    ""
  );

  const fillD = `${pathD} L ${coords[coords.length - 1].x} ${
    height - padding
  } L ${coords[0].x} ${height - padding} Z`;

  const latest = points[points.length - 1];

  return (
    <div className="relative inline-block select-none" style={{ width, height }}>
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <defs>
          <linearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Fill Area */}
        <path d={fillD} fill="url(#latencyFill)" />

        {/* Latency Line */}
        <path
          d={pathD}
          fill="none"
          stroke={latest.isHealthy ? "#10b981" : "#ef4444"}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive Dots */}
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={hoveredPoint === c.point ? 4 : 2}
            className={`transition-all ${
              c.point.isHealthy ? "fill-emerald-400" : "fill-red-500"
            }`}
            onMouseEnter={() => setHoveredPoint(c.point)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded bg-zinc-900 border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-100 shadow-xl">
          <span className="font-semibold">{hoveredPoint.responseTimeMs} ms</span>
          {hoveredPoint.statusCode && (
            <span className="ml-1 text-zinc-400">({hoveredPoint.statusCode})</span>
          )}
          {!hoveredPoint.isHealthy && (
            <span className="ml-1 text-red-400 font-bold">DOWN</span>
          )}
        </div>
      )}
    </div>
  );
}
