import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { graphEdges, graphNodes } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { haversineKm } from "@/lib/graph";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST { a, b, distance? } → add edge (auto-distance from coordinates)
export async function POST(req: Request) {
  try {
    await ensureDb();
    const body = await req.json();
    const a = String(body?.a ?? "");
    const b = String(body?.b ?? "");
    if (!a || !b || a === b) {
      return NextResponse.json({ ok: false, error: "Two distinct nodes required" }, { status: 400 });
    }
    const nodes = await db.select().from(graphNodes);
    const na = nodes.find((n) => n.id === a);
    const nb = nodes.find((n) => n.id === b);
    if (!na || !nb) {
      return NextResponse.json({ ok: false, error: "Unknown node id" }, { status: 404 });
    }
    const existing = await db
      .select()
      .from(graphEdges)
      .where(
        or(
          and(eq(graphEdges.a, a), eq(graphEdges.b, b)),
          and(eq(graphEdges.a, b), eq(graphEdges.b, a)),
        ),
      );
    if (existing.length > 0) {
      return NextResponse.json({ ok: false, error: "These locations are already connected" }, { status: 409 });
    }
    const distance =
      Number(body?.distance) > 0
        ? Number(body.distance)
        : Math.round(haversineKm(na, nb) * 1.28 * 10) / 10;
    const inserted = await db
      .insert(graphEdges)
      .values({ a, b, distance, blocked: false })
      .returning();
    return NextResponse.json({ ok: true, edge: inserted[0] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// PATCH { id, blocked } → toggle road block (What-If analysis)
export async function PATCH(req: Request) {
  try {
    await ensureDb();
    const body = await req.json();
    const id = Number(body?.id);
    if (!isFinite(id)) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    const updated = await db
      .update(graphEdges)
      .set({ blocked: Boolean(body?.blocked) })
      .where(eq(graphEdges.id, id))
      .returning();
    if (!updated.length) return NextResponse.json({ ok: false, error: "Edge not found" }, { status: 404 });
    return NextResponse.json({ ok: true, edge: updated[0] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// DELETE ?id=... → remove edge
export async function DELETE(req: Request) {
  try {
    await ensureDb();
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!isFinite(id)) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    await db.delete(graphEdges).where(eq(graphEdges.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
