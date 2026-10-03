"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import type { Graph } from "@/lib/graph";
import { fmtKm } from "@/lib/graph";
import {
  BarChart3,
  Loader2,
  MapPin,
  Navigation,
  Play,
  Timer,
  Boxes,
  Cpu,
  GitCompareArrows,
  ShieldCheck,
  Waypoints,
  Trophy,
  Sigma,
} from "lucide-react";

interface AlgoResult {
  algorithm: "dijkstra" | "astar" | "floyd";
  name: string;
  path: string[];
  pathNames: string[];
  distance: number;
  hops: number;
  explored: number;
  comparisons: number;
  edgesRelaxed: number;
  execMs: number;
  complexity: string;
  space: string;
}
interface CompareData {
  sourceName: string;
  targetName: string;
  results: AlgoResult[];
  consensus: boolean;
  graph: { nodes: number; edges: number; blocked: number };
}

const CARD_STYLE: Record<string, { bar: string; text: string; ring: string }> = {
  dijkstra: { bar: "from-cyan-500 to-sky-500", text: "text-cyan-300", ring: "border-cyan-400/40" },
  astar: { bar: "from-violet-500 to-fuchsia-500", text: "text-violet-300", ring: "border-violet-400/40" },
  floyd: { bar: "from-emerald-500 to-teal-500", text: "text-emerald-300", ring: "border-emerald-400/40" },
};

function Bar({ pct, gradient, label, value }: { pct: number; gradient: string; label: string; value: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 60);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-[11px] font-bold">
        <span className="text-slate-300">{label}</span>
        <span className="mono text-cyan-200">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#0a1322]">
        <div
          className={`bar-anim h-full rounded-full bg-gradient-to-r ${gradient} shadow-[0_0_12px_rgba(34,211,238,0.35)]`}
          style={{ width: `${Math.max(2, w)}%` }}
        />
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [source, setSource] = useState("gachibowli");
  const [target, setTarget] = useState("secunderabad");
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const booted = useRef(false);

  const run = useCallback(async (s: string, t: string) => {
    if (!s || !t || s === t) return;
    setLoading(true);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: s, target: t }),
      });
      const d = await res.json();
      if (d.ok) setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/graph");
      const d = await res.json();
      if (d.ok) {
        setGraph({ nodes: d.nodes, edges: d.edges });
        const sp = new URLSearchParams(window.location.search);
        const s = sp.get("src");
        const t = sp.get("dst");
        const valid = (x: string | null) => x && d.nodes.some((n: { id: string }) => n.id === x);
        const ss = valid(s) ? s! : "gachibowli";
        const tt = valid(t) ? t! : "secunderabad";
        setSource(ss);
        setTarget(tt);
        if (!booted.current) {
          booted.current = true;
          void run(ss, tt);
        }
      }
    })();
  }, [run]);

  const maxima = useMemo(() => {
    if (!data) return { exec: 1, explored: 1, ops: 1 };
    return {
      exec: Math.max(...data.results.map((r) => r.execMs), 1e-6),
      explored: Math.max(...data.results.map((r) => r.explored), 1),
      ops: Math.max(...data.results.map((r) => r.comparisons), 1),
    };
  }, [data]);

  const insights = useMemo(() => {
    if (!data) return [];
    const d = data.results.find((r) => r.algorithm === "dijkstra")!;
    const a = data.results.find((r) => r.algorithm === "astar")!;
    const f = data.results.find((r) => r.algorithm === "floyd")!;
    const out: string[] = [];
    const saved = d.explored - a.explored;
    if (saved > 0) {
      out.push(
        `A* explored ${saved} fewer node(s) than Dijkstra (${Math.round((saved / d.explored) * 100)}% less search effort) — the haversine heuristic successfully steered expansion toward ${data.targetName}.`,
      );
    } else if (saved === 0) {
      out.push(
        `A* and Dijkstra explored the same frontier here — the direct corridor already aligns with the heuristic's straight-line pull.`,
      );
    } else {
      out.push(`On this pair Dijkstra's frontier was slightly smaller — heuristics help most when the optimal path heads roughly straight at the goal.`);
    }
    out.push(
      `Floyd–Warshall executed ${f.comparisons.toLocaleString()} triple comparisons (V³ = ${data.graph.nodes}³) to answer ALL ${data.graph.nodes * (data.graph.nodes - 1)} ordered pairs at once — overkill for one query, unbeatable for batch matrix jobs.`,
    );
    const fastest = [...data.results].sort((x, y) => x.execMs - y.execMs)[0];
    out.push(
      `Fastest wall-clock on this hardware: ${fastest.name} at ${fastest.execMs.toFixed(4)} ms (median of repeated runs — actual measured execution, not simulation).`,
    );
    return out;
  }, [data]);

  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-[1500px] px-3 pb-10 pt-24 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Comparison <span className="neon-text">Lab</span>
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-400">
              All three algorithms benchmarked on identical inputs — measured, not simulated.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-400" />
            <select
              className="srf rounded-xl border border-cyan-400/20 bg-[#0a1120] px-3 py-2 text-[12.5px] font-semibold text-slate-100 outline-none"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              {graph?.nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <Navigation className="h-4 w-4 text-rose-400" />
            <select
              className="srf rounded-xl border border-cyan-400/20 bg-[#0a1120] px-3 py-2 text-[12.5px] font-semibold text-slate-100 outline-none"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {graph?.nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <button
              onClick={() => void run(source, target)}
              disabled={loading || !source || !target || source === target}
              className="btn-neon flex items-center gap-2 rounded-xl px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wider text-white"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {loading ? "Benchmarking…" : "Run Benchmark"}
            </button>
          </div>
        </div>

        {!data ? (
          <div className="glass flex h-72 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        ) : (
          <>
            {/* consensus banner */}
            <div
              className={`glass anim-fade-up mb-4 flex flex-wrap items-center gap-3 border-l-4 p-4 ${
                data.consensus ? "border-l-emerald-400" : "border-l-amber-400"
              }`}
            >
              {data.consensus ? (
                <>
                  <ShieldCheck className="h-6 w-6 text-emerald-400" />
                  <p className="text-[13.5px] font-semibold text-slate-200">
                    <span className="text-emerald-300 font-bold">Consensus reached:</span> all three algorithms independently converge on{" "}
                    <span className="mono font-bold text-white">{fmtKm(data.results[0].distance)} km</span> for{" "}
                    {data.sourceName} → {data.targetName} — three different paradigms, one provable optimum.
                  </p>
                </>
              ) : (
                <>
                  <GitCompareArrows className="h-6 w-6 text-amber-400" />
                  <p className="text-[13.5px] font-semibold text-slate-200">
                    No route exists (or results diverge) for this pair under current road blocks.
                  </p>
                </>
              )}
            </div>

            {/* algorithm cards */}
            <div className="mb-4 grid gap-4 lg:grid-cols-3">
              {data.results.map((r) => {
                const sty = CARD_STYLE[r.algorithm];
                return (
                  <div key={r.algorithm} className={`glass glass-hover border ${sty.ring} p-5`}>
                    <div className="flex items-center justify-between">
                      <h3 className={`text-lg font-extrabold ${sty.text}`}>{r.name}</h3>
                      <span className="mono rounded-lg border border-white/10 bg-[#080f1e] px-2.5 py-1 text-[10px] font-bold text-slate-300">
                        {r.complexity}
                      </span>
                    </div>
                    <div className="mono mt-3 text-3xl font-black text-white">
                      {r.execMs.toFixed(3)}
                      <span className="ml-1 text-sm font-bold text-slate-400">ms</span>
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">measured execution time</div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-[#080f1e] px-1 py-2">
                        <div className="mono text-[15px] font-extrabold text-cyan-200">{fmtKm(r.distance)}</div>
                        <div className="text-[8.5px] font-bold uppercase tracking-widest text-slate-500">distance km</div>
                      </div>
                      <div className="rounded-lg bg-[#080f1e] px-1 py-2">
                        <div className="mono text-[15px] font-extrabold text-cyan-200">{r.explored}</div>
                        <div className="text-[8.5px] font-bold uppercase tracking-widest text-slate-500">explored</div>
                      </div>
                      <div className="rounded-lg bg-[#080f1e] px-1 py-2">
                        <div className="mono text-[15px] font-extrabold text-cyan-200">{r.hops}</div>
                        <div className="text-[8.5px] font-bold uppercase tracking-widest text-slate-500">hops</div>
                      </div>
                    </div>
                    <p className="mono mt-3 truncate text-[11px] text-slate-400" title={r.pathNames.join(" → ")}>
                      {r.pathNames.length ? r.pathNames.join(" → ") : "unreachable"}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* charts */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="glass p-5">
                <h3 className="mb-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-300">
                  <Timer className="h-4 w-4" /> Execution time (ms · lower is better)
                </h3>
                {data.results.map((r) => (
                  <Bar
                    key={r.algorithm}
                    label={r.name}
                    value={`${r.execMs.toFixed(3)} ms`}
                    pct={(r.execMs / maxima.exec) * 100}
                    gradient={CARD_STYLE[r.algorithm].bar}
                  />
                ))}
              </div>
              <div className="glass p-5">
                <h3 className="mb-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-violet-300">
                  <Boxes className="h-4 w-4" /> Nodes explored (search effort)
                </h3>
                {data.results.map((r) => (
                  <Bar
                    key={r.algorithm}
                    label={r.name}
                    value={String(r.explored)}
                    pct={(r.explored / maxima.explored) * 100}
                    gradient={CARD_STYLE[r.algorithm].bar}
                  />
                ))}
              </div>
              <div className="glass p-5">
                <h3 className="mb-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-emerald-300">
                  <Sigma className="h-4 w-4" /> Key comparisons
                </h3>
                {data.results.map((r) => (
                  <Bar
                    key={r.algorithm}
                    label={r.name}
                    value={r.comparisons.toLocaleString()}
                    pct={(r.comparisons / maxima.ops) * 100}
                    gradient={CARD_STYLE[r.algorithm].bar}
                  />
                ))}
              </div>
            </div>

            {/* insights + complexity table */}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="glass p-5">
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-300">
                  <Cpu className="h-4 w-4" /> Analyst notes
                </h3>
                <ul className="flex flex-col gap-3">
                  {insights.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mono mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/10 text-[10px] font-black text-cyan-300">
                        {i + 1}
                      </span>
                      <p className="text-[12.5px] leading-relaxed text-slate-300">{s}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="glass overflow-hidden p-0">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-cyan-400/10 bg-[#0a1322] text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                      <th className="px-5 py-3.5">Algorithm</th>
                      <th className="px-3 py-3.5">Time complexity</th>
                      <th className="px-3 py-3.5">Space</th>
                      <th className="px-3 py-3.5">Best for</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { n: "Dijkstra", t: "O((V+E) log V)", s: "O(V)", b: "Single-pair optimum, no heuristic available", c: "text-cyan-300" },
                      { n: "A* Search", t: "O(E) · h-guided", s: "O(V)", b: "Single-pair with good admissible heuristic", c: "text-violet-300" },
                      { n: "Floyd–Warshall", t: "O(V³)", s: "O(V²)", b: "All-pairs matrices, dense batch queries", c: "text-emerald-300" },
                    ].map((row) => (
                      <tr key={row.n} className="border-b border-white/5 last:border-0 hover:bg-cyan-400/5">
                        <td className={`px-5 py-3.5 font-extrabold ${row.c}`}>{row.n}</td>
                        <td className="mono px-3 py-3.5 text-slate-300">{row.t}</td>
                        <td className="mono px-3 py-3.5 text-slate-300">{row.s}</td>
                        <td className="px-3 py-3.5 text-slate-400">{row.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center gap-2 border-t border-cyan-400/10 px-5 py-3 text-[11px] text-slate-500">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  All timings are medians of repeated live runs against the production graph (
                  {data.graph.nodes} nodes / {data.graph.edges} roads
                  {data.graph.blocked > 0 ? `, ${data.graph.blocked} blocked` : ""}).
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-center">
              <a
                href={`/race?src=${source}&dst=${target}`}
                className="btn-neon flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[13px] font-extrabold uppercase tracking-wider text-white"
              >
                <Waypoints className="h-4 w-4" />
                Take this pair to Race Mode
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
