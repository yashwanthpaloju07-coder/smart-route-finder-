"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import GraphCanvas from "@/components/GraphCanvas";
import type { Graph } from "@/lib/graph";
import type { StepEvent, AlgoStats } from "@/lib/algorithms";
import { computeState, emptyVizState } from "@/lib/player";
import { codeFor } from "@/lib/pseudocode";
import { fmtKm } from "@/lib/graph";
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Loader2,
  Terminal,
  Code2,
  Gauge,
  BrainCircuit,
  Zap,
  MapPin,
  Navigation,
  CircleDot,
} from "lucide-react";

type AlgoId = "dijkstra" | "astar" | "floyd";

interface TraceData {
  algo: AlgoId;
  steps: StepEvent[];
  stats: AlgoStats;
  graph: Graph;
}

const ALGO_META: Record<AlgoId, { label: string; color: string; desc: string }> = {
  dijkstra: { label: "Dijkstra", color: "text-cyan-300", desc: "Uniform-cost · settles nodes in increasing distance" },
  astar: { label: "A* Search", color: "text-violet-300", desc: "Goal-directed · haversine heuristic h(n)" },
  floyd: { label: "Floyd–Warshall", color: "text-emerald-300", desc: "All-pairs DP · V³ pivot relaxation" },
};

export default function VisualizerPage() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [algo, setAlgo] = useState<AlgoId>("dijkstra");
  const [source, setSource] = useState("gachibowli");
  const [target, setTarget] = useState("secunderabad");
  const [data, setData] = useState<TraceData | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(150);
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // load graph + deep link
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/graph");
      const d = await res.json();
      if (d.ok) {
        setGraph({ nodes: d.nodes, edges: d.edges });
        const sp = new URLSearchParams(window.location.search);
        const s = sp.get("src");
        const t = sp.get("dst");
        const a = sp.get("algo") as AlgoId | null;
        if (a && ["dijkstra", "astar", "floyd"].includes(a)) setAlgo(a);
        if (s && d.nodes.some((n: { id: string }) => n.id === s)) setSource(s);
        if (t && d.nodes.some((n: { id: string }) => n.id === t)) setTarget(t);
      }
    })();
  }, []);

  const execute = useCallback(
    async (opts?: { autoplay?: boolean; a?: AlgoId; s?: string; t?: string }) => {
      const aa = opts?.a ?? algo;
      const ss = opts?.s ?? source;
      const tt = opts?.t ?? target;
      if (!ss || !tt || ss === tt) return;
      setLoading(true);
      setPlaying(false);
      try {
        const res = await fetch("/api/visualize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ algorithm: aa, source: ss, target: tt }),
        });
        const d = await res.json();
        if (d.ok) {
          setData({ algo: aa, steps: d.steps, stats: d.stats, graph: d.graph });
          setIdx(0);
          setPlaying(opts?.autoplay ?? true);
        }
      } finally {
        setLoading(false);
      }
    },
    [algo, source, target],
  );

  // auto-execute when arriving via deep link
  const booted = useRef(false);
  useEffect(() => {
    if (graph && !booted.current) {
      booted.current = true;
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("auto") !== "0") void execute({ autoplay: true });
    }
  }, [graph, execute]);

  // playback clock
  useEffect(() => {
    if (!playing || !data) return;
    if (idx >= data.steps.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIdx((i) => Math.min(i + 1, data.steps.length)), speed);
    return () => clearTimeout(t);
  }, [playing, idx, data, speed]);

  const viz = useMemo(() => (data ? computeState(data.steps, idx) : emptyVizState()), [data, idx]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [viz.log.length]);

  const total = data?.steps.length ?? 0;
  const finished = data ? idx >= total : false;
  const code = codeFor(data?.algo ?? algo);
  const activeGraph: Graph | null = data?.graph ?? graph;

  const nameOf = (id: string | null | undefined) =>
    id ? activeGraph?.nodes.find((n) => n.id === id)?.name ?? id : "—";

  const togglePlay = () => {
    if (!data) {
      void execute({ autoplay: true });
      return;
    }
    if (idx >= total) {
      setIdx(0);
      setPlaying(true);
      return;
    }
    setPlaying(!playing);
  };

  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-[1500px] px-3 pb-10 pt-24 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Algorithm <span className="neon-text">Visualizer</span>
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-400">
              Step-through execution traces of real solver runs — nodes, relaxations, pseudocode.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(["dijkstra", "astar", "floyd"] as AlgoId[]).map((a) => (
              <button
                key={a}
                onClick={() => {
                  setAlgo(a);
                  setData(null);
                  setIdx(0);
                  setPlaying(false);
                }}
                className={`rounded-xl px-4 py-2 text-[12px] font-extrabold uppercase tracking-wider transition-all ${
                  (data?.algo ?? algo) === a
                    ? "border border-cyan-400/60 bg-cyan-400/15 text-cyan-100 shadow-[0_0_16px_-4px_rgba(34,211,238,0.5)]"
                    : "btn-ghost text-slate-300"
                }`}
              >
                {ALGO_META[a].label}
              </button>
            ))}
          </div>
        </div>

        {/* control bar */}
        <div className="glass mb-4 flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-400" />
            <select
              className="srf rounded-xl border border-cyan-400/20 bg-[#0a1120] px-3 py-2 text-[12.5px] font-semibold text-slate-100 outline-none"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setData(null);
                setIdx(0);
                setPlaying(false);
              }}
            >
              {graph?.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-rose-400" />
            <select
              className="srf rounded-xl border border-cyan-400/20 bg-[#0a1120] px-3 py-2 text-[12.5px] font-semibold text-slate-100 outline-none"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setData(null);
                setIdx(0);
                setPlaying(false);
              }}
            >
              {graph?.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mx-1 hidden h-8 w-px bg-cyan-400/15 sm:block" />

          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              disabled={loading}
              className="btn-neon flex items-center gap-2 rounded-xl px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wider text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {loading ? "Tracing…" : playing ? "Pause" : !data ? "Start" : idx >= total ? "Replay" : idx === 0 ? "Start" : "Resume"}
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setIdx((i) => Math.min(i + 1, total));
              }}
              disabled={!data || idx >= total}
              className="btn-ghost flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-bold text-cyan-100"
            >
              <StepForward className="h-4 w-4" /> Next Step
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setIdx(0);
              }}
              disabled={!data}
              className="btn-ghost rounded-xl px-4 py-2.5 text-[12px] font-bold text-cyan-100"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-w-[200px] flex-1 items-center gap-3">
            <input
              type="range"
              min={0}
              max={total}
              value={idx}
              disabled={!data}
              onChange={(e) => {
                setPlaying(false);
                setIdx(Number(e.target.value));
              }}
              className="srf-range w-full"
            />
            <span className="mono w-20 shrink-0 text-right text-[11px] font-bold text-cyan-300">
              {idx} / {total}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-300" />
            <input
              type="range"
              min={20}
              max={800}
              step={10}
              value={820 - speed}
              onChange={(e) => setSpeed(820 - Number(e.target.value))}
              className="srf-range w-28"
              title="Playback speed"
            />
            <span className="mono w-16 text-[10.5px] font-bold text-slate-400">{speed}ms/step</span>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* canvas + stats */}
          <div className="flex flex-col gap-4">
            <div className="glass relative overflow-hidden p-2">
              {activeGraph ? (
                <GraphCanvas
                  nodes={activeGraph.nodes}
                  edges={activeGraph.edges}
                  nodeState={viz.nodeState}
                  edgeState={viz.edgeState}
                  distLabel={viz.distLabel}
                  showDist={(data?.algo ?? algo) !== "floyd"}
                />
              ) : (
                <div className="flex h-[420px] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                </div>
              )}

              {/* legend */}
              <div className="absolute left-4 top-4 rounded-xl border border-cyan-400/15 bg-[#050a14]/85 px-3.5 py-2.5 backdrop-blur-md">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#0e7490] ring-1 ring-cyan-300" /> Frontier</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#b45309] ring-1 ring-amber-300" /> Current</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#1d4ed8] ring-1 ring-blue-300" /> Settled</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#059669] ring-1 ring-emerald-300" /> Final path</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#6d28d9] ring-1 ring-violet-300" /> FW pivot</span>
                  <span className="flex items-center gap-1.5"><span className="h-1 w-4 bg-amber-400" /> Relaxing edge</span>
                </div>
              </div>

              {/* status ribbon */}
              <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5">
                <span
                  className={`rounded-full px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-widest ${
                    finished
                      ? "border border-emerald-400/50 bg-emerald-400/15 text-emerald-300"
                      : playing
                        ? "border border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                        : "border border-slate-500/40 bg-slate-500/10 text-slate-300"
                  }`}
                >
                  {finished ? "Trace complete" : playing ? "Running" : data ? "Paused" : "Standby"}
                </span>
                {viz.currentNode && (
                  <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[10px] font-bold text-amber-200">
                    Visiting: {nameOf(viz.currentNode)}
                  </span>
                )}
              </div>
            </div>

            {/* stats row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  icon: BrainCircuit,
                  k: "Nodes explored",
                  v: String(viz.explored),
                  sub: data ? `final ${data.stats.explored}` : "—",
                },
                {
                  icon: Zap,
                  k: "Best distance",
                  v: viz.distLabel[target] !== undefined && isFinite(viz.distLabel[target]) ? `${fmtKm(viz.distLabel[target])} km` : "—",
                  sub: data ? `optimal ${fmtKm(data.stats.distance)} km` : "",
                },
                {
                  icon: CircleDot,
                  k: "Trace steps",
                  v: `${idx}`,
                  sub: data ? `${total} total` : "—",
                },
                {
                  icon: Clock3Icon,
                  k: "Pure exec time",
                  v: data ? `${data.stats.execMs.toFixed(3)} ms` : "—",
                  sub: data ? `${data.stats.edgesRelaxed} relaxations` : "",
                },
              ].map(({ icon: Icon, k, v, sub }) => (
                <div key={k} className="glass px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-widest text-slate-500">
                    <Icon className="h-3.5 w-3.5 text-cyan-400" /> {k}
                  </div>
                  <div className="mono mt-1.5 text-xl font-extrabold text-white">{v}</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-cyan-300/70">{sub}</div>
                </div>
              ))}
            </div>

            {/* execution log */}
            <div className="glass p-4">
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-300">
                <Terminal className="h-4 w-4" /> Execution Log
              </h3>
              <div ref={logRef} className="h-52 overflow-y-auto rounded-xl border border-cyan-400/10 bg-[#04070f] p-3.5">
                {viz.log.length === 0 && (
                  <p className="text-[12px] text-slate-600">Press Start — every primitive operation will be narrated here.</p>
                )}
                {viz.log.map((l, i) => (
                  <div key={`${l.idx}-${i}`} className="mono flex gap-3 py-[3px] text-[11.5px] leading-relaxed">
                    <span className="w-12 shrink-0 text-right text-cyan-600">#{l.idx + 1}</span>
                    <span className="text-slate-300">{l.note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* pseudocode + algo info */}
          <div className="flex flex-col gap-4">
            <div className="glass p-5">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-300">
                  <Code2 className="h-4 w-4" /> Pseudocode
                </h3>
                <span className="mono rounded-md border border-cyan-400/25 bg-cyan-400/5 px-2 py-1 text-[9.5px] font-bold text-cyan-400">
                  {ALGO_META[data?.algo ?? algo].label}
                </span>
              </div>
              <p className="mb-4 text-[11px] text-slate-500">{ALGO_META[data?.algo ?? algo].desc}</p>
              <div className="overflow-hidden rounded-xl border border-cyan-400/10 bg-[#04070f]">
                {code.map((line, i) => (
                  <div
                    key={i}
                    className={`code-line mono flex px-3 py-[5px] text-[11.5px] leading-relaxed ${
                      viz.line === i ? "active text-cyan-100" : "text-slate-500"
                    }`}
                  >
                    <span className="w-7 shrink-0 select-none text-right text-slate-700">{i + 1}</span>
                    <span className="whitespace-pre pl-3">{line}</span>
                  </div>
                ))}
              </div>
            </div>

            {data && finished && (
              <div className="glass anim-fade-up border-emerald-400/30 p-5">
                <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-emerald-300">
                  Result · {data.stats.name}
                </h3>
                <div className="mono text-3xl font-black text-white">
                  {fmtKm(data.stats.distance)} <span className="text-base text-emerald-300">km</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-300">
                  {data.stats.path.length > 0
                    ? data.stats.path.map(nameOf).join(" → ")
                    : "No path under current blocks."}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-[#080f1e] px-2 py-2">
                    <div className="mono text-sm font-extrabold text-cyan-200">{data.stats.explored}</div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">explored</div>
                  </div>
                  <div className="rounded-lg bg-[#080f1e] px-2 py-2">
                    <div className="mono text-sm font-extrabold text-cyan-200">{data.stats.comparisons.toLocaleString()}</div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">comparisons</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Clock3Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
