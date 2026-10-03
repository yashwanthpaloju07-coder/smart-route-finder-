import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { graphNodes, graphEdges } from "@/db/schema";
import { eq, or } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST { name, lat, lng } → add node
export async function POST(req: Request) {
  try {
    await ensureDb();
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!name || !isFinite(lat) || !isFinite(lng)) {
      return NextResponse.json({ ok: false, error: "name, lat and lng are required" }, { status: 400 });
    }
    const id =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 32) || "node";
    const finalId = `${id}-${Math.random().toString(36).slice(2, 7)}`;
    await db.insert(graphNodes).values({ id: finalId, name, lat, lng, custom: true });
    return NextResponse.json({ ok: true, node: { id: finalId, name, lat, lng, custom: true } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// DELETE ?id=... → remove node + incident edges
export async function DELETE(req: Request) {
  try {
    await ensureDb();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    await db.delete(graphEdges).where(or(eq(graphEdges.a, id), eq(graphEdges.b, id)));
    await db.delete(graphNodes).where(eq(graphNodes.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
