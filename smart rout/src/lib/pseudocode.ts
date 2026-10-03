export const DIJKSTRA_CODE = [
  "function Dijkstra(G, source, target):",
  "  dist[v] ← ∞ ∀v;  dist[source] ← 0;  prev[v] ← ⊥",
  "  PQ ← { (0, source) }               // min-heap",
  "  while PQ ≠ ∅:",
  "    u ← extract-min(PQ)",
  "    if u settled: continue;  settle u",
  "    if u = target: break      // invariant hit",
  "    for each edge (u, v, w):",
  "      alt ← dist[u] + w",
  "      if alt < dist[v]:",
  "        dist[v] ← alt; prev[v] ← u; push (alt, v)",
  "  path ← backtrack(prev, target)",
  "  return dist[target], path",
];

export const ASTAR_CODE = [
  "function A*(G, source, goal):",
  "  g[s] ← 0;  f[s] ← h(s, goal)   // haversine h",
  "  OPEN ← { (f(s), s) }",
  "  while OPEN ≠ ∅:",
  "    u ← node in OPEN with lowest f",
  "    if u = goal: return path      // h admissible ⇒ optimal",
  "    move u to CLOSED",
  "    for each edge (u, v, w):",
  "      tentative ← g[u] + w",
  "      if tentative < g[v]:",
  "        g[v] ← tentative; f[v] ← tentative + h(v, goal)",
  "        prev[v] ← u;  push v to OPEN",
  "  path ← backtrack(prev, goal)",
];

export const FLOYD_CODE = [
  "function FloydWarshall(G):",
  "  D ← V×V matrix: 0 diag, w(i,j) edges, ∞ else",
  "  for k in V:                     // pivot / intermediate",
  "    for i in V:",
  "      for j in V:",
  "        if D[i][k] + D[k][j] < D[i][j]:",
  "          // triangle inequality improvement",
  "          D[i][j] ← D[i][k] + D[k][j]",
  "          next[i][j] ← next[i][k] // path bookkeeping",
  "  return D, next                  // ALL pairs solved",
];

export function codeFor(algo: string): string[] {
  if (algo === "astar") return ASTAR_CODE;
  if (algo === "floyd") return FLOYD_CODE;
  return DIJKSTRA_CODE;
}
