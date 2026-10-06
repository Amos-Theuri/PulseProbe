"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SystemStatusSummary } from "@/types";
import { MonitorCard } from "@/components/dashboard/MonitorCard";
import { IncidentFeed } from "@/components/dashboard/IncidentFeed";
import { AddMonitorModal } from "@/components/dashboard/AddMonitorModal";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState<SystemStatusSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSseConnected, setIsSseConnected] = useState(false);
  const [filter, setFilter] = useState<"all" | "healthy" | "failing" | "paused">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const triggerProbeBatch = async () => {
    setIsRefreshing(true);
    try {
      await fetch("/api/worker/tick", { method: "POST" });
      await fetchStatus();
    } catch (err) {
      console.error("Batch probe failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Server-Sent Events (SSE) listener
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/events");

      eventSource.onopen = () => {
        setIsSseConnected(true);
      };

      eventSource.addEventListener("connected", () => {
        setIsSseConnected(true);
      });

      eventSource.addEventListener("ping", () => {
        fetchStatus();
      });

      eventSource.addEventListener("incident", () => {
        fetchStatus();
      });

      eventSource.onerror = () => {
        setIsSseConnected(false);
      };
    } catch {
      setIsSseConnected(false);
    }

    // Auto-tick worker every 30 seconds to simulate continuous probing
    const tickInterval = setInterval(() => {
      fetch("/api/worker/tick", { method: "POST" }).then(() => fetchStatus());
    }, 30000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(tickInterval);
    };
  }, [fetchStatus]);

  const filteredMonitors = data?.monitors.filter((m) => {
    if (filter === "healthy") return m.active && m.isHealthy;
    if (filter === "failing") return m.active && !m.isHealthy;
    if (filter === "paused") return !m.active;
    return true;
  }) ?? [];

  const isOperational = data?.overallStatus === "OPERATIONAL";
  const isMajorOutage = data?.overallStatus === "MAJOR_OUTAGE";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-zinc-950 shadow-lg shadow-emerald-500/20">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-zinc-100 sm:text-lg">
                  PulseProbe
                </h1>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 border border-zinc-700">
                  v1.0-beacon
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Distributed API Uptime & Latency Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Realtime SSE indicator */}
            <div
              className={`hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono transition ${
                isSseConnected
                  ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-400"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400"
              }`}
            >
              <Radio className={`h-3 w-3 ${isSseConnected ? "animate-pulse text-emerald-400" : ""}`} />
              <span>{isSseConnected ? "Live SSE Active" : "Connecting..."}</span>
            </div>


            {/* Trigger Checks */}
            <button
              onClick={triggerProbeBatch}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
              <span className="hidden sm:inline">Probe Cycle</span>
            </button>

            {/* Add Target */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              <span>Add Target</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* System Status Banner */}
        <section
          className={`relative overflow-hidden rounded-2xl border p-6 shadow-xl transition ${
            isOperational
              ? "border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900"
              : isMajorOutage
              ? "border-red-500/30 bg-gradient-to-r from-red-950/40 via-zinc-900 to-zinc-900"
              : "border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-900"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
                  isOperational
                    ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                    : isMajorOutage
                    ? "border-red-500/40 bg-red-500/20 text-red-400"
                    : "border-amber-500/40 bg-amber-500/20 text-amber-400"
                }`}
              >
                {isOperational ? (
                  <CheckCircle2 className="h-7 w-7" />
                ) : (
                  <AlertTriangle className="h-7 w-7" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
                  {isOperational
                    ? "All Endpoints Operational"
                    : isMajorOutage
                    ? "Major System Outage Detected"
                    : "Partial Service Outage"}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Continuous high-precision probes executing with SSRF security verification.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2">
                <span className="text-zinc-500 block text-[10px] uppercase">Avg Latency</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {data?.averageLatencyMs ?? 0} ms
                </span>
              </div>
              <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2">
                <span className="text-zinc-500 block text-[10px] uppercase">Active Targets</span>
                <span className="font-bold text-zinc-100 text-sm">
                  {data?.totalMonitors ?? 0}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* High Level Key Metrics */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="text-xs text-zinc-400">Total Probes</div>
            <div className="mt-1 text-2xl font-bold font-mono text-zinc-100">
              {data?.totalMonitors ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="text-xs text-zinc-400">Healthy Targets</div>
            <div className="mt-1 text-2xl font-bold font-mono text-emerald-400">
              {data?.healthyMonitors ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="text-xs text-zinc-400">Failing Targets</div>
            <div className="mt-1 text-2xl font-bold font-mono text-red-400">
              {data?.failingMonitors ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="text-xs text-zinc-400">Open Incidents</div>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-400">
              {data?.openIncidents ?? 0}
            </div>
          </div>
        </section>

        {/* Monitored Endpoints List */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Monitored Services & Sparklines
              </h2>
              <p className="text-xs text-zinc-400">
                True response duration captured with monotonic clocks
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5 text-xs font-medium">
              <button
                onClick={() => setFilter("all")}
                className={`rounded px-2.5 py-1 transition ${
                  filter === "all" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                All ({data?.monitors.length ?? 0})
              </button>
              <button
                onClick={() => setFilter("healthy")}
                className={`rounded px-2.5 py-1 transition ${
                  filter === "healthy" ? "bg-zinc-800 text-emerald-400" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Healthy ({data?.healthyMonitors ?? 0})
              </button>
              <button
                onClick={() => setFilter("failing")}
                className={`rounded px-2.5 py-1 transition ${
                  filter === "failing" ? "bg-zinc-800 text-red-400" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Failing ({data?.failingMonitors ?? 0})
              </button>
              <button
                onClick={() => setFilter("paused")}
                className={`rounded px-2.5 py-1 transition ${
                  filter === "paused" ? "bg-zinc-800 text-zinc-300" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Paused ({data?.monitors.filter((m) => !m.active).length ?? 0})
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-sm text-zinc-400">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-emerald-400 mb-2" />
              Loading probe telemetry...
            </div>
          ) : filteredMonitors.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-sm text-zinc-400">
              No monitors match the current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredMonitors.map((mon) => (
                <MonitorCard key={mon.id} monitor={mon} onRefresh={fetchStatus} />
              ))}
            </div>
          )}
        </section>

        {/* Public Incident Feed */}
        <section className="space-y-4 pt-4 border-t border-zinc-800/80">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Incident History & Audit Trail
            </h2>
            <p className="text-xs text-zinc-400">
              Verifiable incident events triggered after consecutive check failures
            </p>
          </div>

          <IncidentFeed incidents={data?.recentIncidents ?? []} />
        </section>
      </main>

      {/* Modals */}
      <AddMonitorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchStatus}
      />

    </div>
  );
}
