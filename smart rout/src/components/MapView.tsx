"use client";

import { useEffect, useRef, useState } from "react";
import type { GNode, GEdge } from "@/lib/graph";
import type { MetroStation, MetroLine } from "@/lib/metro";
import "leaflet/dist/leaflet.css";
import type * as LeafletNS from "leaflet";
import {
  MoonStar,
  Sun,
  Compass,
  Map as MapIcon,
  Building2,
  Mountain,
  Bike,
  TramFront,
  Satellite,
  MapPinned,
  TreePine,
  Maximize2,
  Minimize2,
  Ruler,
  TrainTrack,
} from "lucide-react";

type L = typeof LeafletNS;
type BasemapId =
  | "dark"
  | "light"
  | "voyager"
  | "osm"
  | "hot"
  | "topo"
  | "cyclosm"
  | "transit"
  | "sat"
  | "esriStreets"
  | "esriTopo";

export interface RouteLine {
  path?: string[];
  coords?: [number, number][];
  color: string;
  dash?: string;
  weight?: number;
  opacity?: number;
  glow?: boolean;
}

export interface FlyTo {
  lat: number;
  lng: number;
  zoom?: number;
  t: number;
}

export interface TempMarker {
  lat: number;
  lng: number;
  label?: string;
}

interface Props {
  nodes: GNode[];
  edges: GEdge[];
  routes?: RouteLine[];
  sourceId?: string | null;
  targetId?: string | null;
  onNodeClick?: (id: string) => void;
  onEdgeClick?: (id: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  flyTo?: FlyTo | null;
  tempMarker?: TempMarker | null;
  showEdgeLabels?: boolean;
  onEdgeLabelsChange?: (v: boolean) => void;
  liftScale?: boolean;
  metroStations?: MetroStation[];
  metroLines?: MetroLine[];
  showMetro?: boolean;
  onShowMetroChange?: (v: boolean) => void;
  metroJourney?: string[] | null;
  onMetroStationClick?: (id: string) => void;
  fitBoundsCoords?: [number, number][];
}

const BASEMAP_META: { id: BasemapId; label: string; sub: string; icon: typeof MoonStar }[] = [
  { id: "dark", label: "Neon Dark", sub: "CARTO", icon: MoonStar },
  { id: "light", label: "Paper Light", sub: "CARTO", icon: Sun },
  { id: "voyager", label: "Voyager", sub: "CARTO", icon: Compass },
  { id: "osm", label: "OSM Standard", sub: "full detail", icon: MapIcon },
  { id: "hot", label: "Humanitarian", sub: "OSM · HOT", icon: Building2 },
  { id: "topo", label: "Topographic", sub: "OpenTopoMap", icon: Mountain },
  { id: "cyclosm", label: "Cycle Map", sub: "CyclOSM", icon: Bike },
  { id: "transit", label: "Public Transit", sub: "ÖPNV-Karte", icon: TramFront },
  { id: "sat", label: "Satellite", sub: "Esri Maxar", icon: Satellite },
  { id: "esriStreets", label: "Esri Streets", sub: "ArcGIS", icon: MapPinned },
  { id: "esriTopo", label: "Esri Terrain", sub: "ArcGIS", icon: TreePine },
];

const BASEMAP_IDS = new Set<string>(BASEMAP_META.map((b) => b.id));

export default function MapView(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const layersRef = useRef<{
    routes?: LeafletNS.LayerGroup;
    metro?: LeafletNS.LayerGroup;
    edges?: LeafletNS.LayerGroup;
    nodes?: LeafletNS.LayerGroup;
    temp?: LeafletNS.LayerGroup;
  }>({});
  const baseLayersRef = useRef<Partial<Record<BasemapId, LeafletNS.Layer>>>({});
  const railOverlayRef = useRef<LeafletNS.TileLayer | null>(null);
  const leafletRef = useRef<L | null>(null);
  const fittedRef = useRef(false);
  const prevRoutesKeyRef = useRef("");
  const propsRef = useRef(props);
  propsRef.current = props;

  const [basemap, setBasemap] = useState<BasemapId>("dark");
  const [railOn, setRailOn] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const basemapRef = useRef<BasemapId>("dark");

  const nodesKey = JSON.stringify(props.nodes);
  const edgesKey = JSON.stringify(props.edges);
  const routesKey = JSON.stringify(props.routes ?? []);
  const tempKey = JSON.stringify(props.tempMarker ?? null);
  const metroKey = JSON.stringify([props.metroStations?.length ?? 0, props.metroJourney ?? null, props.showMetro !== false]);

  function applyZoomLabelClasses() {
    const map = mapRef.current;
    if (!map) return;
    const z = map.getZoom();
    const el = map.getContainer();
    el.classList.toggle("hide-edge-labels", z < 11.55);
    el.classList.toggle("hide-metro-labels", z < 12.6);
  }

  function switchBasemap(id: BasemapId) {
    const map = mapRef.current;
    if (!map) return;
    const prev = baseLayersRef.current[basemapRef.current];
    const next = baseLayersRef.current[id];
    if (!next) return;
    if (prev) map.removeLayer(prev);
    next.addTo(map);
    basemapRef.current = id;
    setBasemap(id);
    try {
      localStorage.setItem("srf-basemap", id);
    } catch {
      /* private mode */
    }
  }

  function toggleRail() {
    const map = mapRef.current;
    const rail = railOverlayRef.current;
    if (!map || !rail) return;
    const next = !railOn;
    if (next) rail.addTo(map);
    else map.removeLayer(rail);
    setRailOn(next);
    try {
      localStorage.setItem("srf-rail-overlay", next ? "1" : "0");
    } catch {
      /* private mode */
    }
  }

  function renderLayers() {
    const L = leafletRef.current;
    const map = mapRef.current;
    const g = layersRef.current;
    if (!L || !map || !g.nodes || !g.edges || !g.routes || !g.temp || !g.metro) return;
    const p = propsRef.current;
    const byId = new Map(p.nodes.map((n) => [n.id, n]));

    // ── routes ────────────────────────────────
    g.routes.clearLayers();
    for (const r of p.routes ?? []) {
      const latlngs: [number, number][] =
        r.coords ??
        (r.path ?? [])
          .map((id) => byId.get(id))
          .filter((n): n is GNode => !!n)
          .map((n) => [n.lat, n.lng] as [number, number]);
      if (latlngs.length < 2) continue;
      const w = r.weight ?? 4;
      if (r.glow) {
        L.polyline(latlngs, { color: r.color, weight: w + 9, opacity: 0.2, lineCap: "round", lineJoin: "round" }).addTo(g.routes!);
        L.polyline(latlngs, { color: r.color, weight: w + 4, opacity: 0.32, lineCap: "round", lineJoin: "round", className: "route-glow" }).addTo(g.routes!);
      }
      L.polyline(latlngs, {
        color: r.color,
        weight: w,
        opacity: r.opacity ?? 0.95,
        dashArray: r.dash,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(g.routes!);
    }

    // ── metro network ─────────────────────────
    g.metro.clearLayers();
    const stationById = new Map((p.metroStations ?? []).map((s) => [s.id, s]));
    const showMetro = p.showMetro !== false && (p.metroStations?.length ?? 0) > 0;
    if (showMetro) {
      for (const line of p.metroLines ?? []) {
        const coords = line.stationIds
          .map((id) => stationById.get(id))
          .filter((s): s is MetroStation => !!s)
          .map((s) => [s.lat, s.lng] as [number, number]);
        if (coords.length < 2) continue;
        L.polyline(coords, { color: "#020617", weight: 7, opacity: 0.75, lineCap: "round", lineJoin: "round", interactive: false }).addTo(g.metro!);
        L.polyline(coords, { color: line.color, weight: 4, opacity: 0.95, lineCap: "round", lineJoin: "round", interactive: false }).addTo(g.metro!);
      }
      if (p.metroJourney && p.metroJourney.length > 1) {
        const jcoords = p.metroJourney
          .map((id) => stationById.get(id))
          .filter((s): s is MetroStation => !!s)
          .map((s) => [s.lat, s.lng] as [number, number]);
        if (jcoords.length > 1) {
          L.polyline(jcoords, { color: "#fbbf24", weight: 11, opacity: 0.28, lineCap: "round", lineJoin: "round", interactive: false, className: "flow-anim" }).addTo(g.metro!);
          L.polyline(jcoords, { color: "#fde68a", weight: 6.5, opacity: 0.98, lineCap: "round", lineJoin: "round", interactive: false, className: "route-glow" }).addTo(g.metro!);
        }
      }
      const journeySet = new Set(p.metroJourney ?? []);
      for (const s of p.metroStations ?? []) {
        const interchange = s.lines.length > 1;
        const onJourney = journeySet.has(s.id);
        const lineColor = (p.metroLines ?? []).find((l) => l.id === s.lines[0])?.color ?? "#94a3b8";
        const cls = ["metro-station", interchange ? "metro-interchange" : "", onJourney ? "metro-onjourney" : ""]
          .filter(Boolean)
          .join(" ");
        const size = interchange ? 15 : 11;
        const marker = L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div class="${cls}" style="--mc:${interchange ? "#ffffff" : lineColor}"></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
          interactive: !!p.onMetroStationClick,
          zIndexOffset: interchange ? 800 : 600,
        });
        marker.bindTooltip(s.name + (interchange ? " ⇄ interchange" : ""), {
          permanent: true,
          direction: "top",
          offset: [0, -9],
          className: "metro-label",
          interactive: false,
        });
        if (p.onMetroStationClick) {
          marker.on("click", (ev) => {
            ev.originalEvent.stopPropagation?.();
            p.onMetroStationClick?.(s.id);
          });
        }
        marker.addTo(g.metro!);
      }
    }

    // ── roads ─────────────────────────────────
    g.edges.clearLayers();
    const showLabels = p.showEdgeLabels !== false;
    for (const e of p.edges) {
      const na = byId.get(e.a);
      const nb = byId.get(e.b);
      if (!na || !nb) continue;
      const line = L.polyline(
        [
          [na.lat, na.lng],
          [nb.lat, nb.lng],
        ],
        {
          color: e.blocked ? "#f43f5e" : "#1e6f8a",
          weight: e.blocked ? 3 : 2.2,
          opacity: e.blocked ? 0.9 : 0.55,
          dashArray: e.blocked ? "7 8" : undefined,
        },
      );
      line.bindTooltip(
        `${na.name} ↔ ${nb.name} · ${e.distance.toFixed(1)} km${e.blocked ? " · BLOCKED" : ""}`,
        { sticky: true, className: "map-label", direction: "top" },
      );
      if (showLabels) {
        line.bindTooltip(`${e.distance.toFixed(1)}`, {
          permanent: true,
          direction: "center",
          className: "edge-label",
          interactive: false,
          opacity: 1,
        });
      }
      line.on("click", (ev) => {
        ev.originalEvent.stopPropagation?.();
        p.onEdgeClick?.(e.id);
      });
      line.addTo(g.edges!);
    }

    // ── network nodes ─────────────────────────
    g.nodes.clearLayers();
    const onRoute = new Set((p.routes ?? []).find((r) => r.glow && r.path)?.path ?? []);
    p.nodes.forEach((n, i) => {
      const cls = [
        "map-node",
        p.sourceId === n.id ? "is-source" : "",
        p.targetId === n.id ? "is-target" : "",
        onRoute.has(n.id) && p.sourceId !== n.id && p.targetId !== n.id ? "is-onroute" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const marker = L.marker([n.lat, n.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="${cls}">${i + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        zIndexOffset: p.sourceId === n.id || p.targetId === n.id ? 1000 : 500,
      });
      marker.bindTooltip(n.name, {
        permanent: true,
        direction: "top",
        offset: [0, -16],
        className: "map-label",
      });
      marker.on("click", (ev) => {
        ev.originalEvent.stopPropagation?.();
        p.onNodeClick?.(n.id);
      });
      marker.addTo(g.nodes!);
    });

    // ── temporary search pin ──────────────────
    g.temp.clearLayers();
    if (p.tempMarker) {
      const tm = L.marker([p.tempMarker.lat, p.tempMarker.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="map-temp anim-pulse-ring">+</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        zIndexOffset: 1200,
        interactive: false,
      });
      if (p.tempMarker.label) {
        tm.bindTooltip(p.tempMarker.label, {
          permanent: true,
          direction: "bottom",
          offset: [0, 14],
          className: "map-label",
        });
      }
      tm.addTo(g.temp!);
    }

    // ── bounds ────────────────────────────────
    if (!fittedRef.current) {
      if (p.nodes.length) {
        const b = L.latLngBounds(p.nodes.map((n) => [n.lat, n.lng] as [number, number]));
        map.fitBounds(b.pad(0.08));
        fittedRef.current = true;
        setTimeout(applyZoomLabelClasses, 150);
      } else if (p.fitBoundsCoords && p.fitBoundsCoords.length > 1) {
        map.fitBounds(L.latLngBounds(p.fitBoundsCoords).pad(0.06));
        fittedRef.current = true;
        setTimeout(applyZoomLabelClasses, 150);
      }
    }
    const rk = JSON.stringify(p.routes ?? []);
    const routes = p.routes ?? [];
    const firstPathRoutes = routes.find((r) => (r.path?.length ?? 0) > 1);
    if (prevRoutesKeyRef.current !== rk && firstPathRoutes?.path) {
      const pts = firstPathRoutes.path
        .map((id) => byId.get(id))
        .filter((n): n is GNode => !!n)
        .map((n) => [n.lat, n.lng] as [number, number]);
      if (pts.length > 1) {
        map.flyToBounds(L.latLngBounds(pts).pad(0.18), { duration: 0.7 });
      }
    }
    prevRoutesKeyRef.current = rk;
  }

  // init map once
  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const mod = await import("leaflet");
      const L = (mod.default ?? mod) as unknown as L;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        worldCopyJump: true,
        minZoom: 3,
        maxZoom: 19,
      }).setView([17.42, 78.45], 11);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);

      const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
      const layers: Partial<Record<BasemapId, LeafletNS.Layer>> = {
        dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: `${OSM_ATTR} &copy; <a href="https://carto.com/" target="_blank">CARTO</a>`,
          subdomains: "abcd",
          maxZoom: 19,
        }),
        light: L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution: `${OSM_ATTR} &copy; <a href="https://carto.com/" target="_blank">CARTO</a>`,
          subdomains: "abcd",
          maxZoom: 19,
        }),
        voyager: L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          attribution: `${OSM_ATTR} &copy; <a href="https://carto.com/" target="_blank">CARTO</a>`,
          subdomains: "abcd",
          maxZoom: 19,
        }),
        osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: OSM_ATTR,
          maxZoom: 19,
        }),
        hot: L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
          attribution: `${OSM_ATTR}, Tiles style by <a href="https://www.hotosm.org/" target="_blank">HOT</a> hosted by OSM France`,
          maxZoom: 19,
        }),
        topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
          attribution: `${OSM_ATTR}, SRTM | style: &copy; <a href="https://opentopomap.org" target="_blank">OpenTopoMap</a> (CC-BY-SA)`,
          maxNativeZoom: 17,
          maxZoom: 19,
        }),
        cyclosm: L.tileLayer("https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", {
          attribution: `${OSM_ATTR}, style: <a href="https://www.cyclosm.org" target="_blank">CyclOSM</a> hosted by OSM France`,
          maxNativeZoom: 18,
          maxZoom: 19,
        }),
        transit: L.tileLayer("https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png", {
          attribution: `${OSM_ATTR} | map: &copy; <a href="https://memomaps.de/" target="_blank">MeMoMaps</a> (CC-BY-SA)`,
          maxNativeZoom: 18,
          maxZoom: 19,
        }),
        sat: L.layerGroup([
          L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
              attribution: `Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics &middot; ${OSM_ATTR}`,
              maxZoom: 19,
            },
          ),
          L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 19, opacity: 0.9 },
          ),
        ]),
        esriStreets: L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: `Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS &middot; ${OSM_ATTR}`,
            maxZoom: 19,
          },
        ),
        esriTopo: L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: `Tiles &copy; Esri &mdash; Source: Esri, USGS, NOAA &middot; ${OSM_ATTR}`,
            maxZoom: 19,
          },
        ),
      };
      baseLayersRef.current = layers;

      // OpenRailwayMap rail overlay (toggleable)
      railOverlayRef.current = L.tileLayer(
        "https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
        {
          attribution: `${OSM_ATTR}, style: <a href="https://www.openrailwaymap.org/" target="_blank">OpenRailwayMap</a> (CC-BY-SA)`,
          maxNativeZoom: 18,
          maxZoom: 19,
          opacity: 0.85,
        },
      );

      let initial: BasemapId = "dark";
      try {
        const saved = localStorage.getItem("srf-basemap");
        if (saved && BASEMAP_IDS.has(saved)) initial = saved as BasemapId;
        if (localStorage.getItem("srf-rail-overlay") === "1") {
          railOverlayRef.current.addTo(map);
          setRailOn(true);
        }
      } catch {
        /* ignore */
      }
      basemapRef.current = initial;
      setBasemap(initial);
      baseLayersRef.current[initial]!.addTo(map);

      layersRef.current.routes = L.layerGroup().addTo(map);
      layersRef.current.metro = L.layerGroup().addTo(map);
      layersRef.current.edges = L.layerGroup().addTo(map);
      layersRef.current.nodes = L.layerGroup().addTo(map);
      layersRef.current.temp = L.layerGroup().addTo(map);
      map.on("click", (e) => {
        propsRef.current.onMapClick?.(e.latlng.lat, e.latlng.lng);
      });
      map.on("zoomend", applyZoomLabelClasses);
      mapRef.current = map;
      renderLayers();

      ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(containerRef.current);

      const onFs = () => {
        setIsFs(!!document.fullscreenElement);
        setTimeout(() => map.invalidateSize(), 350);
      };
      document.addEventListener("fullscreenchange", onFs);
      (containerRef.current as HTMLElement & { __fsCleanup?: () => void }).__fsCleanup = () =>
        document.removeEventListener("fullscreenchange", onFs);
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      const el = containerRef.current as HTMLElement & { __fsCleanup?: () => void };
      el?.__fsCleanup?.();
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      fittedRef.current = false;
      prevRoutesKeyRef.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw on data changes
  useEffect(() => {
    renderLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesKey, edgesKey, routesKey, tempKey, metroKey, props.sourceId, props.targetId, props.showEdgeLabels]);

  // camera flights
  const flyT = props.flyTo?.t;
  useEffect(() => {
    const f = propsRef.current.flyTo;
    if (!f || !mapRef.current) return;
    mapRef.current.flyTo([f.lat, f.lng], f.zoom ?? 14, { duration: 1.1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyT]);

  const toggleFs = () => {
    const shell = containerRef.current?.closest(".srf-map-shell") as HTMLElement | null;
    const el = shell ?? containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  return (
    <div className={`srf-map-shell relative overflow-hidden ${props.liftScale ? "lift-scale" : ""} ${props.className ?? ""}`}>
      <div ref={containerRef} className="absolute inset-0 z-0" />
      <div className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] shadow-[inset_0_0_60px_rgba(5,10,25,0.55)]" />

      {/* basemap gallery + overlay toggles */}
      <div className="absolute right-2.5 top-2.5 z-[500] flex w-[152px] flex-col gap-1 rounded-2xl border border-cyan-400/20 bg-[#050a14]/92 p-1.5 backdrop-blur-md">
        <div className="px-2 pb-0.5 pt-1 text-[8.5px] font-extrabold uppercase tracking-[0.22em] text-cyan-400/70">
          Basemaps · 11 styles
        </div>
        <div className="flex max-h-[min(300px,42vh)] flex-col gap-1 overflow-y-auto pr-0.5">
          {BASEMAP_META.map(({ id, label, sub, icon: Icon }) => (
            <button
              key={id}
              onClick={() => switchBasemap(id)}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-[7px] text-left transition-all ${
                basemap === id
                  ? "bg-cyan-400/20 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.4)]"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[10.5px] font-bold">{label}</span>
                <span className="block truncate text-[8px] font-semibold uppercase tracking-wider opacity-60">{sub}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-cyan-400/10 pt-1">
          <div className="px-2 pb-0.5 pt-1 text-[8.5px] font-extrabold uppercase tracking-[0.22em] text-cyan-400/70">
            Overlays
          </div>
          <button
            onClick={toggleRail}
            className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[10.5px] font-bold transition-all ${
              railOn ? "text-orange-300" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <TrainTrack className="h-3.5 w-3.5 shrink-0" />
            Railways {railOn ? "· ON" : "· OFF"}
          </button>
          {props.onShowMetroChange && (
            <button
              onClick={() => props.onShowMetroChange?.(!(props.showMetro !== false))}
              className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[10.5px] font-bold transition-all ${
                props.showMetro !== false ? "text-red-300" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <TramFront className="h-3.5 w-3.5 shrink-0" />
              Metro {props.showMetro !== false ? "· ON" : "· OFF"}
            </button>
          )}
          {props.onEdgeLabelsChange && (
            <button
              onClick={() => props.onEdgeLabelsChange?.(!(props.showEdgeLabels !== false))}
              className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[10.5px] font-bold transition-all ${
                props.showEdgeLabels !== false ? "text-emerald-300" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Ruler className="h-3.5 w-3.5 shrink-0" />
              Road km {props.showEdgeLabels !== false ? "· ON" : "· OFF"}
            </button>
          )}
        </div>
      </div>

      {/* fullscreen toggle */}
      <button
        onClick={toggleFs}
        title={isFs ? "Exit fullscreen" : "Fullscreen map"}
        className="absolute bottom-24 right-2.5 z-[500] flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-cyan-400/20 bg-[#050a14]/90 text-cyan-300 backdrop-blur-md transition-all hover:border-cyan-400/60 hover:bg-[#0a1a2e]"
      >
        {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
