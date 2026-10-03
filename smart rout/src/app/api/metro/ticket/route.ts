import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { metroTickets } from "@/db/schema";
import { planJourney } from "@/lib/metro";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function makePnr(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `HMR-${code}`;
}

async function qrFor(payload: object): Promise<string> {
  return QRCode.toDataURL(JSON.stringify(payload), {
    margin: 1,
    width: 240,
    color: { dark: "#082f3f", light: "#e8fbff" },
  });
}

// POST { from, to, passenger, phone?, quantity? } → buy ticket (demo gateway)
export async function POST(req: Request) {
  try {
    await ensureDb();
    const body = await req.json();
    const from = String(body?.from ?? "");
    const to = String(body?.to ?? "");
    const passenger = String(body?.passenger ?? "").trim();
    const phone = String(body?.phone ?? "").trim() || null;
    const quantity = Math.min(6, Math.max(1, Number(body?.quantity) || 1));

    if (!passenger || passenger.length < 2) {
      return NextResponse.json({ ok: false, error: "Passenger name is required" }, { status: 400 });
    }
    if (!from || !to || from === to) {
      return NextResponse.json({ ok: false, error: "Choose two different stations" }, { status: 400 });
    }
    const plan = planJourney(from, to);
    if (!plan) {
      return NextResponse.json({ ok: false, error: "No metro connection between these stations" }, { status: 404 });
    }

    const pnr = makePnr();
    const totalFare = plan.fareEach * quantity;
    const inserted = await db
      .insert(metroTickets)
      .values({
        pnr,
        passenger,
        phone,
        fromId: from,
        fromName: plan.stationNames[0],
        toId: to,
        toName: plan.stationNames[plan.stationNames.length - 1],
        segments: JSON.stringify(
          plan.segments.map((s) => ({
            line: s.line,
            lineName: s.lineName,
            color: s.color,
            fromName: s.fromName,
            toName: s.toName,
            stations: s.stationNames.length - 1,
          })),
        ),
        transfers: plan.transfers,
        stops: plan.stops,
        distanceKm: plan.distanceKm,
        minutes: plan.minutes,
        fareEach: plan.fareEach,
        quantity,
        totalFare,
        status: "active",
      })
      .returning();

    const ticket = inserted[0];
    const qr = await qrFor({
      pnr: ticket.pnr,
      passenger: ticket.passenger,
      from: ticket.fromName,
      to: ticket.toName,
      qty: ticket.quantity,
      fare: ticket.totalFare,
      ts: ticket.createdAt,
    });
    return NextResponse.json({ ok: true, ticket, qr });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// GET → recent tickets with QR codes for gate display
export async function GET() {
  try {
    await ensureDb();
    const rows = await db.select().from(metroTickets).orderBy(desc(metroTickets.id)).limit(12);
    const tickets = await Promise.all(
      rows.map(async (t) => ({
        ...t,
        qr: await qrFor({ pnr: t.pnr, from: t.fromName, to: t.toName, qty: t.quantity, fare: t.totalFare }),
      })),
    );
    return NextResponse.json({ ok: true, tickets });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// DELETE ?pnr=... → cancel (refund demo)
export async function DELETE(req: Request) {
  try {
    await ensureDb();
    const pnr = new URL(req.url).searchParams.get("pnr");
    if (!pnr) return NextResponse.json({ ok: false, error: "pnr required" }, { status: 400 });
    const updated = await db
      .update(metroTickets)
      .set({ status: "cancelled" })
      .where(eq(metroTickets.pnr, pnr))
      .returning();
    if (!updated.length) return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
    return NextResponse.json({ ok: true, ticket: updated[0] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
