import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-side proxy for OpenStreetMap Nominatim geocoding (policy-compliant
// User-Agent) so the UI can search any place on Earth.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ ok: true, results: [] });
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=en&dedupe=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "SmartRouteFinder-DAA/1.0 (route-optimization demo)",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "Geocoder unavailable" }, { status: 502 });
    }
    const data = (await res.json()) as {
      osm_type: string;
      osm_id: number;
      display_name: string;
      name?: string;
      lat: string;
      lon: string;
      type?: string;
      class?: string;
    }[];
    const results = data.map((d) => ({
      id: `${d.osm_type}-${d.osm_id}`,
      name: d.name || d.display_name.split(",")[0],
      detail: d.display_name,
      lat: Number(d.lat),
      lng: Number(d.lon),
      type: d.type || d.class || "place",
    }));
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
