"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import MapView from "@/components/MapView";
import type { MetroStation, MetroLine, MetroPlan } from "@/lib/metro";
import {
  TramFront,
  ArrowLeftRight,
  Loader2,
  Ticket,
  User,
  Phone,
  Minus,
  Plus,
  CreditCard,
  CheckCircle2,
  Printer,
  RefreshCcw,
  MapPin,
  Clock3,
  MoveRight,
  XCircle,
  Wallet,
  ChevronRight,
  TrainTrack,
} from "lucide-react";

interface TicketData {
  id: number;
  pnr: string;
  passenger: string;
  phone: string | null;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  segments: { line: string; lineName: string; color: string; fromName: string; toName: string; stations: number }[];
  transfers: number;
  stops: number;
  distanceKm: number;
  minutes: number;
  fareEach: number;
  quantity: number;
  totalFare: number;
  status: string;
  createdAt: string;
  qr?: string;
}

const LINE_BADGE: Record<string, string> = {
  red: "bg-red-500/20 text-red-300 border-red-400/40",
  blue: "bg-blue-500/20 text-blue-300 border-blue-400/40",
  green: "bg-green-500/20 text-green-300 border-green-400/40",
};

export default function MetroPage() {
  const [stations, setStations] = useState<MetroStation[]>([]);
  const [lines, setLines] = useState<MetroLine[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pickTarget, setPickTarget] = useState<"from" | "to">("from");
  const [plan, setPlan] = useState<MetroPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [passenger, setPassenger] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [payStage, setPayStage] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const stationName = useCallback((id: string) => stations.find((s) => s.id === id)?.name ?? "—", [stations]);

  const loadTickets = useCallback(async () => {
    const res = await fetch("/api/metro/ticket");
    const d = await res.json();
    if (d.ok) setTickets(d.tickets);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/metro");
      const d = await res.json();
      if (d.ok) {
        setStations(d.stations);
        setLines(d.lines);
      }
      void loadTickets();
    })();
  }, [loadTickets]);

  // auto-plan when both stations are chosen
  useEffect(() => {
    if (!from || !to || from === to) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setPlanLoading(true);
      try {
        const res = await fetch("/api/metro/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from, to }),
        });
        const d = await res.json();
        if (!cancelled && d.ok) setPlan(d.plan);
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const onStationClick = (id: string) => {
    if (pickTarget === "from") {
      if (id === to) {
        say("Origin and destination must differ.");
        return;
      }
      setFrom(id);
      setPickTarget("to");
      setTicket(null);
    } else {
      if (id === from) {
        say("Origin and destination must differ.");
        return;
      }
      setTo(id);
      setPickTarget("from");
      setTicket(null);
    }
  };

  const swap = () => {
    const f = from;
    setFrom(to);
    setTo(f);
    setTicket(null);
  };

  const total = (plan?.fareEach ?? 0) * quantity;

  const buy = async () => {
    if (!plan) {
      say("Plan a journey first.");
      return;
    }
    if (passenger.trim().length < 2) {
      say("Enter the passenger name.");
      return;
    }
    // simulated payment gateway staging (demo)
    setPayStage("Contacting payment gateway…");
    await new Promise((r) => setTimeout(r, 700));
    setPayStage(`Authorizing ₹${total} payment…`);
    await new Promise((r) => setTimeout(r, 800));
    setPayStage("Payment success · generating QR ticket…");
    try {
      const res = await fetch("/api/metro/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, passenger: passenger.trim(), phone: phone.trim(), quantity }),
      });
      const d = await res.json();
      if (d.ok) {
        setTicket({ ...d.ticket, qr: d.qr });
        say(`Ticket confirmed — PNR ${d.ticket.pnr}`);
        void loadTickets();
        setTimeout(() => ticketRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
      } else {
        say(d.error ?? "Booking failed");
      }
    } catch {
      say("Booking failed — network error.");
    } finally {
      setPayStage(null);
    }
  };

  const cancelTicket = async (pnr: string) => {
    if (!window.confirm(`Cancel ticket ${pnr}? Fare will be refunded (demo).`)) return;
    await fetch(`/api/metro/ticket?pnr=${encodeURIComponent(pnr)}`, { method: "DELETE" });
    if (ticket?.pnr === pnr) setTicket(null);
    say(`Ticket ${pnr} cancelled & refunded.`);
    void loadTickets();
  };

  const journeyHighlight = useMemo(() => {
    if (plan) return plan.path;
    if (from) return [from];
    return null;
  }, [plan, from]);

  const fitCoords = useMemo(
    () => stations.map((s) => [s.lat, s.lng] as [number, number]),
    [stations],
  );

  const selectOptions = (
    <>
      <option value="">Select station…</option>
      {lines.map((line) => (
        <optgroup key={line.id} label={`${line.name}`}>
          {line.stationIds.map((id) => {
            const s = stations.find((st) => st.id === id);
            if (!s) return null;
            return (
              <option key={id} value={id}>
                {s.name}
                {s.lines.length > 1 ? " ⇄" : ""}
              </option>
            );
          })}
        </optgroup>
      ))}
    </>
  );

  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-[1500px] px-3 pb-10 pt-24 sm:px-6">
        {/* header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              <TramFront className="h-7 w-7 text-red-400" />
              Hyderabad <span className="neon-text">Metro Tickets</span>
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-400">
              58 stations · 3 lines · Dijkstra-planned journeys · instant QR e-tickets
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lines.map((l) => (
              <span key={l.id} className="chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: l.color }}>
                <span className="h-1.5 w-4 rounded-full" style={{ background: l.color }} />
                {l.name}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* ── MAP ── */}
          <div className="glass relative h-[480px] overflow-hidden p-0 sm:h-[560px]">
            {stations.length > 0 ? (
              <MapView
                className="h-full w-full rounded-[18px]"
                nodes={[]}
                edges={[]}
                metroStations={stations}
                metroLines={lines}
                showMetro
                metroJourney={journeyHighlight}
                onMetroStationClick={onStationClick}
                fitBoundsCoords={fitCoords}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              </div>
            )}
            {/* pick banner */}
            <div className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-[#050a14]/90 px-3.5 py-2.5 backdrop-blur-md">
              <MapPin className="h-4 w-4 text-cyan-300" />
              <span className="text-[11.5px] font-bold text-slate-200">
                {pickTarget === "from" ? "Click a station to set ORIGIN" : "Click a station to set DESTINATION"}
              </span>
            </div>
            {/* legend */}
            <div className="absolute bottom-3 left-3 z-[500] rounded-xl border border-cyan-400/15 bg-[#050a14]/85 px-3.5 py-2.5 backdrop-blur-md">
              <div className="flex flex-col gap-1.5 text-[10.5px] font-semibold text-slate-300">
                {lines.map((l) => (
                  <span key={l.id} className="flex items-center gap-2">
                    <span className="h-1.5 w-6 rounded-full" style={{ background: l.color }} /> {l.name}
                  </span>
                ))}
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-white bg-[#0b1322]" /> Interchange
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-6 rounded-full bg-amber-400" /> Your journey
                </span>
              </div>
            </div>
          </div>

          {/* ── BOOKING PANEL ── */}
          <aside className="flex flex-col gap-4">
            {/* journey planner */}
            <section className="glass p-5">
              <h2 className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-300">
                Journey Planner
              </h2>
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => setPickTarget("from")}
                  className={`shrink-0 rounded-lg p-2 ${pickTarget === "from" ? "bg-emerald-400/20 text-emerald-300" : "bg-white/5 text-slate-500"}`}
                  title="Pick origin on map"
                >
                  <MapPin className="h-4 w-4" />
                </button>
                <select
                  className="srf w-full rounded-xl border border-cyan-400/20 bg-[#0a1120] px-3 py-2.5 text-[12.5px] font-semibold text-slate-100 outline-none focus:border-emerald-400/60"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setTicket(null);
                  }}
                >
                  {selectOptions}
                </select>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => setPickTarget("to")}
                  className={`shrink-0 rounded-lg p-2 ${pickTarget === "to" ? "bg-rose-400/20 text-rose-300" : "bg-white/5 text-slate-500"}`}
                  title="Pick destination on map"
                >
                  <MapPin className="h-4 w-4" />
                </button>
                <select
                  className="srf w-full rounded-xl border border-cyan-400/20 bg-[#0a1120] px-3 py-2.5 text-[12.5px] font-semibold text-slate-100 outline-none focus:border-rose-400/60"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setTicket(null);
                  }}
                >
                  {selectOptions}
                </select>
              </div>
              <button onClick={swap} disabled={!from && !to} className="btn-ghost flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11.5px] font-bold text-cyan-100">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Swap stations
              </button>

              {/* plan summary */}
              {planLoading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-[12px] font-semibold text-cyan-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> Dijkstra is planning your journey…
                </div>
              )}
              {plan && !planLoading && (
                <div className="anim-fade-up mt-4 flex flex-col gap-3">
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {[
                      { k: `${plan.distanceKm} km`, v: "distance" },
                      { k: `${plan.stops}`, v: "stops" },
                      { k: `~${plan.minutes} min`, v: "duration" },
                      { k: `₹${plan.fareEach}`, v: "fare / person" },
                    ].map((c) => (
                      <div key={c.v} className="rounded-lg border border-cyan-400/10 bg-[#080f1e] px-1 py-2">
                        <div className="mono text-[12px] font-extrabold text-cyan-100">{c.k}</div>
                        <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{c.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {plan.segments.map((seg, i) => (
                      <div key={i} className="rounded-xl border border-white/10 bg-[#080f1e] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${LINE_BADGE[seg.line]}`}>
                            {seg.lineName}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{seg.stationNames.length - 1} stops</span>
                        </div>
                        <p className="mt-1 text-[11.5px] font-semibold text-slate-200">
                          {seg.fromName} <MoveRight className="inline h-3 w-3 text-slate-500" /> {seg.toName}
                        </p>
                      </div>
                    ))}
                    {plan.transferAt.length > 0 && (
                      <p className="text-[11px] font-semibold text-amber-300">
                        <TrainTrack className="mr-1 inline h-3.5 w-3.5" />
                        Change train at {plan.transferAt.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* booking */}
            <section className="glass p-5">
              <h2 className="mb-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-cyan-300">
                <Ticket className="h-4 w-4" /> Book Ticket
              </h2>
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-[#0a1120] px-3 py-2.5 focus-within:border-cyan-400/60">
                <User className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  value={passenger}
                  onChange={(e) => setPassenger(e.target.value)}
                  placeholder="Passenger name"
                  className="w-full bg-transparent text-[13px] font-semibold text-slate-100 outline-none placeholder:text-slate-600"
                />
              </div>
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-[#0a1120] px-3 py-2.5 focus-within:border-cyan-400/60">
                <Phone className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9+ -]/g, "").slice(0, 13))}
                  placeholder="Mobile number (optional)"
                  className="w-full bg-transparent text-[13px] font-semibold text-slate-100 outline-none placeholder:text-slate-600"
                />
              </div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Tickets</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="btn-ghost rounded-lg p-1.5 text-cyan-200"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="mono w-6 text-center text-lg font-extrabold text-white">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(6, q + 1))}
                    className="btn-ghost rounded-lg p-1.5 text-cyan-200"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mb-4 flex items-center justify-between rounded-xl border border-cyan-400/15 bg-[#080f1e] px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Total fare</span>
                <span className="mono text-2xl font-black text-white">
                  ₹{total}
                  <span className="ml-1 text-[11px] font-bold text-slate-500">
                    {quantity > 1 ? `(${quantity} × ₹${plan?.fareEach ?? 0})` : ""}
                  </span>
                </span>
              </div>
              <button
                onClick={() => void buy()}
                disabled={!plan || planLoading || !!payStage}
                className="btn-neon flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[13px] font-extrabold uppercase tracking-wider text-white"
              >
                {payStage ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {payStage ? payStage : `Pay ₹${total} · Get QR Ticket`}
              </button>
              <p className="mt-2 text-center text-[10px] text-slate-600">
                Demo payment gateway — no real money is charged. Ticket is stored in the database.
              </p>
            </section>
          </aside>
        </div>

        {/* ── E-TICKET ── */}
        {ticket && (
          <section ref={ticketRef} className="mt-6">
            <div className="anim-fade-up mx-auto max-w-3xl">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-extrabold text-white">
                  Booking Confirmed — <span className="mono neon-text">{ticket.pnr}</span>
                </h2>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="btn-ghost flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11.5px] font-bold text-cyan-100"
                  >
                    <Printer className="h-4 w-4" /> Print
                  </button>
                  <button
                    onClick={() => setTicket(null)}
                    className="btn-ghost flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11.5px] font-bold text-cyan-100"
                  >
                    <RefreshCcw className="h-4 w-4" /> New Booking
                  </button>
                </div>
              </div>
              <TicketCard ticket={ticket} />
            </div>
          </section>
        )}

        {/* ── WALLET ── */}
        <section className="mt-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-white">
            <Wallet className="h-5 w-5 text-cyan-300" /> My Tickets
            <span className="chip rounded-full px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">{tickets.length}</span>
          </h2>
          {tickets.length === 0 ? (
            <div className="glass p-8 text-center text-[13px] text-slate-500">
              No tickets yet — plan a journey above and tap “Pay” to issue your first QR e-ticket.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tickets.map((t) => (
                <div key={t.id} className={`glass glass-hover relative overflow-hidden p-4 ${t.status !== "active" ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="mono rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[10px] font-black text-cyan-300">
                      {t.pnr}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${
                        t.status === "active"
                          ? "border border-emerald-400/50 bg-emerald-400/15 text-emerald-300"
                          : "border border-rose-400/50 bg-rose-400/15 text-rose-300"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-[14px] font-extrabold text-white">
                    {t.fromName}
                    <ChevronRight className="h-4 w-4 text-cyan-400" />
                    {t.toName}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-semibold text-slate-400">
                    <span>{t.passenger}</span>
                    <span>×{t.quantity}</span>
                    <span className="mono text-cyan-300">₹{t.totalFare}</span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      {new Date(t.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        setTicket(t);
                        setTimeout(() => ticketRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
                      }}
                      className="btn-neon flex-1 rounded-lg px-3 py-2 text-[10.5px] font-extrabold uppercase tracking-wider text-white"
                    >
                      View Ticket
                    </button>
                    {t.status === "active" && (
                      <button
                        onClick={() => void cancelTicket(t.pnr)}
                        className="btn-ghost flex items-center gap-1 rounded-lg px-3 py-2 text-[10.5px] font-bold text-rose-200"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div className="anim-fade-up fixed bottom-5 left-1/2 z-[1000] -translate-x-1/2 rounded-xl border border-cyan-400/40 bg-[#050a14]/95 px-5 py-3 text-[12.5px] font-semibold text-cyan-100 shadow-[0_0_30px_-6px_rgba(34,211,238,0.5)] backdrop-blur-md">
          {toast}
        </div>
      )}
    </main>
  );
}

// ── boarding-pass style e-ticket ─────────────────────────────
function TicketCard({ ticket }: { ticket: TicketData }) {
  const segments = Array.isArray(ticket.segments) ? ticket.segments : JSON.parse(String(ticket.segments));
  const date = new Date(ticket.createdAt);
  return (
    <div
      id="ticket-print"
      className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#0a1526] via-[#081120] to-[#04121c] shadow-[0_25px_70px_-20px_rgba(34,211,238,0.35)]"
    >
      <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="flex flex-col sm:flex-row">
        {/* main body */}
        <div className="flex-1 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-[0_0_18px_rgba(239,68,68,0.5)]">
              <TramFront className="h-6 w-6 text-white" />
            </span>
            <div>
              <div className="text-[11px] font-extrabold tracking-[0.22em] text-white">
                HYDERABAD METRO RAIL
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-cyan-300/70">
                E-Ticket · Smart Route Finder
              </div>
            </div>
            <span className={`ml-auto rounded-full px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest ${ticket.status === "active" ? "border border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border border-rose-400/50 bg-rose-400/15 text-rose-300"}`}>
              {ticket.status}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">From</div>
              <div className="truncate text-xl font-black text-white">{ticket.fromName}</div>
            </div>
            <div className="mx-1 flex flex-1 items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="h-px flex-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-rose-400" />
              <TramFront className="h-4 w-4 shrink-0 text-cyan-300" />
              <span className="h-px flex-1 bg-gradient-to-r from-rose-400 to-rose-400/30" />
              <span className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185]" />
            </div>
            <div className="min-w-0 text-right">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">To</div>
              <div className="truncate text-xl font-black text-white">{ticket.toName}</div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {segments.map((s: TicketData["segments"][number], i: number) => (
              <span key={i} className={`rounded-md border px-2 py-1 text-[9px] font-extrabold uppercase tracking-widest ${LINE_BADGE[s.line]}`}>
                {s.lineName} · {s.fromName} → {s.toName} ({s.stations} stops)
              </span>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-dashed border-cyan-400/20 pt-4 sm:grid-cols-6">
            {[
              { k: "PNR", v: ticket.pnr, mono: true },
              { k: "Passenger", v: ticket.passenger },
              { k: "Tickets", v: `×${ticket.quantity}` },
              { k: "Date", v: date.toLocaleDateString() },
              { k: "Valid", v: "Same day" },
              { k: "Fare", v: `₹${ticket.totalFare}`, mono: true, gold: true },
            ].map(({ k, v, mono, gold }) => (
              <div key={k}>
                <div className="text-[8.5px] font-bold uppercase tracking-widest text-slate-500">{k}</div>
                <div className={`mt-0.5 truncate text-[13px] font-extrabold ${mono ? "mono" : ""} ${gold ? "text-amber-300" : "text-slate-100"}`}>
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* perforation + stub */}
        <div className="relative border-t-2 border-dashed border-cyan-400/25 sm:border-l-2 sm:border-t-0">
          <span className="absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-[#05070f] sm:-left-3 sm:top-8 sm:translate-x-0" />
          <span className="absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-[#05070f] sm:-left-3 sm:bottom-8 sm:top-auto sm:translate-x-0" />
          <div className="flex h-full flex-col items-center justify-center gap-2 p-5 sm:w-44">
            {ticket.qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ticket.qr}
                alt={`QR code for ticket ${ticket.pnr}`}
                className="h-32 w-32 rounded-xl border-2 border-cyan-300/40 shadow-[0_0_22px_rgba(34,211,238,0.35)]"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-white/10 text-[10px] text-slate-500">
                QR
              </div>
            )}
            <span className="text-[8.5px] font-extrabold uppercase tracking-[0.25em] text-cyan-300/80">
              Scan at AFC gate
            </span>
            <span className="mono text-[10px] font-bold text-slate-400">{ticket.pnr}</span>
            <div
              className="h-7 w-full opacity-70"
              style={{
                background:
                  "repeating-linear-gradient(90deg,#67e8f9 0 2px,transparent 2px 4px,#67e8f9 4px 5px,transparent 5px 9px,#67e8f9 9px 12px,transparent 12px 14px)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
