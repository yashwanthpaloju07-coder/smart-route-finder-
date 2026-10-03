// ─────────────────────────────────────────────────────────────
// SMART ROUTE FINDER · real DAA algorithm implementations
// Dijkstra · A* · Floyd–Warshall · Yen's K-shortest paths
// Each solver can emit a full execution trace for the visualizer.
// ─────────────────────────────────────────────────────────────

import { GNode, GEdge, haversineKm, edgeKey, fmtKm } from "./graph";

export type AlgoId = "dijkstra" | "astar" | "floyd";

export interface StepEvent {
  op:
    | "init"
    | "dequeue"
    | "settle"
    | "consider"
    | "update"
    | "skip"
    | "path"
    | "done"
    | "fw-pivot"
    | "fw-update"
    | "fw-done";
  node?: string;
  from?: string;
  to?: string;
  via?: string;
  dist?: number;
  line: number; // pseudocode line index to highlight
  note: string;
  path?: string[];
}

export interface AlgoStats {
  algorithm: AlgoId;
  name: string;
  path: string[];
  distance: number;
  hops: number;
  explored: number;
  comparisons: number;
  edgesRelaxed: number;
  execMs: number;
  complexity: string;
  space: string;
  settledOrder: string[];
}

export interface AlgoRun {
  stats: AlgoStats;
  steps: StepEvent[];
}

interface AdjItem {
  to: string;
  w: number;
  edgeId: number;
}
type Adj = Map<string, AdjItem[]>;

export function buildAdj(
  nodes: GNode[],
  edges: GEdge[],
  opts?: { ignoreBlocked?: boolean },
): Adj {
  const adj: Adj = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (e.blocked && !opts?.ignoreBlocked) continue;
    adj.get(e.a)?.push({ to: e.b, w: e.distance, edgeId: e.id });
    adj.get(e.b)?.push({ to: e.a, w: e.distance, edgeId: e.id });
  }
  return adj;
}

function name(of: Map<string, GNode>, id: string): string {
  return of.get(id)?.name ?? id;
}

const INF = Infinity;

// ── Dijkstra ─────────────────────────────────────────────────
export function dijkstra(
  nodes: GNode[],
  edges: GEdge[],
  source: string,
  target: string,
  trace = true,
  ignoreBlocked = false,
): AlgoRun {
  const t0 = performance.now();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = buildAdj(nodes, edges, { ignoreBlocked });
  const dist = new Map<string, number>(nodes.map((n) => [n.id, INF]));
  const prev = new Map<string, string>();
  const settled = new Set<string>();
  const settledOrder: string[] = [];
  const steps: StepEvent[] = [];
  let comparisons = 0;
  let edgesRelaxed = 0;

  dist.set(source, 0);
  const pq: [number, string][] = [[0, source]];
  if (trace)
    steps.push({
      op: "init",
      node: source,
      dist: 0,
      line: 1,
      note: `Initialize: dist[${name(byId, source)}] ← 0, dist[all others] ← ∞. Push source into the min-priority queue.`,
    });

  while (pq.length > 0) {
    let bi = 0;
    for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i;
    const [d, u] = pq.splice(bi, 1)[0];

    if (settled.has(u)) {
      if (trace)
        steps.push({
          op: "skip",
          node: u,
          dist: d,
          line: 4,
          note: `Extract ${name(byId, u)} (${fmtKm(d)} km) — already settled, stale queue entry discarded.`,
        });
      continue;
    }
    if (trace)
      steps.push({
        op: "dequeue",
        node: u,
        dist: d,
        line: 4,
        note: `Extract-min from PQ → ${name(byId, u)} with dist = ${fmtKm(d)} km (smallest tentative distance).`,
      });

    settled.add(u);
    settledOrder.push(u);
    if (trace)
      steps.push({
        op: "settle",
        node: u,
        dist: d,
        line: 5,
        note: `Settle ${name(byId, u)}. Its distance ${fmtKm(d)} km is now provably optimal — no shorter path can exist.`,
      });
    comparisons++;

    if (u === target) {
      if (trace)
        steps.push({
          op: "settle",
          node: u,
          dist: d,
          line: 5,
          note: `${name(byId, u)} is the destination — Dijkstra's invariant guarantees ${fmtKm(d)} km is the global optimum. Early exit.`,
        });
      break;
    }

    for (const { to, w } of adj.get(u) ?? []) {
      if (settled.has(to)) continue;
      const alt = d + w;
      if (trace)
        steps.push({
          op: "consider",
          from: u,
          to,
          dist: alt,
          line: 7,
          note: `Inspect edge ${name(byId, u)} → ${name(byId, to)}: ${fmtKm(d)} + ${fmtKm(w)} = ${fmtKm(alt)} km.`,
        });
      comparisons++;
      edgesRelaxed++;
      if (alt < dist.get(to)!) {
        dist.set(to, alt);
        prev.set(to, u);
        pq.push([alt, to]);
        if (trace)
          steps.push({
            op: "update",
            from: u,
            to,
            dist: alt,
            line: 9,
            note: `Relaxation succeeds: dist[${name(byId, to)}] ← ${fmtKm(alt)} km via ${name(byId, u)}. Push to PQ.`,
          });
      } else if (trace) {
        steps.push({
          op: "skip",
          from: u,
          to,
          dist: alt,
          line: 9,
          note: `No improvement: ${fmtKm(alt)} km ≥ current dist[${name(byId, to)}] = ${fmtKm(dist.get(to)!)} km. Edge rejected.`,
        });
      }
    }
  }

  const path = reconstructPath(prev, source, target);
  const finalDist = dist.get(target) ?? INF;
  if (trace) {
    steps.push({
      op: "path",
      path,
      dist: finalDist,
      line: 11,
      note:
        path.length > 0
          ? `Backtracking prev[] chain yields the optimal route: ${path.map((p) => name(byId, p)).join(" → ")} (${fmtKm(finalDist)} km).`
          : `Destination unreachable from source (no path exists).`,
    });
    steps.push({
      op: "done",
      line: 12,
      note: `Done. Settled ${settledOrder.length} of ${nodes.length} nodes; ${edgesRelaxed} edge relaxations examined.`,
    });
  }

  return {
    stats: {
      algorithm: "dijkstra",
      name: "Dijkstra",
      path,
      distance: finalDist,
      hops: Math.max(0, path.length - 1),
      explored: settledOrder.length,
      comparisons,
      edgesRelaxed,
      execMs: performance.now() - t0,
      complexity: "O((V + E) log V)",
      space: "O(V)",
      settledOrder,
    },
    steps,
  };
}

// ── A* search ────────────────────────────────────────────────
export function astar(
  nodes: GNode[],
  edges: GEdge[],
  source: string,
  target: string,
  trace = true,
): AlgoRun {
  const t0 = performance.now();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = buildAdj(nodes, edges);
  const goal = byId.get(target)!;
  const h = (id: string) => haversineKm(byId.get(id)!, goal);

  const g = new Map<string, number>(nodes.map((n) => [n.id, INF]));
  const prev = new Map<string, string>();
  const closed = new Set<string>();
  const settledOrder: string[] = [];
  const steps: StepEvent[] = [];
  let comparisons = 0;
  let edgesRelaxed = 0;

  g.set(source, 0);
  const open: [number, string][] = [[h(source), source]];
  if (trace)
    steps.push({
      op: "init",
      node: source,
      dist: 0,
      line: 1,
      note: `Initialize: g[${name(byId, source)}] ← 0, f ← h = ${fmtKm(h(source))} km (straight-line heuristic to ${name(byId, target)}).`,
    });

  let found = false;
  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [f, u] = open.splice(bi, 1)[0];
    if (closed.has(u)) continue;

    if (trace)
      steps.push({
        op: "dequeue",
        node: u,
        dist: g.get(u),
        line: 4,
        note: `Pick lowest f-score in OPEN → ${name(byId, u)} (f = ${fmtKm(f)} km = g ${fmtKm(g.get(u)!)} + h ${fmtKm(h(u))}).`,
      });

    if (u === target) {
      found = true;
      closed.add(u);
      settledOrder.push(u);
      if (trace)
        steps.push({
          op: "settle",
          node: u,
          dist: g.get(u),
          line: 5,
          note: `${name(byId, u)} IS the goal — because h is admissible (never overestimates), g = ${fmtKm(g.get(u)!)} km is optimal. Stop.`,
        });
      break;
    }

    closed.add(u);
    settledOrder.push(u);
    comparisons++;
    if (trace)
      steps.push({
        op: "settle",
        node: u,
        dist: g.get(u),
        line: 6,
        note: `Move ${name(byId, u)} to CLOSED. The heuristic steers the search toward ${name(byId, target)}.`,
      });

    for (const { to, w } of adj.get(u) ?? []) {
      if (closed.has(to)) continue;
      const tentative = g.get(u)! + w;
      if (trace)
        steps.push({
          op: "consider",
          from: u,
          to,
          dist: tentative,
          line: 7,
          note: `Edge ${name(byId, u)} → ${name(byId, to)}: tentative g = ${fmtKm(g.get(u)!)} + ${fmtKm(w)} = ${fmtKm(tentative)} km.`,
        });
      comparisons++;
      edgesRelaxed++;
      if (tentative < g.get(to)!) {
        g.set(to, tentative);
        prev.set(to, u);
        const fNew = tentative + h(to);
        open.push([fNew, to]);
        if (trace)
          steps.push({
            op: "update",
            from: u,
            to,
            dist: tentative,
            line: 9,
            note: `Improvement: g[${name(byId, to)}] ← ${fmtKm(tentative)} km, f ← ${fmtKm(fNew)} (h = ${fmtKm(h(to))}). Record parent, push to OPEN.`,
          });
      } else if (trace) {
        steps.push({
          op: "skip",
          from: u,
          to,
          dist: tentative,
          line: 9,
          note: `Rejected: tentative ${fmtKm(tentative)} km ≥ known g[${name(byId, to)}] = ${fmtKm(g.get(to)!)} km.`,
        });
      }
    }
  }

  const path = found ? reconstructPath(prev, source, target) : [];
  const finalDist = found ? g.get(target)! : INF;
  if (trace) {
    steps.push({
      op: "path",
      path,
      dist: finalDist,
      line: 12,
      note: found
        ? `Reconstructed guided path: ${path.map((p) => name(byId, p)).join(" → ")} (${fmtKm(finalDist)} km).`
        : `OPEN exhausted — goal unreachable.`,
    });
    steps.push({
      op: "done",
      line: 12,
      note: `Done. A* expanded ${settledOrder.length} nodes (heuristic focus) vs pure uniform-cost search.`,
    });
  }

  return {
    stats: {
      algorithm: "astar",
      name: "A* Search",
      path,
      distance: finalDist,
      hops: Math.max(0, path.length - 1),
      explored: settledOrder.length,
      comparisons,
      edgesRelaxed,
      execMs: performance.now() - t0,
      complexity: "O(E) worst · guided by h(n)",
      space: "O(V)",
      settledOrder,
    },
    steps,
  };
}

// ── Floyd–Warshall ───────────────────────────────────────────
export function floydWarshall(
  nodes: GNode[],
  edges: GEdge[],
  source: string,
  target: string,
  trace = true,
): AlgoRun {
  const t0 = performance.now();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ids = nodes.map((n) => n.id);
  const N = ids.length;
  const idx = new Map(ids.map((id, i) => [id, i]));

  const D: number[][] = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => (i === j ? 0 : INF)),
  );
  const nxt: (string | null)[][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => null as string | null),
  );
  for (const e of edges) {
    if (e.blocked) continue;
    const i = idx.get(e.a)!;
    const j = idx.get(e.b)!;
    if (e.distance < D[i][j]) {
      D[i][j] = e.distance;
      D[j][i] = e.distance;
      nxt[i][j] = e.b;
      nxt[j][i] = e.a;
    }
  }

  const steps: StepEvent[] = [];
  if (trace)
    steps.push({
      op: "init",
      line: 1,
      note: `Build ${N}×${N} distance matrix: 0 on diagonal, edge weights elsewhere, ∞ for non-adjacent pairs.`,
    });

  let comparisons = 0;
  let updates = 0;
  for (let k = 0; k < N; k++) {
    if (trace)
      steps.push({
        op: "fw-pivot",
        via: ids[k],
        line: 2,
        note: `Pivot round k = ${name(byId, ids[k])}: try routing every pair (i, j) through this intermediate node.`,
      });
    for (let i = 0; i < N; i++) {
      if (D[i][k] === INF) continue;
      for (let j = 0; j < N; j++) {
        if (D[k][j] === INF || i === j) continue;
        comparisons++;
        const through = D[i][k] + D[k][j];
        if (through < D[i][j] - 1e-9) {
          D[i][j] = through;
          nxt[i][j] = nxt[i][k];
          updates++;
          if (trace && steps.length < 2400)
            steps.push({
              op: "fw-update",
              from: ids[i],
              to: ids[j],
              via: ids[k],
              dist: through,
              line: 7,
              note: `D[${name(byId, ids[i])}][${name(byId, ids[j])}] improves to ${fmtKm(through)} km by going through ${name(byId, ids[k])}.`,
            });
        }
      }
    }
  }

  // reconstruct source → target path
  const path: string[] = [];
  const i0 = idx.get(source)!;
  const j0 = idx.get(target)!;
  if (nxt[i0][j0] !== null) {
    path.push(source);
    let cur = i0;
    let guard = 0;
    while (cur !== j0 && guard++ < N + 2) {
      const nx = nxt[cur][j0];
      if (nx === null) break;
      path.push(nx);
      cur = idx.get(nx)!;
    }
  }
  const finalDist = D[i0][j0];

  if (trace) {
    steps.push({
      op: "fw-done",
      line: 8,
      note: `All-pairs matrix complete after ${N} pivot rounds: ${comparisons.toLocaleString()} triple-comparisons, ${updates} improvements. The matrix now holds EVERY shortest path.`,
    });
    steps.push({
      op: "path",
      path,
      dist: finalDist,
      line: 9,
      note:
        path.length > 0
          ? `Lookup D[${name(byId, source)}][${name(byId, target)}] = ${fmtKm(finalDist)} km instantly; next[][] chain: ${path.map((p) => name(byId, p)).join(" → ")}.`
          : `D[${name(byId, source)}][${name(byId, target)}] = ∞ — unreachable.`,
    });
  }

  return {
    stats: {
      algorithm: "floyd",
      name: "Floyd–Warshall",
      path,
      distance: finalDist,
      hops: Math.max(0, path.length - 1),
      explored: N,
      comparisons,
      edgesRelaxed: updates,
      execMs: performance.now() - t0,
      complexity: "O(V³)",
      space: "O(V²)",
      settledOrder: ids.slice(),
    },
    steps,
  };
}

export function runAlgorithm(
  algo: AlgoId,
  nodes: GNode[],
  edges: GEdge[],
  source: string,
  target: string,
  trace = true,
  ignoreBlocked = false,
): AlgoRun {
  if (algo === "astar") return astar(nodes, edges, source, target, trace);
  if (algo === "floyd") return floydWarshall(nodes, edges, source, target, trace);
  return dijkstra(nodes, edges, source, target, trace, ignoreBlocked);
}

// median-of-N timing for honest, stable "actual execution time"
export function timedRun(
  algo: AlgoId,
  nodes: GNode[],
  edges: GEdge[],
  source: string,
  target: string,
  runs = 7,
  ignoreBlocked = false,
): AlgoStats {
  const times: number[] = [];
  let last: AlgoRun | null = null;
  for (let i = 0; i < runs; i++) {
    last = runAlgorithm(algo, nodes, edges, source, target, false, ignoreBlocked);
    times.push(last.stats.execMs);
  }
  times.sort((a, b) => a - b);
  last!.stats.execMs = times[Math.floor(times.length / 2)];
  return last!.stats;
}

function reconstructPath(
  prev: Map<string, string>,
  source: string,
  target: string,
): string[] {
  if (source === target) return [source];
  if (!prev.has(target)) return [];
  const path = [target];
  let cur = target;
  let guard = 0;
  while (cur !== source && guard++ < 500) {
    const p = prev.get(cur);
    if (!p) return [];
    path.unshift(p);
    cur = p;
  }
  return path;
}

// ── Yen's K-shortest simple paths (for alternative routes) ───
function dijkstraFast(
  adj: Adj,
  source: string,
  target: string,
  bannedNodes: Set<string>,
  bannedPairs: Set<string>,
): { path: string[]; distance: number } {
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  dist.set(source, 0);
  const pq: [number, string][] = [[0, source]];
  const done = new Set<string>();
  while (pq.length) {
    let bi = 0;
    for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i;
    const [d, u] = pq.splice(bi, 1)[0];
    if (done.has(u)) continue;
    done.add(u);
    if (u === target) break;
    for (const { to, w } of adj.get(u) ?? []) {
      if (bannedNodes.has(to) || done.has(to)) continue;
      if (bannedPairs.has(edgeKey(u, to))) continue;
      const alt = d + w;
      if (alt < (dist.get(to) ?? INF)) {
        dist.set(to, alt);
        prev.set(to, u);
        pq.push([alt, to]);
      }
    }
  }
  const path = reconstructPath(prev, source, target);
  return { path, distance: dist.get(target) ?? INF };
}

export function pathDistance(nodes: GNode[], edges: GEdge[], path: string[]): number {
  const adj = buildAdj(nodes, edges);
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const options = adj.get(path[i]) ?? [];
    const best = Math.min(...options.filter((o) => o.to === path[i + 1]).map((o) => o.w));
    if (!isFinite(best)) return INF;
    total += best;
  }
  return total;
}

export function yenKShortest(
  nodes: GNode[],
  edges: GEdge[],
  source: string,
  target: string,
  K = 3,
): { path: string[]; distance: number }[] {
  const adj = buildAdj(nodes, edges);
  const first = dijkstraFast(adj, source, target, new Set(), new Set());
  if (!first.path.length) return [];
  const A: { path: string[]; distance: number }[] = [first];
  const B: { path: string[]; distance: number }[] = [];

  for (let k = 1; k < K; k++) {
    const prevPath = A[k - 1].path;
    for (let i = 0; i < prevPath.length - 1; i++) {
      const spurNode = prevPath[i];
      const rootPath = prevPath.slice(0, i + 1);
      const bannedPairs = new Set<string>();
      for (const p of A) {
        if (
          p.path.length > i &&
          rootPath.every((n, j) => p.path[j] === n)
        ) {
          bannedPairs.add(edgeKey(p.path[i], p.path[i + 1]));
        }
      }
      const bannedNodes = new Set(rootPath.slice(0, -1));
      const spur = dijkstraFast(adj, spurNode, target, bannedNodes, bannedPairs);
      if (!spur.path.length) continue;
      const totalPath = [...rootPath.slice(0, -1), ...spur.path];
      const key = totalPath.join(">");
      if (
        !A.some((p) => p.path.join(">") === key) &&
        !B.some((p) => p.path.join(">") === key)
      ) {
        B.push({ path: totalPath, distance: pathDistance(nodes, edges, totalPath) });
      }
    }
    if (!B.length) break;
    B.sort((x, y) => x.distance - y.distance);
    A.push(B.shift()!);
  }
  return A;
}
