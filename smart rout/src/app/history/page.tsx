"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  History,
  Trash2,
  Loader2,
  Map as MapIcon,
  Play,
  ChevronRight,
  ArrowRight,
  Inbox,
  RefreshCw,
} from "lucide-react";

interface HistoryRow {
  id: number;
  createdAt: string;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  algorithm: string;
  distance: number;
  hops: number;
  explored: number;
  execMs: number;
  path: string[] | string;
}

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/history");
    const d = await res.json();
    if (d.ok) setRows(d.history);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clearAll = async () => {
    if (!window.confirm("Clear the entire route history?")) return;
    setBusy(true);
    await fetch("/api/history", { method: "DELETE" });
    await load();
    setBusy(false);
  };

  const parsePath = (p: HistoryRow["path"]): string[] => {
    if (Array.isArray(p)) return p;
    try {
      return JSON.parse(p);
    } catch {
      return [];
    }
  };

  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-5xl px-3 pb-10 pt-24 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              <History className="h-7 w-7 text-cyan-300" />
              Route <span className="neon-text">History</span>
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-400">
              Every route solve is persisted to the database with full solver telemetry.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void load()}
              className="btn-ghost flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-bold text-cyan-100"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              onClick={() => void clearAll()}
              disabled={busy || !rows?.length}
              className="btn-ghost flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-bold text-rose-200"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Clear All
            </button>
          </div>
        </div>

        {!rows ? (
          <div className="glass flex h-60 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 p-14 text-center">
            <Inbox className="h-12 w-12 text-slate-600" />
            <p className="text-sm font-bold text-slate-300">No routes solved yet</p>
            <p className="max-w-sm text-[12px] text-slate-500">
              Head to the dashboard, pick two Hyderabad locations and hit “Find Optimal Route” — the run
              will be recorded here automatically.
            </p>
            <Link
              href="/dashboard"
              className="btn-neon mt-2 flex items-center gap-2 rounded-xl px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wider text-white"
            >
              <MapIcon className="h-4 w-4" /> Open Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((r, i) => {
              const path = parsePath(r.path);
              return (
                <div key={r.id} className="glass anim-fade-up p-5" style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="mono rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2 py-1 text-[10px] font-black text-cyan-300">
                      #{r.id}
                    </span>
                    <span className="flex items-center gap-2 text-[15px] font-extrabold text-white">
                      {r.sourceName}
                      <ArrowRight className="h-4 w-4 text-cyan-400" />
                      {r.targetName}
                    </span>
                    <span className="rounded-full border border-white/10 bg-[#080f1e] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {r.algorithm}
                    </span>
                    <span className="ml-auto text-[11px] font-semibold text-slate-500">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { k: "Distance", v: `${r.distance.toFixed(1)} km` },
                      { k: "Hops", v: String(r.hops) },
                      { k: "Nodes explored", v: String(r.explored) },
                      { k: "Exec time", v: `${r.execMs.toFixed(3)} ms` },
                    ].map((s) => (
                      <div key={s.k} className="rounded-xl border border-cyan-400/10 bg-[#080f1e] px-3 py-2">
                        <div className="mono text-[13px] font-extrabold text-cyan-100">{s.v}</div>
                        <div className="text-[8.5px] font-bold uppercase tracking-widest text-slate-500">{s.k}</div>
                      </div>
                    ))}
                  </div>

                  {path.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-y-1.5">
                      {path.map((p, j) => (
                        <span key={j} className="flex items-center">
                          <span
                            className={`rounded-lg px-2 py-1 text-[10.5px] font-bold ${
                              j === 0
                                ? "bg-emerald-400/15 text-emerald-300"
                                : j === path.length - 1
                                  ? "bg-rose-400/15 text-rose-300"
                                  : "bg-cyan-400/10 text-cyan-200"
                            }`}
                          >
                            {p}
                          </span>
                          {j < path.length - 1 && <ChevronRight className="mx-0.5 h-3 w-3 text-slate-600" />}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/dashboard?src=${r.sourceId}&dst=${r.targetId}`}
                      className="btn-neon flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
                    >
                      <MapIcon className="h-3.5 w-3.5" /> View on Map
                    </Link>
                    <Link
                      href={`/visualizer?src=${r.sourceId}&dst=${r.targetId}&algo=dijkstra`}
                      className="btn-ghost flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-cyan-100"
                    >
                      <Play className="h-3.5 w-3.5" /> Replay Trace
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
