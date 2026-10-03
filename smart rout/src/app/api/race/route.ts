import { NextResponse } from "next/server";
import { ensureDb } from "@/db/bootstrap";
import { getGraph } from "@/lib/server-graph";
import { runAlgorithm, timedRun } from "@/lib/algorithms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST { source, target } → synchronized Dijkstra vs A* traces + honest timings
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

    const dRun = runAlgorithm("dijkstra", nodes, edges, source, target, true);
    const aRun = runAlgorithm("astar", nodes, edges, source, target, true);
    dRun.stats.execMs = timedRun("dijkstra", nodes, edges, source, target, 9).execMs;
    aRun.stats.execMs = timedRun("astar", nodes, edges, source, target, 9).execMs;

    // winner scoring: explored nodes first (search effort), exec time as tiebreak
    let winner: "dijkstra" | "astar" | "tie" = "tie";
    if (aRun.stats.explored < dRun.stats.explored) winner = "astar";
    else if (dRun.stats.explored < aRun.stats.explored) winner = "dijkstra";
    else if (aRun.stats.execMs < dRun.stats.execMs) winner = "astar";
    else if (dRun.stats.execMs < aRun.stats.execMs) winner = "dijkstra";

    return NextResponse.json({
      ok: true,
      source,
      target,
      graph: { nodes, edges },
      dijkstra: { stats: dRun.stats, steps: dRun.steps },
      astar: { stats: aRun.stats, steps: aRun.steps },
      winner,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
