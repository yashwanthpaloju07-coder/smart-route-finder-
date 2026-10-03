"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import GraphCanvas from "@/components/GraphCanvas";
import type { Graph } from "@/lib/graph";
import { fmtKm } from "@/lib/graph";
import type { StepEvent, AlgoStats } from "@/lib/algorithms";
import { computeState, emptyVizState } from "@/lib/player";
import {
  Swords,
  Loader2,
  MapPin,
  Navigation,
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Flag,
  Timer,
  Boxes,
  Gauge,
} from "lucide-react";

interface RaceSide {
  stats: AlgoStats;
  steps: StepEvent[];
}
interface RaceData {
  graph: Graph;
  dijkstra: RaceSide;
  astar: RaceSide;
  winner: "dijkstra" | "astar" | "tie";
}

export default function RacePage() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [source, setSource] = useState("kukatpally");
  const [target, setTarget] = useState("dilsukhnagar");
  const [race, setRace] = useState<RaceData | null>(null);
  const [idxD, setIdxD] = useState(0);
  const [idxA, setIdxA] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(90);
  const [loading, setLoading] = useState(false);
  const booted = useRef(false);

  const startRace = useCallback(async (s: string, t: string) => {
    if (!s || !t || s === t) return;
    setLoading(true);
    setPlaying(false);
    setIdxD(0);
    setIdxA(0);
    try {
      const res = await fetch("/api/race", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: s, target: t }),
      });
      const d = await res.json();
      if (d.ok) {
        setRace({ graph: d.graph, dijkstra: d.dijkstra, astar: d.astar, winner: d.winner });
        setPlaying(true);
      }
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
        const ss = valid(s) ? s! : "kukatpally";
        const tt = valid(t) ? t! : "dilsukhnagar";
        setSource(ss);
        setTarget(tt);
        if (!booted.current) {
          booted.current = true;
          void startRace(ss, tt);
        }
      }
    })();
  }, [startRace]);

  const lenD = race?.dijkstra.steps.length ?? 0;
  const lenA = race?.astar.steps.length ?? 0;
  const doneD = idxD >= lenD && lenD > 0;
  const doneA = idxA >= lenA && lenA > 0;
  const bothDone = doneD && doneA;

  useEffect(() => {
    if (!playing || !race) return;
    if (doneD && doneA) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => {
      if (!doneD) setIdxD((i) => Math.min(i + 1, lenD));
      if (!doneA) setIdxA((i) => Math.min(i + 1, lenA));
    }, speed);
    return () => clearTimeout(t);
  }, [playing, race, idxD, idxA, doneD, doneA, lenD, lenA, speed]);

  const vizD = useMemo(() => (race ? computeState(race.dijkstra.steps, idxD) : emptyVizState()), [race, idxD]);
  const vizA = useMemo(() => (race ? computeState(race.astar.steps, idxA) : emptyVizState()), [race, idxA]);

  const winnerName = race?.winner === "astar" ? "A* Search" : race?.winner === "dijkstra" ? "Dijkstra" : "Tie";
  const g = race?.graph ?? graph;

  const sidePanel = (
    side: "dijkstra" | "astar",
    title: string,
    accent: string,
    viz: ReturnType<typeof computeState>,
    idx: number,
    len: number,
    done: boolean,
    rd: RaceSide | undefined,
  ) => (
    <div
      className={`glass relative overflow-hidden p-3 ${
        bothDone && race?.winner === side ? "scanline border-emerald-400/50 shadow-[0_0_40px_-10px_rgba(52,211,153,0.5)]" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <h3 className={`text-sm font-extrabold uppercase tracking-widest ${accent}`}>{title}</h3>
          <p className="text-[10px] font-semibold text-slate-500">
            {side === "dijkstra" ? "uniform-cost · f = g" : "goal-directed · f = g + h(n)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bothDone && race?.winner === side && <Trophy className="h-4 w-4 text-amber-400" />}
          {done && !bothDone && <Flag className="h-4 w-4 text-emerald-400" />}
          <span
            className={`rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-widest ${
              done
                ? "border border-emerald-400/50 bg-emerald-400/15 text-emerald-300"
                : "border border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
            }`}
          >
            {done ? "Finished" : race ? "Racing" : "—"}
          </span>
        </div>
      </div>

      {g ? (
        <GraphCanvas
          nodes={g.nodes}
          edges={g.edges}
          nodeState={viz.nodeState}
          edgeState={viz.edgeState}
          distLabel={{}}
          showDist={false}
          compact
        />
      ) : (
        <div className="flex h-72 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
        </div>
      )}

      <div className="mt-2 px-1">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span className="mono">step {idx}/{len}</span>
          <span className="mono text-cyan-300">explored {viz.explored}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#0a1322]">
          <div
            className={`h-full rounded-full transition-[width] duration-150 ${side === "astar" ? "bg-gradient-to-r from-violet-500 to-fuchsia-400" : "bg-gradient-to-r from-cyan-500 to-sky-400"}`}
            style={{ width: `${len ? (idx / len) * 100 : 0}%` }}
          />
        </div>
      </div>

      {done && rd && (
        <div className="anim-fade-up mx-1 mt-2 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-lg bg-[#080f1e] px-1 py-1.5">
            <div className="mono text-[13px] font-extrabold text-cyan-200">{rd.stats.explored}</div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">explored</div>
          </div>
          <div className="rounded-lg bg-[#080f1e] px-1 py-1.5">
            <div className="mono text-[13px] font-extrabold text-cyan-200">{rd.stats.execMs.toFixed(3)}ms</div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">exec time</div>
          </div>
          <div className="rounded-lg bg-[#080f1e] px-1 py-1.5">
            <div className="mono text-[13px] font-extrabold text-cyan-200">{fmtKm(rd.stats.distance)} km</div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">optimal</div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-[1500px] px-3 pb-10 pt-24 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              <Swords className="h-7 w-7 text-cyan-300" />
              Algorithm <span className="neon-text">Race Mode</span>
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-400">
              Dijkstra vs A* — identical graph, synchronized clocks, real traces.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-400" />
            <select
              className="srf rounded-xl border border-cyan-400/20 bg-[#0a1120] px-3 py-2 text-[12.5px] font-semibold text-slate-100 outline-none"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setRace(null);
                setPlaying(false);
              }}
            >
              {graph?.nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <Navigation className="h-4 w-4 text-rose-400" />
            <select
              className="srf rounded-xl border border-cyan-400/20 bg-[#0a1120] px-3 py-2 text-[12.5px] font-semibold text-slate-100 outline-none"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setRace(null);
                setPlaying(false);
              }}
            >
              {graph?.nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <button
              onClick={() => void startRace(source, target)}
              disabled={loading || !source || !target || source === target}
              className="btn-neon flex items-center gap-2 rounded-xl px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wider text-white"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
              {loading ? "Staging…" : "Start Race"}
            </button>
            {race && !bothDone && (
              <button
                onClick={() => setPlaying(!playing)}
                className="btn-ghost rounded-xl px-4 py-2.5 text-cyan-100"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
            )}
            {race && (
              <button
                onClick={() => {
                  setPlaying(false);
                  setIdxD(0);
                  setIdxA(0);
                }}
                className="btn-ghost rounded-xl px-4 py-2.5 text-cyan-100"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <span className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-cyan-300" />
              <input
                type="range"
                min={25}
                max={400}
                value={425 - speed}
                onChange={(e) => setSpeed(425 - Number(e.target.value))}
                className="srf-range w-24"
              />
            </span>
          </div>
        </div>

        {/* winner banner */}
        {bothDone && race && (
          <div className="glass anim-fade-up mb-4 flex flex-wrap items-center gap-3 border-l-4 border-l-amber-400 p-4">
            <Trophy className="h-7 w-7 text-amber-400" />
            <div>
              <p className="text-[15px] font-extrabold text-white">
                {winnerName} {race.winner === "tie" ? "— dead heat!" : "wins the race"}
              </p>
              <p className="text-[12px] text-slate-400">
                Explored: Dijkstra {race.dijkstra.stats.explored} vs A* {race.astar.stats.explored} nodes · Exec:{" "}
                {race.dijkstra.stats.execMs.toFixed(3)} ms vs {race.astar.stats.execMs.toFixed(3)} ms · Both found the
                identical optimum of {fmtKm(race.dijkstra.stats.distance)} km — A* just searched smarter using straight-line distance to goal.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> median-of-9 timing</span>
              <span className="flex items-center gap-1"><Boxes className="h-3.5 w-3.5" /> {race.graph.nodes.length} nodes</span>
            </div>
          </div>
        )}

        <div className="relative grid gap-4 lg:grid-cols-2">
          {sidePanel("dijkstra", "Dijkstra", "text-cyan-300", vizD, idxD, lenD, doneD, race?.dijkstra)}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/40 bg-[#050a14] text-sm font-black text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.4)]">
              VS
            </span>
          </div>
          {sidePanel("astar", "A* Search", "text-violet-300", vizA, idxA, lenA, doneA, race?.astar)}
        </div>

        {!race && !loading && (
          <p className="mt-6 text-center text-[13px] text-slate-500">
            Choose a pair and hit <span className="font-bold text-cyan-300">Start Race</span> — try long east–west pairs
            (e.g. Kukatpally → Dilsukhnagar) to see the heuristic shine.
          </p>
        )}
      </div>
    </main>
  );
}
