import { NextResponse } from "next/server";
import { ensureDb } from "@/db/bootstrap";
import { getGraph } from "@/lib/server-graph";
import { timedRun } from "@/lib/algorithms";
import type { AlgoId } from "@/lib/algorithms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST { source, target } → benchmark all three algorithms on the live graph
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
    if (!byId.has(source) || !byId.has(target)) {
      return NextResponse.json({ ok: false, error: "Unknown location" }, { status: 404 });
    }

    const algos: AlgoId[] = ["dijkstra", "astar", "floyd"];
    const results = algos.map((algo) => timedRun(algo, nodes, edges, source, target, algo === "floyd" ? 3 : 9));
    const n = (id: string) => byId.get(id)?.name ?? id;

    const distances = results.map((r) => r.distance).filter((d) => isFinite(d));
    const consensus =
      distances.length === results.length &&
      Math.max(...distances) - Math.min(...distances) < 0.051;

    return NextResponse.json({
      ok: true,
      source,
      target,
      sourceName: n(source),
      targetName: n(target),
      results: results.map((r) => ({ ...r, pathNames: r.path.map(n) })),
      consensus,
      graph: { nodes: nodes.length, edges: edges.length, blocked: edges.filter((e) => e.blocked).length },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
