import { NextResponse } from "next/server";
import { ensureDb } from "@/db/bootstrap";
import { getGraph } from "@/lib/server-graph";
import { runAlgorithm, timedRun } from "@/lib/algorithms";
import type { AlgoId } from "@/lib/algorithms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST { algorithm, source, target } → full step trace for the visualizer
export async function POST(req: Request) {
  try {
    await ensureDb();
    const body = await req.json();
    const source = String(body?.source ?? "");
    const target = String(body?.target ?? "");
    const algorithm = String(body?.algorithm ?? "dijkstra") as AlgoId;
    if (!["dijkstra", "astar", "floyd"].includes(algorithm)) {
      return NextResponse.json({ ok: false, error: "Unknown algorithm" }, { status: 400 });
    }
    if (!source || !target || source === target) {
      return NextResponse.json({ ok: false, error: "Choose two distinct locations" }, { status: 400 });
    }
    const { nodes, edges } = await getGraph();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    if (!byId.has(source) || !byId.has(target)) {
      return NextResponse.json({ ok: false, error: "Unknown location" }, { status: 404 });
    }
    const run = runAlgorithm(algorithm, nodes, edges, source, target, true);
    // honest pure-compute timing measured without trace recording
    run.stats.execMs = timedRun(algorithm, nodes, edges, source, target, algorithm === "floyd" ? 3 : 9).execMs;
    return NextResponse.json({
      ok: true,
      algorithm,
      source,
      target,
      stats: run.stats,
      steps: run.steps,
      graph: { nodes, edges },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
