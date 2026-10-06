"use client";

import React from "react";
import { IncidentDisplay } from "@/types";
import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";

interface IncidentFeedProps {
  incidents: IncidentDisplay[];
}

export function IncidentFeed({ incidents }: IncidentFeedProps) {
  if (!incidents || incidents.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400/80 mb-2" />
        <p className="font-medium text-zinc-200">No Incidents Reported</p>
        <p className="text-xs text-zinc-500 mt-1">
          All endpoints have operated within normal performance thresholds.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {incidents.map((incident) => {
        const isOpen = incident.status === "OPEN";
        return (
          <div
            key={incident.id}
            className={`rounded-lg border p-4 transition ${
              isOpen
                ? "border-red-800/60 bg-red-950/20"
                : "border-zinc-800 bg-zinc-900/40"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ShieldAlert className="h-4 w-4 text-red-400" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
                <span className="font-semibold text-zinc-100 text-sm">
                  {incident.monitorName || "Endpoint Incident"}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase font-mono ${
                    isOpen
                      ? "bg-red-900/60 text-red-300 border border-red-700/50"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {incident.status}
                </span>
              </div>

              <div className="text-[11px] font-mono text-zinc-400">
                Started: {new Date(incident.startedAt).toLocaleString()}
                {incident.resolvedAt && (
                  <span className="text-zinc-500 ml-2">
                    • Resolved: {new Date(incident.resolvedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            <p className="mt-2 text-xs text-zinc-300 font-mono bg-black/30 p-2 rounded border border-zinc-800/50">
              {incident.reason}
            </p>
          </div>
        );
      })}
    </div>
  );
}
