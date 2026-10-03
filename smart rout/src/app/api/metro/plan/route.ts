import { NextResponse } from "next/server";
import { planJourney } from "@/lib/metro";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST { from, to } → Dijkstra-shortest metro journey with line segmentation
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const from = String(body?.from ?? "");
    const to = String(body?.to ?? "");
    if (!from || !to || from === to) {
      return NextResponse.json({ ok: false, error: "Choose two different stations" }, { status: 400 });
    }
    const plan = planJourney(from, to);
    if (!plan) {
      return NextResponse.json({ ok: false, error: "No metro connection between these stations" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
