// ─────────────────────────────────────────────────────────────
// HYDERABAD METRO RAIL network — real stations (Red / Blue / Green)
// + Dijkstra-based journey planner with interchange detection.
// ─────────────────────────────────────────────────────────────

import { haversineKm } from "./graph";

export interface MetroStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lines: string[]; // >1 = interchange
}

export interface MetroLine {
  id: string;
  name: string;
  color: string;
  stationIds: string[];
}

export interface MetroSegment {
  line: string;
  lineName: string;
  color: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  stationNames: string[];
}

export interface MetroPlan {
  path: string[];
  stationNames: string[];
  segments: MetroSegment[];
  stops: number;
  transfers: number;
  transferAt: string[];
  distanceKm: number;
  minutes: number;
  fareEach: number;
}

const S = (id: string, name: string, lat: number, lng: number, lines: string[]): MetroStation => ({
  id,
  name,
  lat,
  lng,
  lines,
});

export const METRO_LINES: MetroLine[] = [
  {
    id: "red",
    name: "Red Line",
    color: "#ef4444",
    stationIds: [
      "r-miyapur", "r-jntu", "r-kphb", "r-kukatpally", "r-balanagar", "r-moosapet",
      "r-bharatnagar", "r-erragadda", "r-esi", "r-srnagar", "x-ameerpet", "r-punjagutta",
      "r-irummanzil", "r-khairatabad", "r-lakdikapul", "r-assembly", "r-nampally",
      "r-gandhibhavan", "r-omc", "x-mgbs", "r-malakpet", "r-newmarket", "r-musarambagh",
      "r-dilsukhnagar", "r-chaitanyapuri", "r-victoria", "r-lbnagar",
    ],
  },
  {
    id: "blue",
    name: "Blue Line",
    color: "#3b82f6",
    stationIds: [
      "b-nagole", "b-uppal", "b-stadium", "b-ngri", "b-habsiguda", "b-tarnaka",
      "b-mettuguda", "b-secunderabad-east", "x-parade", "b-paradise", "b-rasoolpura",
      "b-prakashnagar", "b-begumpet", "x-ameerpet", "b-madhuranagar", "b-yousufguda",
      "b-jubilee-rd5", "b-jubilee-checkpost", "b-peddamma", "b-madhapur",
      "b-durgamcheruvu", "b-hitech", "b-raidurg",
    ],
  },
  {
    id: "green",
    name: "Green Line",
    color: "#22c55e",
    stationIds: [
      "x-parade", "g-secunderabad-west", "g-gandhi-hospital", "g-musheerabad",
      "g-rtc-x-roads", "g-chikkadpally", "g-narayanguda", "g-sultan-bazar", "x-mgbs",
    ],
  },
];

export const METRO_STATIONS: MetroStation[] = [
  // ── RED LINE: Miyapur ↔ LB Nagar ──
  S("r-miyapur", "Miyapur", 17.4936, 78.3618, ["red"]),
  S("r-jntu", "JNTU College", 17.4985, 78.3887, ["red"]),
  S("r-kphb", "KPHB Colony", 17.494, 78.4, ["red"]),
  S("r-kukatpally", "Kukatpally", 17.4875, 78.4121, ["red"]),
  S("r-balanagar", "Balanagar", 17.468, 78.431, ["red"]),
  S("r-moosapet", "Moosapet", 17.4544, 78.4357, ["red"]),
  S("r-bharatnagar", "Bharat Nagar", 17.452, 78.4422, ["red"]),
  S("r-erragadda", "Erragadda", 17.4551, 78.445, ["red"]),
  S("r-esi", "ESI Hospital", 17.451, 78.449, ["red"]),
  S("r-srnagar", "SR Nagar", 17.444, 78.4413, ["red"]),
  S("x-ameerpet", "Ameerpet", 17.4348, 78.4484, ["red", "blue"]),
  S("r-punjagutta", "Punjagutta", 17.4282, 78.4512, ["red"]),
  S("r-irummanzil", "Irrum Manzil", 17.4226, 78.4538, ["red"]),
  S("r-khairatabad", "Khairatabad", 17.4163, 78.459, ["red"]),
  S("r-lakdikapul", "Lakdikapul", 17.4053, 78.4627, ["red"]),
  S("r-assembly", "Assembly", 17.398, 78.4675, ["red"]),
  S("r-nampally", "Nampally", 17.3922, 78.4701, ["red"]),
  S("r-gandhibhavan", "Gandhi Bhavan", 17.387, 78.4755, ["red"]),
  S("r-omc", "Osmania Medical College", 17.383, 78.4795, ["red"]),
  S("x-mgbs", "MG Bus Station", 17.379, 78.4845, ["red", "green"]),
  S("r-malakpet", "Malakpet", 17.3755, 78.496, ["red"]),
  S("r-newmarket", "New Market", 17.3695, 78.505, ["red"]),
  S("r-musarambagh", "Musarambagh", 17.364, 78.5146, ["red"]),
  S("r-dilsukhnagar", "Dilsukhnagar", 17.359, 78.5245, ["red"]),
  S("r-chaitanyapuri", "Chaitanyapuri", 17.355, 78.532, ["red"]),
  S("r-victoria", "Victoria Memorial", 17.348, 78.544, ["red"]),
  S("r-lbnagar", "LB Nagar", 17.3442, 78.5522, ["red"]),
  // ── BLUE LINE: Nagole ↔ Raidurg ──
  S("b-nagole", "Nagole", 17.389, 78.5588, ["blue"]),
  S("b-uppal", "Uppal", 17.3995, 78.5605, ["blue"]),
  S("b-stadium", "Stadium", 17.404, 78.555, ["blue"]),
  S("b-ngri", "NGRI", 17.41, 78.552, ["blue"]),
  S("b-habsiguda", "Habsiguda", 17.4148, 78.5435, ["blue"]),
  S("b-tarnaka", "Tarnaka", 17.4243, 78.5365, ["blue"]),
  S("b-mettuguda", "Mettuguda", 17.4288, 78.5225, ["blue"]),
  S("b-secunderabad-east", "Secunderabad East", 17.434, 78.5015, ["blue"]),
  S("x-parade", "JBS Parade Ground", 17.4409, 78.4912, ["blue", "green"]),
  S("b-paradise", "Paradise", 17.4413, 78.4875, ["blue"]),
  S("b-rasoolpura", "Rasoolpura", 17.44, 78.478, ["blue"]),
  S("b-prakashnagar", "Prakash Nagar", 17.4425, 78.4675, ["blue"]),
  S("b-begumpet", "Begumpet", 17.439, 78.459, ["blue"]),
  S("b-madhuranagar", "Madhura Nagar", 17.433, 78.442, ["blue"]),
  S("b-yousufguda", "Yousufguda", 17.43, 78.4365, ["blue"]),
  S("b-jubilee-rd5", "Jubilee Hills Rd No.5", 17.4285, 78.426, ["blue"]),
  S("b-jubilee-checkpost", "Jubilee Hills Check Post", 17.43, 78.418, ["blue"]),
  S("b-peddamma", "Peddamma Gudi", 17.431, 78.41, ["blue"]),
  S("b-madhapur", "Madhapur", 17.436, 78.3995, ["blue"]),
  S("b-durgamcheruvu", "Durgam Cheruvu", 17.4317, 78.3895, ["blue"]),
  S("b-hitech", "Hitech City", 17.427, 78.3818, ["blue"]),
  S("b-raidurg", "Raidurg", 17.4194, 78.3765, ["blue"]),
  // ── GREEN LINE: JBS Parade Ground ↔ MGBS ──
  S("g-secunderabad-west", "Secunderabad West", 17.4337, 78.4971, ["green"]),
  S("g-gandhi-hospital", "Gandhi Hospital", 17.4225, 78.4965, ["green"]),
  S("g-musheerabad", "Musheerabad", 17.416, 78.494, ["green"]),
  S("g-rtc-x-roads", "RTC Cross Roads", 17.41, 78.4905, ["green"]),
  S("g-chikkadpally", "Chikkadpally", 17.4045, 78.488, ["green"]),
  S("g-narayanguda", "Narayanguda", 17.3998, 78.4855, ["green"]),
  S("g-sultan-bazar", "Sultan Bazar", 17.3942, 78.4828, ["green"]),
];

const STATION = new Map(METRO_STATIONS.map((s) => [s.id, s]));

export function metroStation(id: string): MetroStation | undefined {
  return STATION.get(id);
}

// ── adjacency (consecutive stations on each line, weighted by real distance) ──
type MAdj = Map<string, { to: string; w: number; line: string }[]>;

function buildAdj(): MAdj {
  const adj: MAdj = new Map(METRO_STATIONS.map((s) => [s.id, []]));
  for (const line of METRO_LINES) {
    for (let i = 0; i < line.stationIds.length - 1; i++) {
      const a = STATION.get(line.stationIds[i])!;
      const b = STATION.get(line.stationIds[i + 1])!;
      const w = haversineKm(a, b);
      adj.get(a.id)!.push({ to: b.id, w, line: line.id });
      adj.get(b.id)!.push({ to: a.id, w, line: line.id });
    }
  }
  return adj;
}

// Hyderabad Metro fare slabs (distance-based, ₹10 min · ₹60 max)
export function metroFare(distanceKm: number): number {
  const slabs: [number, number][] = [
    [2, 10], [4, 15], [6, 20], [8, 25], [12, 32], [16, 38], [20, 44], [24, 50], [28, 55],
  ];
  for (const [maxKm, fare] of slabs) if (distanceKm <= maxKm) return fare;
  return 60;
}

// Dijkstra over the metro graph → shortest path, then segment it by line
// (greedy line continuity minimises interchanges).
export function planJourney(fromId: string, toId: string): MetroPlan | null {
  if (!STATION.has(fromId) || !STATION.has(toId) || fromId === toId) return null;
  const adj = buildAdj();
  const dist = new Map<string, number>([[fromId, 0]]);
  const prev = new Map<string, string>();
  const pq: [number, string][] = [[0, fromId]];
  const done = new Set<string>();
  while (pq.length) {
    let bi = 0;
    for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i;
    const [d, u] = pq.splice(bi, 1)[0];
    if (done.has(u)) continue;
    done.add(u);
    if (u === toId) break;
    for (const { to, w } of adj.get(u) ?? []) {
      if (done.has(to)) continue;
      const alt = d + w;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, u);
        pq.push([alt, to]);
      }
    }
  }
  if (!prev.has(toId)) return null;
  const path = [toId];
  let cur = toId;
  while (cur !== fromId) {
    cur = prev.get(cur)!;
    path.unshift(cur);
  }

  // segment by line (keep current line wherever possible)
  const segments: MetroSegment[] = [];
  const transferAt: string[] = [];
  let currentLine = STATION.get(path[0])!.lines.find((l) =>
    STATION.get(path[1])!.lines.includes(l),
  )!;
  let segStart = 0;
  const lineMeta = new Map(METRO_LINES.map((l) => [l.id, l]));

  let distanceKm = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = STATION.get(path[i])!;
    const b = STATION.get(path[i + 1])!;
    distanceKm += haversineKm(a, b);
    const common = a.lines.filter((l) => b.lines.includes(l));
    if (!common.includes(currentLine)) {
      // record completed segment, then switch line at station a
      const meta = lineMeta.get(currentLine)!;
      segments.push({
        line: currentLine,
        lineName: meta.name,
        color: meta.color,
        fromId: path[segStart],
        fromName: STATION.get(path[segStart])!.name,
        toId: a.id,
        toName: a.name,
        stationNames: path.slice(segStart, i + 1).map((id) => STATION.get(id)!.name),
      });
      transferAt.push(a.name);
      currentLine = common[0];
      segStart = i;
    }
  }
  const endMeta = lineMeta.get(currentLine)!;
  segments.push({
    line: currentLine,
    lineName: endMeta.name,
    color: endMeta.color,
    fromId: path[segStart],
    fromName: STATION.get(path[segStart])!.name,
    toId: toId,
    toName: STATION.get(toId)!.name,
    stationNames: path.slice(segStart).map((id) => STATION.get(id)!.name),
  });

  const stops = path.length - 1;
  const minutes = Math.ceil((distanceKm / 33) * 60 + stops * 0.5);
  return {
    path,
    stationNames: path.map((id) => STATION.get(id)!.name),
    segments,
    stops,
    transfers: segments.length - 1,
    transferAt,
    distanceKm: Math.round(distanceKm * 10) / 10,
    minutes,
    fareEach: metroFare(distanceKm),
  };
}
