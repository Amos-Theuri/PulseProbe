"use client";

import React, { useState } from "react";
import { MonitorWithStats } from "@/types";
import { LatencySparkline } from "./LatencySparkline";
import { UptimeBar } from "./UptimeBar";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  Clock,
  RefreshCw,
} from "lucide-react";

interface MonitorCardProps {
  monitor: MonitorWithStats;
  onRefresh: () => void;
}

export function MonitorCard({ monitor, onRefresh }: MonitorCardProps) {
  const [isPinging, setIsPinging] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handlePingNow = async () => {
    setIsPinging(true);
    try {
      await fetch(`/api/monitors/${monitor.id}/check`, { method: "POST" });
      onRefresh();
    } catch (err) {
      console.error("Manual ping error:", err);
    } finally {
      setIsPinging(false);
    }
  };

  const handleToggleActive = async () => {
    setIsToggling(true);
    try {
      await fetch(`/api/monitors/${monitor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !monitor.active }),
      });
      onRefresh();
    } catch (err) {
      console.error("Toggle error:", err);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete monitor "${monitor.name}"?`)) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/monitors/${monitor.id}`, { method: "DELETE" });
      onRefresh();
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const isOperational = monitor.active && monitor.isHealthy;
  const isDown = monitor.active && !monitor.isHealthy;
  const isPaused = !monitor.active;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-sm transition hover:border-zinc-700">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          {/* Status Indicator Dot */}
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
              isOperational
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : isDown
                ? "border-red-500/20 bg-red-500/10 text-red-400"
                : "border-zinc-700 bg-zinc-800 text-zinc-400"
            }`}
          >
            {isOperational && <CheckCircle2 className="h-4 w-4" />}
            {isDown && <AlertTriangle className="h-4 w-4" />}
            {isPaused && <Pause className="h-4 w-4" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-zinc-100">{monitor.name}</h3>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                  isOperational
                    ? "bg-emerald-950/70 text-emerald-400 border border-emerald-800/40"
                    : isDown
                    ? "bg-red-950/70 text-red-400 border border-red-800/40"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                }`}
              >
                {isOperational ? "Operational" : isDown ? "Failing" : "Paused"}
              </span>
            </div>
            <a
              href={monitor.url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              <span className="truncate max-w-[280px] sm:max-w-md font-mono">
                {monitor.url}
              </span>
              <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </a>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePingNow}
            disabled={isPinging || !monitor.active}
            title="Probe endpoint immediately"
            className="flex items-center gap-1 rounded bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPinging ? "animate-spin text-emerald-400" : ""}`} />
            <span>Ping Now</span>
          </button>

          <button
            onClick={handleToggleActive}
            disabled={isToggling}
            title={monitor.active ? "Pause monitoring" : "Resume monitoring"}
            className="rounded bg-zinc-800 p-1.5 text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
          >
            {monitor.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete monitor"
            className="rounded bg-zinc-800/80 p-1.5 text-red-400 transition hover:bg-red-950/50 hover:text-red-300 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {/* Latency & Sparkline */}
        <div className="flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span>Current Latency</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono text-zinc-100">
                {monitor.currentLatencyMs !== null ? `${monitor.currentLatencyMs} ms` : "---"}
              </span>
            </div>
          </div>

          <div className="py-1">
            <LatencySparkline points={monitor.sparkline} width={280} height={42} />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Interval: {monitor.intervalSeconds}s
            </span>
            <span>Expected: HTTP {monitor.expectedStatus}</span>
          </div>
        </div>

        {/* Uptime metrics */}
        <div className="flex flex-col justify-between gap-2">
          <div className="text-xs text-zinc-400">Historical Availability</div>
          <UptimeBar metrics={monitor.uptime} />
          {monitor.activeIncident && (
            <div className="rounded bg-red-950/40 border border-red-800/40 p-2 text-xs text-red-300">
              <span className="font-semibold">Active Incident:</span> {monitor.activeIncident.reason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
