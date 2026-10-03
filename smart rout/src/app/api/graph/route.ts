import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { getGraph } from "@/lib/server-graph";
import { sql } from "drizzle-orm";
import { SEED_NODES, seedEdges } from "@/lib/graph";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const graph = await getGraph();
    return NextResponse.json({ ok: true, ...graph });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// POST { action: "reset" } → restore factory Hyderabad network
export async function POST(req: Request) {
  try {
    await ensureDb();
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "reset") {
      return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
    }
    await db.execute(sql`DELETE FROM graph_edges`);
    await db.execute(sql`DELETE FROM graph_nodes`);
    for (const n of SEED_NODES) {
      await db.execute(sql`
        INSERT INTO graph_nodes (id, name, lat, lng, custom)
        VALUES (${n.id}, ${n.name}, ${n.lat}, ${n.lng}, false)
      `);
    }
    for (const e of seedEdges()) {
      await db.execute(sql`
        INSERT INTO graph_edges (a, b, distance, blocked)
        VALUES (${e.a}, ${e.b}, ${e.distance}, false)
      `);
    }
    const graph = await getGraph();
    return NextResponse.json({ ok: true, ...graph });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
