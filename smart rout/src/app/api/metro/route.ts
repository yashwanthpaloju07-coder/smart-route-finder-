import { NextResponse } from "next/server";
import { METRO_LINES, METRO_STATIONS } from "@/lib/metro";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    stations: METRO_STATIONS,
    lines: METRO_LINES,
    stats: {
      stations: METRO_STATIONS.length,
      lines: METRO_LINES.length,
      interchanges: METRO_STATIONS.filter((s) => s.lines.length > 1).length,
    },
  });
}
