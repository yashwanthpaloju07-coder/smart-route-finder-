"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import MapView from "@/components/MapView";
import MapSearch from "@/components/MapSearch";
import type { Graph } from "@/lib/graph";
import {
  MousePointer2,
  MapPinPlus,
  Cable,
  Trash2,
  RotateCcw,
  Loader2,
  Ban,
  CircleCheck,
  Plus,
  X,
  Link2,
  Undo2,
} from "lucide-react";

type Mode = "pan" | "add" | "connect" | "delete";

const MODE_HINTS: Record<Mode, string> = {
  pan: "Explore mode — click a road to block/restore it, or pick a tool above to edit the network.",
  add: "Click anywhere on the map to drop a new custom location, give it a name, then save.",
  connect: "Click a start location, then a second location — a new road is created with auto-computed distance.",
  delete: "Click any location badge or road segment to delete it from the network.",
};

export default function EditorPage() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [mode, setMode] = useState<Mode>("pan");
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [newName, setNewName] = useState("");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [customDist, setCustomDist] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number; t: number } | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/graph");
    const d = await res.json();
    if (d.ok) setGraph({ nodes: d.nodes, edges: d.edges });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const nameOf = useCallback(
    (id: string) => graph?.nodes.find((n) => n.id === id)?.name ?? id,
    [graph],
  );

  const displayNodes = useMemo(() => {
    const base = graph?.nodes ?? [];
    if (pending) {
      return [...base, { id: "__pending", name: newName || "New location", lat: pending.lat, lng: pending.lng, custom: true }];
    }
    return base;
  }, [graph, pending, newName]);

  const onMapClick = (lat: number, lng: number) => {
    if (mode !== "add") return;
    setPending({ lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) });
  };

  const addLocation = async () => {
    if (!pending || !newName.trim()) {
      say("Drop a point on the map and give it a name first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/graph/node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), lat: pending.lat, lng: pending.lng }),
      });
      const d = await res.json();
      if (d.ok) {
        say(`Location “${newName.trim()}” added to the network.`);
        setPending(null);
        setNewName("");
        await refresh();
      } else say(d.error ?? "Failed to add location.");
    } finally {
      setBusy(false);
    }
  };

  const onNodeClick = (id: string) => {
    if (id === "__pending") return;
    if (mode === "connect") {
      if (!connectFrom) {
        setConnectFrom(id);
        say(`Start: ${nameOf(id)} — now click the location to connect it to.`);
      } else if (connectFrom !== id) {
        void (async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/graph/edge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                a: connectFrom,
                b: id,
                distance: customDist ? Number(customDist) : undefined,
              }),
            });
            const d = await res.json();
            if (d.ok) {
              say(`Road created: ${nameOf(connectFrom)} ↔ ${nameOf(id)} (${d.edge.distance.toFixed(1)} km).`);
              await refresh();
            } else say(d.error ?? "Could not create road.");
          } finally {
            setBusy(false);
            setConnectFrom(null);
          }
        })();
      }
      return;
    }
    if (mode === "delete") {
      if (window.confirm(`Delete “${nameOf(id)}” and all roads touching it?`)) {
        void (async () => {
          await fetch(`/api/graph/node?id=${encodeURIComponent(id)}`, { method: "DELETE" });
          say(`Deleted ${nameOf(id)}.`);
          await refresh();
        })();
      }
      return;
    }
    say(`“${nameOf(id)}” — switch to Connect or Delete mode to modify it.`);
  };

  const onEdgeClick = (id: number) => {
    const edge = graph?.edges.find((e) => e.id === id);
    if (!edge) return;
    if (mode === "delete") {
      if (window.confirm(`Delete road ${nameOf(edge.a)} ↔ ${nameOf(edge.b)}?`)) {
        void (async () => {
          await fetch(`/api/graph/edge?id=${id}`, { method: "DELETE" });
          say("Road deleted.");
          await refresh();
        })();
      }
      return;
    }
    // pan mode click = quick block toggle
    void (async () => {
      await fetch("/api/graph/edge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, blocked: !edge.blocked }),
      });
      say(!edge.blocked ? `Blocked ${nameOf(edge.a)} ↔ ${nameOf(edge.b)}.` : `Restored ${nameOf(edge.a)} ↔ ${nameOf(edge.b)}.`);
      await refresh();
    })();
  };

  const resetNetwork = async () => {
    if (!window.confirm("Restore the factory Hyderabad network? Custom nodes and edits will be lost.")) return;
    setBusy(true);
    const res = await fetch("/api/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    const d = await res.json();
    if (d.ok) {
      setGraph({ nodes: d.nodes, edges: d.edges });
      setPending(null);
      setConnectFrom(null);
      say("Factory network restored.");
    }
    setBusy(false);
  };

  const blockedCount = graph?.edges.filter((e) => e.blocked).length ?? 0;
  const customCount = graph?.nodes.filter((n) => n.custom).length ?? 0;

  const TOOLS: { id: Mode; icon: typeof MousePointer2; label: string }[] = [
    { id: "pan", icon: MousePointer2, label: "Explore" },
    { id: "add", icon: MapPinPlus, label: "Add Node" },
    { id: "connect", icon: Cable, label: "Connect" },
    { id: "delete", icon: Trash2, label: "Delete" },
  ];

  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-[1500px] px-3 pb-10 pt-24 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Graph <span className="neon-text">Editor</span>
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-400">
              Modify the live network — every solver instantly respects your edits.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {TOOLS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => {
                  setMode(id);
                  setConnectFrom(null);
                }}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-wider transition-all ${
                  mode === id
                    ? "border border-cyan-400/60 bg-cyan-400/15 text-cyan-100 shadow-[0_0_16px_-4px_rgba(34,211,238,0.5)]"
                    : "btn-ghost text-slate-300"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
            <button
              onClick={() => void resetNetwork()}
              disabled={busy}
              className="btn-ghost flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-bold text-amber-200"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Factory Reset
            </button>
          </div>
        </div>

        <div className="glass mb-4 flex items-center gap-2 border-l-4 border-l-cyan-400 px-4 py-3">
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : <CircleCheck className="h-4 w-4 text-cyan-300" />}
          <p className="text-[12.5px] font-semibold text-slate-300">{MODE_HINTS[mode]}</p>
          <span className="ml-auto hidden shrink-0 gap-2 sm:flex">
            <span className="chip rounded-full px-3 py-1 text-[10px] font-bold text-cyan-300">{graph?.nodes.length ?? 0} nodes</span>
            <span className="chip rounded-full px-3 py-1 text-[10px] font-bold text-cyan-300">{graph?.edges.length ?? 0} roads</span>
            <span className="chip rounded-full px-3 py-1 text-[10px] font-bold text-violet-300">{customCount} custom</span>
            {blockedCount > 0 && (
              <span className="chip rounded-full border-rose-400/40 px-3 py-1 text-[10px] font-bold text-rose-300">{blockedCount} blocked</span>
            )}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="glass relative h-[520px] overflow-hidden p-0 lg:h-[calc(100vh-250px)]">
            {graph ? (
              <MapView
                className="h-full w-full rounded-[18px]"
                nodes={displayNodes}
                edges={graph.edges}
                sourceId={connectFrom}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onMapClick={onMapClick}
                flyTo={flyTo}
                showEdgeLabels={showLabels}
                onEdgeLabelsChange={setShowLabels}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              </div>
            )}

            {/* global place search */}
            <div className="absolute left-1/2 top-3 z-[500] w-[min(420px,50%)] -translate-x-1/2">
              <MapSearch
                placeholder="Search a place to add as a node…"
                onPick={(r) => {
                  setMode("add");
                  setPending({ lat: r.lat, lng: r.lng });
                  setNewName(r.name);
                  setFlyTo({ lat: r.lat, lng: r.lng, zoom: 15, t: Date.now() });
                  say(`“${r.name}” staged — confirm with the Add button below the map pin.`);
                }}
              />
            </div>

            {/* pending point form */}
            {pending && mode === "add" && (
              <div className="anim-fade-up absolute bottom-4 left-1/2 z-[500] w-[min(420px,92%)] -translate-x-1/2 rounded-2xl border border-cyan-400/40 bg-[#050a14]/95 p-4 backdrop-blur-md">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-300">
                    New location · {pending.lat.toFixed(4)}, {pending.lng.toFixed(4)}
                  </span>
                  <button onClick={() => setPending(null)} className="text-slate-500 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void addLocation()}
                    placeholder="Location name (e.g. Financial District)"
                    className="w-full rounded-xl border border-cyan-400/25 bg-[#0a1120] px-3 py-2.5 text-[13px] font-semibold text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/60"
                  />
                  <button
                    onClick={() => void addLocation()}
                    disabled={busy || !newName.trim()}
                    className="btn-neon flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-extrabold text-white"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>
              </div>
            )}

            {/* connect banner */}
            {mode === "connect" && connectFrom && (
              <div className="anim-fade-up absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-[#050a14]/90 px-4 py-2.5 backdrop-blur-md">
                <Link2 className="h-4 w-4 text-emerald-300" />
                <span className="text-[12px] font-bold text-emerald-200">From: {nameOf(connectFrom)} — click target node</span>
                <button onClick={() => setConnectFrom(null)} className="rounded-md bg-white/10 p-1 text-slate-300 hover:bg-white/20">
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* side panel */}
          <aside className="flex max-h-[calc(100vh-250px)] flex-col gap-4 overflow-y-auto pr-1">
            {mode === "connect" && (
              <section className="glass p-4">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                  Custom distance override (km — optional)
                </label>
                <input
                  value={customDist}
                  onChange={(e) => setCustomDist(e.target.value)}
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="auto: haversine × 1.28"
                  className="w-full rounded-xl border border-cyan-400/25 bg-[#0a1120] px-3 py-2.5 text-[13px] font-semibold text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/60"
                />
              </section>
            )}

            <section className="glass p-4">
              <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-300">
                Road Segments ({graph?.edges.length ?? 0})
              </h3>
              <div className="flex flex-col gap-1.5">
                {graph?.edges.map((e) => (
                  <div
                    key={e.id}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-[11.5px] ${
                      e.blocked ? "border-rose-400/30 bg-rose-500/10" : "border-white/8 bg-[#080f1e]"
                    }`}
                  >
                    <span className={`font-semibold ${e.blocked ? "text-rose-200 line-through" : "text-slate-200"}`}>
                      {nameOf(e.a)} ↔ {nameOf(e.b)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="mono text-[10px] text-slate-400">{e.distance.toFixed(1)}km</span>
                      <button
                        onClick={() =>
                          void (async () => {
                            await fetch("/api/graph/edge", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: e.id, blocked: !e.blocked }),
                            });
                            await refresh();
                          })()
                        }
                        className={`rounded-lg p-1.5 ${e.blocked ? "bg-rose-400/20 text-rose-300" : "bg-white/5 text-slate-400 hover:text-rose-300"}`}
                        title={e.blocked ? "Restore road" : "Block road"}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onEdgeClick(e.id)}
                        className="rounded-lg bg-white/5 p-1.5 text-slate-400 hover:text-rose-300"
                        title="Delete road (use Delete mode)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass p-4">
              <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.25em] text-violet-300">
                Custom Locations ({customCount})
              </h3>
              {customCount === 0 && (
                <p className="text-[12px] text-slate-500">
                  None yet — switch to “Add Node” and click the map to create your own waypoints.
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {graph?.nodes
                  .filter((n) => n.custom)
                  .map((n) => (
                    <span key={n.id} className="chip rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-violet-200">
                      {n.name}
                    </span>
                  ))}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {toast && (
        <div className="anim-fade-up fixed bottom-5 left-1/2 z-[1000] -translate-x-1/2 rounded-xl border border-cyan-400/40 bg-[#050a14]/95 px-5 py-3 text-[12.5px] font-semibold text-cyan-100 shadow-[0_0_30px_-6px_rgba(34,211,238,0.5)] backdrop-blur-md">
          {toast}
        </div>
      )}
    </main>
  );
}
