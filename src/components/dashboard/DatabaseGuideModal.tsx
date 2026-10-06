"use client";

import React, { useState } from "react";
import { Database, X, Check, Copy, Terminal, Cloud, Server } from "lucide-react";

interface DatabaseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DatabaseGuideModal({ isOpen, onClose }: DatabaseGuideModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Resource & Database Setup Guide
              </h2>
              <p className="text-xs text-zinc-400">
                PulseProbe uses PostgreSQL via Prisma ORM. Choose the setup that fits your environment.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Tabs / Options */}
        <div className="mt-5 space-y-6 text-sm text-zinc-300">
          {/* Option 1: Neon Cloud PostgreSQL (Easiest & Free) */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-center gap-2 font-semibold text-zinc-100">
              <Cloud className="h-4 w-4 text-emerald-400" />
              <span>Option 1: Free Cloud Database (Neon / Supabase) — Recommended</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              No local installation required. Free, instant serverless PostgreSQL connection string in under 60 seconds:
            </p>
            <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-zinc-300 font-sans">
              <li>Visit <a href="https://neon.tech" target="_blank" rel="noreferrer" className="text-emerald-400 underline">neon.tech</a> or <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline">supabase.com</a> and create a free project.</li>
              <li>Copy the connection string (e.g. <code className="text-zinc-200">postgresql://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require</code>).</li>
              <li>Paste it into your <code className="text-zinc-200">.env</code> file under <code className="text-emerald-400">DATABASE_URL</code>.</li>
            </ol>
          </div>

          {/* Option 2: Docker Container */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-center gap-2 font-semibold text-zinc-100">
              <Terminal className="h-4 w-4 text-cyan-400" />
              <span>Option 2: Local Docker Container</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              If Docker is installed on your machine, spin up a local PostgreSQL container:
            </p>
            <div className="mt-2 relative rounded bg-zinc-900 border border-zinc-800 p-2 font-mono text-xs text-zinc-200">
              <pre className="overflow-x-auto">docker run --name pulseprobe-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pulseprobe -p 5432:5432 -d postgres:16</pre>
              <button
                onClick={() =>
                  copyToClipboard(
                    "docker run --name pulseprobe-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pulseprobe -p 5432:5432 -d postgres:16",
                    "docker"
                  )
                }
                className="absolute right-2 top-2 rounded bg-zinc-800 p-1 text-zinc-400 hover:text-zinc-100"
              >
                {copiedKey === "docker" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Option 3: Native Linux PostgreSQL */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-center gap-2 font-semibold text-zinc-100">
              <Server className="h-4 w-4 text-purple-400" />
              <span>Option 3: Native Linux PostgreSQL</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Install PostgreSQL directly via your system package manager:
            </p>
            <div className="mt-2 relative rounded bg-zinc-900 border border-zinc-800 p-2 font-mono text-xs text-zinc-200">
              <pre className="overflow-x-auto">sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE DATABASE pulseprobe;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"</pre>
              <button
                onClick={() =>
                  copyToClipboard(
                    "sudo apt update && sudo apt install -y postgresql postgresql-contrib\nsudo -u postgres psql -c \"CREATE DATABASE pulseprobe;\"\nsudo -u postgres psql -c \"ALTER USER postgres PASSWORD 'postgres';\"",
                    "linux-pg"
                  )
                }
                className="absolute right-2 top-2 rounded bg-zinc-800 p-1 text-zinc-400 hover:text-zinc-100"
              >
                {copiedKey === "linux-pg" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Step 4: Run Prisma Migration */}
          <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4">
            <div className="flex items-center gap-2 font-semibold text-emerald-300">
              <Check className="h-4 w-4" />
              <span>Final Step: Apply Prisma Migrations</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Once your PostgreSQL database is reachable via <code className="text-zinc-200">DATABASE_URL</code> in <code className="text-zinc-200">.env</code>, run:
            </p>
            <div className="mt-2 relative rounded bg-zinc-900 border border-zinc-800 p-2 font-mono text-xs text-emerald-400">
              <pre>npx prisma migrate dev --name init</pre>
              <button
                onClick={() => copyToClipboard("npx prisma migrate dev --name init", "migrate")}
                className="absolute right-2 top-2 rounded bg-zinc-800 p-1 text-zinc-400 hover:text-zinc-100"
              >
                {copiedKey === "migrate" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              PulseProbe includes an automated fallback dev store so you can explore the dashboard and probe live endpoints immediately even before connecting a database!
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
          >
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  );
}
