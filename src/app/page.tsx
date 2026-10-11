"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SystemStatusSummary } from "@/types";
import { MonitorCard } from "@/components/dashboard/MonitorCard";
import { IncidentFeed } from "@/components/dashboard/IncidentFeed";
import { AddMonitorModal } from "@/components/dashboard/AddMonitorModal";
import {
  CheckCircle2,
  AlertTriangle,
  Plus,
  Radio,
  RefreshCw,
  Zap,
  Key,
  Lock,
  Unlock,
  X,
} from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState<SystemStatusSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSseConnected, setIsSseConnected] = useState(false);
  const [filter, setFilter] = useState<"all" | "healthy" | "failing" | "paused">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("pulseprobe-api-key") || "";
      } catch {
        return "";
      }
    }
    return "";
  });
  const [inputKey, setInputKey] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("pulseprobe-api-key") || "";
      } catch {
        return "";
      }
    }
    return "";
  });

  const handleSaveApiKey = (keyToSave: string) => {
    const trimmed = keyToSave.trim();
    setApiKey(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem("pulseprobe-api-key", trimmed);
        document.cookie = `pulseprobe-api-key=${encodeURIComponent(trimmed)}; path=/; max-age=2592000; SameSite=Lax`;
      } else {
        localStorage.removeItem("pulseprobe-api-key");
        document.cookie = "pulseprobe-api-key=; path=/; max-age=0; SameSite=Lax";
      }
    } catch {
      // Ignore
    }
    setIsAuthModalOpen(false);
  };

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
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["x-api-key"] = apiKey;
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      const res = await fetch("/api/worker/tick", { method: "POST", headers });
      if (res.status === 401) {
        setIsAuthModalOpen(true);
      }
      await fetchStatus();
    } catch (err) {
      console.error("Batch probe failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    let active = true;
    fetch("/api/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json) {
          setData(json);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch status:", err);
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Server-Sent Events (SSE) listener & live polling fallback
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
      // EventSource instantiation error
    }

    // Auto-poll status periodically (every 20s) to keep views in sync without overwhelming probe ticks
    const pollInterval = setInterval(() => {
      fetchStatus();
    }, 20000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(pollInterval);
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


            {/* Admin Key Button */}
            {data?.requiresAuth && (
              <button
                onClick={() => {
                  setInputKey(apiKey);
                  setIsAuthModalOpen(true);
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  apiKey
                    ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-400 hover:border-emerald-400"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
                title={apiKey ? "Admin Mode Active (click to manage API key)" : "Admin Unlock required to manage monitors"}
              >
                {apiKey ? <Unlock className="h-3.5 w-3.5 text-emerald-400" /> : <Lock className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{apiKey ? "Admin Mode" : "Admin Unlock"}</span>
              </button>
            )}

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
              onClick={() => {
                if (data?.requiresAuth && !apiKey) {
                  setIsAuthModalOpen(true);
                } else {
                  setIsAddModalOpen(true);
                }
              }}
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
                <MonitorCard
                  key={mon.id}
                  monitor={mon}
                  onRefresh={fetchStatus}
                  apiKey={apiKey}
                  onRequestAuth={() => {
                    setInputKey(apiKey);
                    setIsAuthModalOpen(true);
                  }}
                />
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

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-6 text-center text-xs text-zinc-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} PulseProbe Beacon. Open source & MIT Licensed.</p>
          <div className="flex items-center gap-4 text-zinc-400">
            <span>SSRF Protected</span>
            <span>•</span>
            <span>Monotonic TTFB Latency</span>
            <span>•</span>
            <span>Zero Tracking Cookies</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AddMonitorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchStatus}
        apiKey={apiKey}
        onRequestAuth={() => {
          setInputKey(apiKey);
          setIsAuthModalOpen(true);
        }}
      />

      {/* Admin API Key Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Key className="h-4 w-4" />
                </div>
                <h2 className="text-base font-semibold text-zinc-100">Admin Authentication</h2>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-zinc-400">
                This PulseProbe deployment is protected by an Admin API key. Enter your secret key to create, pause, or delete monitors.
              </p>

              <div>
                <label className="block text-xs font-medium text-zinc-300">
                  PulseProbe API Key (Bearer Token)
                </label>
                <input
                  type="password"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Paste your PULSEPROBE_API_KEY..."
                  className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {apiKey ? (
                  <button
                    type="button"
                    onClick={() => handleSaveApiKey("")}
                    className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/30"
                  >
                    Clear Saved Key
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(false)}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveApiKey(inputKey)}
                    className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400"
                  >
                    Save & Unlock
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
