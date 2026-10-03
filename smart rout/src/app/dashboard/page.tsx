"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import MapView, { RouteLine } from "@/components/MapView";
import MapSearch from "@/components/MapSearch";
import type { Graph } from "@/lib/graph";
import type { MetroStation, MetroLine } from "@/lib/metro";
import { fmtKm } from "@/lib/graph";
import {
  Navigation,
  ArrowLeftRight,
  Ban,
  Loader2,
  Radar,
  ChevronRight,
  ShieldCheck,
  Zap,
  Grid3X3,
  Route as RouteIcon,
  TrendingDown,
  FileJson,
  FileSpreadsheet,
  MapPin,
  RotateCcw,
  Play,
  BarChart3,
  Swords,
  CircleCheck,
  MousePointerClick,
  History,
  MapPinPlus,
  X,
} from "lucide-react";

interface PrimaryStats {
  algorithm: string;
  name: string;
  path: string[];
  distance: number;
  hops: number;
  explored: number;
  edgesRelaxed: number;
  execMs: number;
}
interface Alternative {
  path: string[];
  distance: number;
  hops: number;
}
interface RouteResult {
  source: string;
  target: string;
  primary: PrimaryStats;
  alternatives: Alternative[];
  explanation: string[];
  stats: { nodes: number; edges: number; blocked: number; unblockedDistance: number | null };
}

const ALT_COLORS = ["#a78bfa", "#fbbf24"];
const EXPLAIN_ICONS = [TrendingDown, ShieldCheck, Zap, Grid3X3, RouteIcon, Ban];

export default function DashboardPage() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [pickMode, setPickMode] = useState<"source" | "target" | "block" | null>(null);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [running, setRunning] = useState(false);
  const [activeAlt, setActiveAlt] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number; t: number } | null>(null);
  const [tempMarker, setTempMarker] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [pendingPin, setPendingPin] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [metroStations, setMetroStations] = useState<MetroStation[]>([]);
  const [metroLines, setMetroLines] = useState<MetroLine[]>([]);
  const [showMetro, setShowMetro] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const nameOf = useCallback(
    (id: string) => graph?.nodes.find((n) => n.id === id)?.name ?? id,
    [graph],
  );

  const findRoute = useCallback(
    async (s: string, t: string) => {
      if (!s || !t) {
        say("Select a source and a destination first.");
        return;
      }
      if (s === t) {
        say("Source and destination must be different.");
        return;
      }
      setRunning(true);
      try {
        const res = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: s, target: t }),
        });
        const data = await res.json();
        if (data.ok) {
          setResult(data);
          setActiveAlt(0);
          setDirty(false);
          if (data.primary.path.length === 0) {
            say("No route exists — the network is disconnected under current road blocks.");
          }
        } else {
          say(data.error ?? "Solver error");
        }
      } catch {
        say("Network error while solving.");
      } finally {
        setRunning(false);
      }
    },
    [say],
  );

  // initial load (+ deep-link prefill)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/graph");
        const data = await res.json();
        if (data.ok) {
          const g = { nodes: data.nodes, edges: data.edges };
          setGraph(g);
          const sp = new URLSearchParams(window.location.search);
          const s = sp.get("src");
          const t = sp.get("dst");
          if (
            s &&
            t &&
            g.nodes.some((n: { id: string }) => n.id === s) &&
            g.nodes.some((n: { id: string }) => n.id === t)
          ) {
            setSource(s);
            setTarget(t);
            void findRoute(s, t);
          }
        }
      } catch {
        say("Failed to load graph data.");
      }
      // metro network overlay (independent reference data)
      try {
        const mres = await fetch("/api/metro");
        const m = await mres.json();
        if (m.ok) {
          setMetroStations(m.stations);
          setMetroLines(m.lines);
        }
      } catch {
        /* metro overlay is optional */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blockedCount = useMemo(() => graph?.edges.filter((e) => e.blocked).length ?? 0, [graph]);

  const routes: RouteLine[] = useMemo(() => {
    if (!result || result.primary.path.length < 2) return [];
    const out: RouteLine[] = [];
    result.alternatives.slice(1).forEach((alt, i) => {
      if (alt.path.length < 2) return;
      const idx = i + 1;
      out.push({
        path: alt.path,
        color: ALT_COLORS[i % ALT_COLORS.length],
        dash: "3 9",
        weight: activeAlt === idx ? 4.5 : 3,
        opacity: activeAlt === idx ? 0.95 : 0.5,
      });
    });
    out.push({
      path: result.primary.path,
      color: activeAlt === 0 ? "#22d3ee" : "#1a87a0",
      weight: activeAlt === 0 ? 5 : 3.5,
      glow: true,
      opacity: activeAlt === 0 ? 1 : 0.7,
    });
    return out;
  }, [result, activeAlt]);

  const handleNodeClick = (id: string) => {
    if (!graph) return;
    const mode = pickMode ?? (source && !target ? "target" : "source");
    if (mode === "block") return; // road blocking is done via edge clicks
    if (mode === "source") {
      if (id === target) {
        say("Source can't equal the destination.");
        return;
      }
      setSource(id);
      setDirty(true);
      if (result) setResult(null);
      setPickMode("target");
      say(`Source locked: ${nameOf(id)} — now pick a destination.`);
    } else {
      if (id === source) {
        say("Destination can't equal the source.");
        return;
      }
      setTarget(id);
      setDirty(true);
      setPickMode(null);
      say(`Destination locked: ${nameOf(id)}.`);
      if (source) void findRoute(source, id);
    }
  };

  const toggleBlock = async (edgeId: number) => {
    const edge = graph?.edges.find((e) => e.id === edgeId);
    if (!edge) return;
    try {
      const res = await fetch("/api/graph/edge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: edgeId, blocked: !edge.blocked }),
      });
      const data = await res.json();
      if (data.ok) {
        setGraph((g) =>
          g ? { ...g, edges: g.edges.map((e) => (e.id === edgeId ? { ...e, blocked: !e.blocked } : e)) } : g,
        );
        say(
          !edge.blocked
            ? `Road blocked: ${nameOf(edge.a)} ↔ ${nameOf(edge.b)}. Recalculating…`
            : `Road restored: ${nameOf(edge.a)} ↔ ${nameOf(edge.b)}.`,
        );
        if (result && source && target) void findRoute(source, target);
      }
    } catch {
      say("Could not update road status.");
    }
  };

  const handleEdgeClick = (id: number) => {
    if (pickMode === "block") {
      void toggleBlock(id);
    } else {
      say("Enable “Block Roads” mode, then click any road to simulate a closure.");
    }
  };

  const clearBlocks = async () => {
    if (!graph) return;
    const blocked = graph.edges.filter((e) => e.blocked);
    await Promise.all(
      blocked.map((e) =>
        fetch("/api/graph/edge", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: e.id, blocked: false }),
        }),
      ),
    );
    setGraph((g) => (g ? { ...g, edges: g.edges.map((e) => ({ ...e, blocked: false })) } : g));
    say("All road closures cleared.");
    if (result && source && target) void findRoute(source, target);
  };

  const swap = () => {
    if (!source || !target) return;
    const s = source;
    setSource(target);
    setTarget(s);
    if (result) void findRoute(target, s);
  };

  const resetAll = () => {
    setSource("");
    setTarget("");
    setResult(null);
    setPickMode(null);
    setDirty(false);
    say("Mission reset — pick a new source on the map.");
  };

  const refreshGraph = useCallback(async () => {
    const res = await fetch("/api/graph");
    const d = await res.json();
    if (d.ok) setGraph({ nodes: d.nodes, edges: d.edges });
  }, []);

  const addNodeFromSearch = async () => {
    if (!pendingPin) return;
    try {
      const res = await fetch("/api/graph/node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pendingPin.name, lat: pendingPin.lat, lng: pendingPin.lng }),
      });
      const d = await res.json();
      if (d.ok) {
        say(`“${pendingPin.name}” added as a network node — connect roads to it in the Graph Editor.`);
        setPendingPin(null);
        setTempMarker(null);
        await refreshGraph();
      } else {
        say(d.error ?? "Could not add node.");
      }
    } catch {
      say("Could not add node.");
    }
  };

  const exportJSON = () => {
    if (!result) return;
    const payload = {
      tool: "SMART ROUTE FINDER — Intelligent Path Optimization System",
      exportedAt: new Date().toISOString(),
      source: nameOf(result.source),
      destination: nameOf(result.target),
      optimalRoute: {
        algorithm: result.primary.name,
        distanceKm: Number(result.primary.distance.toFixed(2)),
        hops: result.primary.hops,
        path: result.primary.path.map(nameOf),
        nodesExplored: result.primary.explored,
        edgesRelaxed: result.primary.edgesRelaxed,
        executionMs: Number(result.primary.execMs.toFixed(4)),
      },
      alternatives: result.alternatives.slice(1).map((a) => ({
        distanceKm: Number(a.distance.toFixed(2)),
        hops: a.hops,
        path: a.path.map(nameOf),
      })),
      optimalityExplanation: result.explanation,
      networkStats: result.stats,
    };
    download(
      JSON.stringify(payload, null, 2),
      `smart-route-${result.source}-to-${result.target}.json`,
      "application/json",
    );
    say("Route intel exported as JSON.");
  };

  const exportCSV = () => {
    if (!result) return;
    const rows = [
      ["type", "algorithm", "distance_km", "hops", "nodes_explored", "exec_ms", "path"],
      [
        "optimal",
        result.primary.name,
        result.primary.distance.toFixed(2),
        String(result.primary.hops),
        String(result.primary.explored),
        result.primary.execMs.toFixed(4),
        result.primary.path.map(nameOf).join(" > "),
      ],
      ...result.alternatives.slice(1).map((a, i) => [
        `alternative_${i + 1}`,
        "yen-k-shortest",
        a.distance.toFixed(2),
        String(a.hops),
        "",
        "",
        a.path.map(nameOf).join(" > "),
      ]),
    ];
    download(
      rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"),
      `smart-route-${result.source}-to-${result.target}.csv`,
      "text/csv",
    );
    say("Route intel exported as CSV.");
  };

  function download(content: string, filename: string, mime: string) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-[1500px] px-3 pb-10 pt-24 sm:px-6">
        {/* header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Route <span className="neon-text">Dashboard</span>
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-400">
              OpenStreetMap · Hyderabad road graph · live Dijkstra solver with Yen alternatives
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="chip rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-300">
              {graph ? `${graph.nodes.length} nodes · ${graph.edges.length} roads` : "loading…"}
            </span>
            {blockedCount > 0 && (
              <span className="chip rounded-full border-rose-400/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-rose-300">
                {blockedCount} blocked
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_430px]">
          {/* ── MAP ── */}
          <div className="glass relative h-[480px] overflow-hidden p-0 sm:h-[560px] lg:h-[calc(100vh-140px)]">
            {graph ? (
              <MapView
                className="h-full w-full rounded-[18px]"
                nodes={graph.nodes}
                edges={graph.edges}
                routes={routes}
                sourceId={source || null}
                targetId={target || null}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                flyTo={flyTo}
                tempMarker={tempMarker}
                showEdgeLabels={showLabels}
                onEdgeLabelsChange={setShowLabels}
                metroStations={metroStations}
                metroLines={metroLines}
                showMetro={showMetro}
                onShowMetroChange={setShowMetro}
                liftScale
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              </div>
            )}

            {/* global place search */}
            <div className="absolute left-1/2 top-3 z-[500] w-[min(420px,52%)] -translate-x-1/2">
              <MapSearch
                placeholder="Search any place on the map…"
                onPick={(r) => {
                  setFlyTo({ lat: r.lat, lng: r.lng, zoom: 14, t: Date.now() });
                  setTempMarker({ lat: r.lat, lng: r.lng, label: r.name });
                  setPendingPin({ name: r.name, lat: r.lat, lng: r.lng });
                }}
              />
              {pendingPin && (
                <div className="anim-fade-up mt-2 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-[#050a14]/95 px-3 py-2 backdrop-blur-md">
                  <span className="truncate text-[11px] font-bold text-amber-200">
                    Pinned: {pendingPin.name}
                  </span>
                  <button
                    onClick={() => void addNodeFromSearch()}
                    className="btn-neon ml-auto flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10.5px] font-extrabold text-white"
                  >
                    <MapPinPlus className="h-3.5 w-3.5" /> Add as Node
                  </button>
                  <button
                    onClick={() => {
                      setPendingPin(null);
                      setTempMarker(null);
                    }}
                    className="shrink-0 rounded-lg bg-white/10 p-1.5 text-slate-300 hover:bg-white/20"
                    title="Dismiss pin"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* pick-mode banner */}
            {pickMode && (
              <div className="anim-fade-up absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-[#050a14]/90 px-4 py-2.5 backdrop-blur-md">
                <MousePointerClick className="h-4 w-4 text-cyan-300" />
                <span className="text-[12px] font-bold text-cyan-100">
                  {pickMode === "source" && "Click a location on the map to set SOURCE"}
                  {pickMode === "target" && "Click a location on the map to set DESTINATION"}
                  {pickMode === "block" && "Click any road segment to block / restore it"}
                </span>
                <button
                  onClick={() => setPickMode(null)}
                  className="ml-1 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:bg-white/20"
                >
                  ESC
                </button>
              </div>
            )}

            {/* legend */}
            <div className="absolute bottom-3 left-3 z-[500] rounded-xl border border-cyan-400/15 bg-[#050a14]/85 px-3.5 py-2.5 backdrop-blur-md">
              <div className="flex flex-col gap-1.5 text-[10.5px] font-semibold text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" /> Optimal route
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-violet-400" /> Alternative (Yen k-shortest)
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full border-t-2 border-dashed border-rose-400" /> Blocked road
                </span>
              </div>
            </div>
          </div>

          {/* ── SIDE PANEL ── */}
          <aside className="flex flex-col gap-4 lg:h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-1">
            {/* mission control */}
            <section className="glass p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-300">
                  Mission Control
                </h2>
                <span className="mono rounded-md border border-cyan-400/20 bg-cyan-400/5 px-2 py-1 text-[9.5px] font-bold text-cyan-400">
                  DIJKSTRA + YEN K=3
                </span>
              </div>

              <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" /> Source
              </label>
              <div className="mb-3 flex gap-2">
                <select
                  className="srf w-full rounded-xl border border-cyan-400/20 bg-[#0a1120] px-3 py-2.5 text-[13px] font-semibold text-slate-100 outline-none focus:border-cyan-400/60"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="">Select source…</option>
                  {graph?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setPickMode(pickMode === "source" ? null : "source")}
                  className={`shrink-0 rounded-xl px-3 ${pickMode === "source" ? "btn-neon text-white" : "btn-ghost text-emerald-300"}`}
                  title="Pick source on map"
                >
                  <MapPin className="h-4 w-4" />
                </button>
              </div>

              <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-rose-300">
                <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_6px_#fb7185]" /> Destination
              </label>
              <div className="mb-4 flex gap-2">
                <select
                  className="srf w-full rounded-xl border border-cyan-400/20 bg-[#0a1120] px-3 py-2.5 text-[13px] font-semibold text-slate-100 outline-none focus:border-cyan-400/60"
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="">Select destination…</option>
                  {graph?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setPickMode(pickMode === "target" ? null : "target")}
                  className={`shrink-0 rounded-xl px-3 ${pickMode === "target" ? "btn-neon text-white" : "btn-ghost text-rose-300"}`}
                  title="Pick destination on map"
                >
                  <Navigation className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => void findRoute(source, target)}
                  disabled={running || !source || !target}
                  className="btn-neon flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-extrabold uppercase tracking-wider text-white"
                >
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RouteIcon className="h-4 w-4" />}
                  {running ? "Solving…" : "Find Optimal Route"}
                </button>
                <button onClick={swap} disabled={!source || !target} className="btn-ghost rounded-xl px-3.5 text-cyan-200" title="Swap">
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
                <button onClick={resetAll} className="btn-ghost rounded-xl px-3.5 text-cyan-200" title="Reset">
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
              {dirty && result && (
                <p className="mt-2 text-center text-[11px] font-semibold text-amber-300">
                  Parameters changed — press “Find Optimal Route” to re-solve.
                </p>
              )}
            </section>

            {/* result */}
            {!result ? (
              <section className="glass flex flex-col items-center gap-3 p-8 text-center">
                <Radar className="anim-glow h-10 w-10 text-cyan-400/60" />
                <p className="text-sm font-semibold text-slate-300">Awaiting mission parameters</p>
                <p className="text-[12px] leading-relaxed text-slate-500">
                  Pick two locations — by dropdown or directly on the map — and the solver will compute a
                  provably optimal route with alternatives and an evidence-backed explanation.
                </p>
              </section>
            ) : (
              <>
                {/* primary stats */}
                <section className="glass anim-fade-up p-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">
                        Optimal Route
                      </div>
                      <div className="mono mt-1 text-4xl font-black text-white">
                        {fmtKm(result.primary.distance)}
                        <span className="ml-1 text-base font-bold text-cyan-300">km</span>
                      </div>
                    </div>
                    <CircleCheck className="h-8 w-8 text-emerald-400" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { k: "Hops", v: String(result.primary.hops) },
                      { k: "Exec time", v: `${result.primary.execMs.toFixed(3)} ms` },
                      { k: "Explored", v: `${result.primary.explored}/${result.stats.nodes}` },
                    ].map((s) => (
                      <div key={s.k} className="rounded-xl border border-cyan-400/15 bg-[#080f1e] px-3 py-2.5 text-center">
                        <div className="mono text-sm font-extrabold text-cyan-100">{s.v}</div>
                        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">{s.k}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-y-1.5">
                    {result.primary.path.map((id, i) => (
                      <span key={`${id}-${i}`} className="flex items-center">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                            i === 0
                              ? "bg-emerald-400/15 text-emerald-300"
                              : i === result.primary.path.length - 1
                                ? "bg-rose-400/15 text-rose-300"
                                : "bg-cyan-400/10 text-cyan-200"
                          }`}
                        >
                          {nameOf(id)}
                        </span>
                        {i < result.primary.path.length - 1 && (
                          <ChevronRight className="mx-0.5 h-3.5 w-3.5 text-slate-600" />
                        )}
                      </span>
                    ))}
                  </div>
                </section>

                {/* alternatives */}
                {result.alternatives.length > 1 && (
                  <section className="glass anim-fade-up p-5" style={{ animationDelay: "0.06s" }}>
                    <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.25em] text-violet-300">
                      Alternative Routes · Yen K-Shortest
                    </h3>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setActiveAlt(0)}
                        className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                          activeAlt === 0
                            ? "border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_16px_-4px_rgba(34,211,238,0.5)]"
                            : "border-white/10 bg-[#080f1e] hover:border-cyan-400/30"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                          <span className="text-[12px] font-bold text-white">Optimal · {fmtKm(result.primary.distance)} km</span>
                        </span>
                        <span className="mono text-[10px] font-bold text-emerald-300">BEST</span>
                      </button>
                      {result.alternatives.slice(1).map((alt, i) => {
                        const idx = i + 1;
                        const delta = alt.distance - result.primary.distance;
                        return (
                          <button
                            key={idx}
                            onClick={() => setActiveAlt(idx)}
                            className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                              activeAlt === idx
                                ? "border-violet-400/60 bg-violet-400/10"
                                : "border-white/10 bg-[#080f1e] hover:border-violet-400/30"
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ background: ALT_COLORS[i % ALT_COLORS.length] }}
                              />
                              <span className="text-[12px] font-semibold text-slate-200">
                                Alt {idx} · {fmtKm(alt.distance)} km · {alt.hops} hops
                              </span>
                            </span>
                            <span className="mono text-[10px] font-bold text-amber-300">
                              +{fmtKm(Math.max(0, delta))} km
                            </span>
                          </button>
                      );
                      })}
                      <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
                        Click an alternative to preview it on the map. Dashed corridors are loopless
                        next-best simple paths.
                      </p>
                    </div>
                  </section>
                )}

                {/* why optimal */}
                <section className="glass anim-fade-up p-5" style={{ animationDelay: "0.12s" }}>
                  <h3 className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-emerald-300">
                    <ShieldCheck className="h-4 w-4" /> Why this route is optimal
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {result.explanation.map((line, i) => {
                      const Icon = EXPLAIN_ICONS[i % EXPLAIN_ICONS.length];
                      return (
                        <li key={i} className="flex gap-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10">
                            <Icon className="h-3.5 w-3.5 text-emerald-300" />
                          </span>
                          <p className="text-[12px] leading-relaxed text-slate-300">{line}</p>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </>
            )}

            {/* what-if */}
            <section className="glass p-5">
              <h3 className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-rose-300">
                <Ban className="h-4 w-4" /> What-If Analysis
              </h3>
              <p className="mb-3 text-[12px] leading-relaxed text-slate-400">
                Simulate road closures and watch the optimizer reroute. Currently{" "}
                <span className="font-bold text-rose-300">{blockedCount}</span> segment(s) blocked.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPickMode(pickMode === "block" ? null : "block")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold ${
                    pickMode === "block"
                      ? "border border-rose-400/60 bg-rose-500/20 text-rose-200 shadow-[0_0_16px_-4px_rgba(244,63,94,0.6)]"
                      : "btn-ghost text-rose-200"
                  }`}
                >
                  <Ban className="h-4 w-4" />
                  {pickMode === "block" ? "Blocking…" : "Block Roads"}
                </button>
                <button
                  onClick={() => void clearBlocks()}
                  disabled={blockedCount === 0}
                  className="btn-ghost flex-1 rounded-xl px-3 py-2.5 text-[12px] font-bold text-cyan-200"
                >
                  Clear All Blocks
                </button>
              </div>
            </section>

            {/* export + deep links */}
            {result && (
              <section className="glass anim-fade-up p-5">
                <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-300">
                  Export & Deep-Dive
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={exportJSON} className="btn-neon flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold text-white">
                    <FileJson className="h-4 w-4" /> JSON
                  </button>
                  <button onClick={exportCSV} className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold text-cyan-100">
                    <FileSpreadsheet className="h-4 w-4" /> CSV
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Link
                    href={`/visualizer?src=${result.source}&dst=${result.target}&algo=dijkstra`}
                    className="btn-ghost flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-bold text-cyan-100"
                  >
                    <Play className="h-3.5 w-3.5" /> Replay
                  </Link>
                  <Link
                    href={`/compare?src=${result.source}&dst=${result.target}`}
                    className="btn-ghost flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-bold text-cyan-100"
                  >
                    <BarChart3 className="h-3.5 w-3.5" /> Compare
                  </Link>
                  <Link
                    href={`/race?src=${result.source}&dst=${result.target}`}
                    className="btn-ghost flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-bold text-cyan-100"
                  >
                    <Swords className="h-3.5 w-3.5" /> Race
                  </Link>
                </div>
              </section>
            )}

            <Link
              href="/history"
              className="glass glass-hover flex items-center justify-between p-4 text-[12px] font-bold text-cyan-100"
            >
              <span className="flex items-center gap-2">
                <History className="h-4 w-4 text-cyan-300" /> View persisted route history
              </span>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </Link>
          </aside>
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div className="anim-fade-up fixed bottom-5 left-1/2 z-[1000] -translate-x-1/2 rounded-xl border border-cyan-400/40 bg-[#050a14]/95 px-5 py-3 text-[12.5px] font-semibold text-cyan-100 shadow-[0_0_30px_-6px_rgba(34,211,238,0.5)] backdrop-blur-md">
          {toast}
        </div>
      )}
    </main>
  );
}
