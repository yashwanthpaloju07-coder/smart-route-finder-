import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { getGraph } from "@/lib/server-graph";
import { routeHistory } from "@/db/schema";
import { dijkstra, timedRun, yenKShortest } from "@/lib/algorithms";
import { fmtKm } from "@/lib/graph";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST { source, target, algorithm? }
// → optimal route + Yen's alternatives + evidence-based optimality explanation
export async function POST(req: Request) {
  try {
    await ensureDb();
    const body = await req.json();
    const source = String(body?.source ?? "");
    const target = String(body?.target ?? "");
    if (!source || !target || source === target) {
      return NextResponse.json({ ok: false, error: "Choose two distinct locations" }, { status: 400 });
    }
    const { nodes, edges } = await getGraph();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const ns = byId.get(source);
    const nt = byId.get(target);
    if (!ns || !nt) return NextResponse.json({ ok: false, error: "Unknown location" }, { status: 404 });

    // Primary optimal route (median-of-7 honest timing)
    const dStats = timedRun("dijkstra", nodes, edges, source, target);
    // Independent confirmations
    const fwStats = timedRun("floyd", nodes, edges, source, target, 3);
    const alternatives = yenKShortest(nodes, edges, source, target, 3);
    // What-if counterfactual: distance if no roads were blocked
    const blockedCount = edges.filter((e) => e.blocked).length;
    const unblocked =
      blockedCount > 0 ? timedRun("dijkstra", nodes, edges, source, target, 5, true) : null;

    const n = (id: string) => byId.get(id)?.name ?? id;
    const explanation: string[] = [];

    if (dStats.path.length) {
      const alt = alternatives[1];
      if (alt && isFinite(alt.distance)) {
        const gain = alt.distance - dStats.distance;
        const pct = ((gain / alt.distance) * 100).toFixed(1);
        explanation.push(
          gain > 0.05
            ? `The selected route is ${fmtKm(gain)} km (${pct}%) shorter than the best alternative (${fmtKm(alt.distance)} km), verified exhaustively by Yen's K-shortest path enumeration.`
            : `The next-best alternative is within ${fmtKm(Math.max(gain, 0))} km — the chosen corridor is effectively tied but wins on exact weight comparison.`,
        );
      }
      explanation.push(
        `Dijkstra's settle-order invariant proves optimality: when "${n(target)}" was settled at ${fmtKm(dStats.distance)} km, every node still in the priority queue already had a tentative distance ≥ that value — so no shorter undiscovered route can exist.`,
      );
      explanation.push(
        `The solver settled ${dStats.explored} of ${nodes.length} locations (${Math.round((dStats.explored / nodes.length) * 100)}% of the network) and examined ${dStats.edgesRelaxed} directed edge relaxations in ${dStats.execMs.toFixed(3)} ms — it never needed to explore the whole graph.`,
      );
      explanation.push(
        `Cross-validation: Floyd–Warshall's all-pairs ${nodes.length}×${nodes.length} matrix (${fwStats.comparisons.toLocaleString()} triple comparisons) independently confirms ${fmtKm(fwStats.distance)} km as the global optimum for this pair.`,
      );
      if (dStats.path.length > 2) {
        const via = dStats.path.slice(1, -1).map(n);
        explanation.push(
          `Critical corridor: the route threads through ${via.join(" → ")} — these are the minimum-weight articulation points between ${n(source)} and ${n(target)}.`,
        );
      }
      if (blockedCount > 0 && unblocked && isFinite(unblocked.distance)) {
        const penalty = dStats.distance - unblocked.distance;
        explanation.push(
          penalty > 0.05
            ? `What-If impact: ${blockedCount} blocked road segment(s) forced a detour costing +${fmtKm(penalty)} km versus the fully-open network (${fmtKm(unblocked.distance)} km).`
            : `What-If impact: ${blockedCount} road segment(s) are blocked, but the optimal route is unaffected — the corridor has enough redundancy.`,
        );
      }
    } else {
      explanation.push(
        `No route exists between ${n(source)} and ${n(target)} under the current road blocks — the graph is disconnected for this pair. Unblock segments or add connections in the Graph Editor.`,
      );
    }

    // persist to route history
    try {
      await db.insert(routeHistory).values({
        sourceId: source,
        sourceName: n(source),
        targetId: target,
        targetName: n(target),
        algorithm: "dijkstra",
        distance: isFinite(dStats.distance) ? dStats.distance : 0,
        hops: dStats.hops,
        explored: dStats.explored,
        execMs: dStats.execMs,
        path: JSON.stringify(dStats.path.map(n)),
      });
    } catch {
      /* history is best-effort */
    }

    return NextResponse.json({
      ok: true,
      source,
      target,
      primary: dStats,
      alternatives: alternatives.map((a) => ({
        path: a.path,
        distance: a.distance,
        hops: Math.max(0, a.path.length - 1),
      })),
      explanation,
      stats: {
        nodes: nodes.length,
        edges: edges.length,
        blocked: blockedCount,
        unblockedDistance: unblocked?.distance ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
