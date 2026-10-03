// ─────────────────────────────────────────────────────────────
// SMART ROUTE FINDER · core graph types, seed network (Hyderabad)
// ─────────────────────────────────────────────────────────────

export interface GNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  custom?: boolean;
}

export interface GEdge {
  id: number;
  a: string;
  b: string;
  distance: number;
  blocked: boolean;
}

export interface Graph {
  nodes: GNode[];
  edges: GEdge[];
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLa = ((b.lat - a.lat) * Math.PI) / 180;
  const dLo = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLa / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export const fmtKm = (v: number): string =>
  !isFinite(v) ? "∞" : v >= 100 ? v.toFixed(0) : v.toFixed(1);

// ─────────────────────────────────────────────────────────────
// Hyderabad sample network (23 locations, real coordinates)
// ─────────────────────────────────────────────────────────────

export const SEED_NODES: GNode[] = [
  { id: "gachibowli", name: "Gachibowli", lat: 17.4401, lng: 78.3489 },
  { id: "hitech", name: "Hitech City", lat: 17.4435, lng: 78.3772 },
  { id: "madhapur", name: "Madhapur", lat: 17.4483, lng: 78.3915 },
  { id: "kondapur", name: "Kondapur", lat: 17.4613, lng: 78.3657 },
  { id: "miyapur", name: "Miyapur", lat: 17.493, lng: 78.357 },
  { id: "kukatpally", name: "Kukatpally", lat: 17.4949, lng: 78.3996 },
  { id: "jubilee", name: "Jubilee Hills", lat: 17.4314, lng: 78.407 },
  { id: "banjara", name: "Banjara Hills", lat: 17.4126, lng: 78.4482 },
  { id: "panjagutta", name: "Panjagutta", lat: 17.4275, lng: 78.451 },
  { id: "ameerpet", name: "Ameerpet", lat: 17.4375, lng: 78.4483 },
  { id: "srnagar", name: "SR Nagar", lat: 17.4424, lng: 78.4401 },
  { id: "begumpet", name: "Begumpet", lat: 17.4447, lng: 78.4664 },
  { id: "secunderabad", name: "Secunderabad", lat: 17.4399, lng: 78.4983 },
  { id: "tarnaka", name: "Tarnaka", lat: 17.4276, lng: 78.5339 },
  { id: "uppal", name: "Uppal", lat: 17.4056, lng: 78.5594 },
  { id: "dilsukhnagar", name: "Dilsukhnagar", lat: 17.3688, lng: 78.5247 },
  { id: "lbnagar", name: "LB Nagar", lat: 17.3457, lng: 78.5522 },
  { id: "charminar", name: "Charminar", lat: 17.3616, lng: 78.4747 },
  { id: "nampally", name: "Nampally", lat: 17.3899, lng: 78.4701 },
  { id: "mehdipatnam", name: "Mehdipatnam", lat: 17.396, lng: 78.439 },
  { id: "tolichowki", name: "Tolichowki", lat: 17.3947, lng: 78.413 },
  { id: "manikonda", name: "Manikonda", lat: 17.4033, lng: 78.3807 },
  { id: "shamshabad", name: "Shamshabad (RGIA)", lat: 17.2403, lng: 78.4294 },
];

// [a, b] undirected road pairs — weights derived from real haversine
// distance × road-curvature factor at seed time.
export const SEED_PAIRS: [string, string][] = [
  ["gachibowli", "hitech"],
  ["gachibowli", "kondapur"],
  ["gachibowli", "manikonda"],
  ["gachibowli", "tolichowki"],
  ["gachibowli", "shamshabad"],
  ["kondapur", "hitech"],
  ["kondapur", "miyapur"],
  ["kondapur", "madhapur"],
  ["miyapur", "kukatpally"],
  ["hitech", "madhapur"],
  ["hitech", "jubilee"],
  ["madhapur", "kukatpally"],
  ["madhapur", "jubilee"],
  ["madhapur", "srnagar"],
  ["kukatpally", "ameerpet"],
  ["kukatpally", "srnagar"],
  ["kukatpally", "begumpet"],
  ["jubilee", "banjara"],
  ["jubilee", "panjagutta"],
  ["banjara", "panjagutta"],
  ["banjara", "mehdipatnam"],
  ["banjara", "tolichowki"],
  ["panjagutta", "ameerpet"],
  ["panjagutta", "nampally"],
  ["ameerpet", "srnagar"],
  ["ameerpet", "begumpet"],
  ["begumpet", "secunderabad"],
  ["secunderabad", "tarnaka"],
  ["tarnaka", "uppal"],
  ["uppal", "lbnagar"],
  ["uppal", "dilsukhnagar"],
  ["dilsukhnagar", "lbnagar"],
  ["dilsukhnagar", "charminar"],
  ["charminar", "nampally"],
  ["nampally", "mehdipatnam"],
  ["mehdipatnam", "tolichowki"],
  ["tolichowki", "manikonda"],
  ["lbnagar", "shamshabad"],
];

export function seedEdges(): { a: string; b: string; distance: number }[] {
  const byId = new Map(SEED_NODES.map((n) => [n.id, n]));
  return SEED_PAIRS.map(([a, b]) => {
    const na = byId.get(a)!;
    const nb = byId.get(b)!;
    const d = haversineKm(na, nb) * 1.28; // road curvature factor
    return { a, b, distance: Math.round(d * 10) / 10 };
  });
}
