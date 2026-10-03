import Link from "next/link";
import Navbar from "@/components/Navbar";
import NetworkBackground from "@/components/NetworkBackground";
import {
  Waypoints,
  Map as MapIcon,
  Play,
  BarChart3,
  Swords,
  PenTool,
  FlaskConical,
  History,
  Download,
  ArrowRight,
  Route,
  Timer,
  Network,
  BrainCircuit,
  MapPin,
  ChevronRight,
  Sparkles,
  TramFront,
} from "lucide-react";

const FEATURES = [
  {
    icon: MapIcon,
    title: "Live Map Routing",
    desc: "Pick source & destination directly on an interactive OpenStreetMap of Hyderabad — real coordinates, real road graph, real weights.",
    href: "/dashboard",
  },
  {
    icon: TramFront,
    title: "Metro Tickets & QR",
    desc: "Full Hyderabad Metro network (Red/Blue/Green, 58 stations) on the map — plan journeys, pay (demo) and get printable QR e-tickets stored in your wallet.",
    href: "/metro",
  },
  {
    icon: Play,
    title: "Algorithm Visualizer",
    desc: "Watch Dijkstra, A* and Floyd–Warshall think. Animated nodes, edge relaxations, pseudocode highlighting, full playback control.",
    href: "/visualizer",
  },
  {
    icon: BarChart3,
    title: "Comparison Lab",
    desc: "Benchmark all three algorithms on identical inputs: actual execution time, nodes explored, relaxations and complexity — no fake numbers.",
    href: "/compare",
  },
  {
    icon: Swords,
    title: "Race Mode",
    desc: "Dijkstra vs A* sprint side-by-side in real time. See exactly how the haversine heuristic prunes the search frontier.",
    href: "/race",
  },
  {
    icon: PenTool,
    title: "Graph Editor",
    desc: "Add custom locations anywhere on the map, wire new roads, delete nodes — the algorithms re-solve on your network instantly.",
    href: "/editor",
  },
  {
    icon: FlaskConical,
    title: "What-If Analysis",
    desc: "Block any road segment and watch the optimizer reroute around it, with quantified detour cost vs the open network.",
    href: "/dashboard",
  },
  {
    icon: History,
    title: "Route History",
    desc: "Every solve is persisted with algorithm, distance, explored-node count and timing — replayable in one click.",
    href: "/history",
  },
  {
    icon: Download,
    title: "Export Results",
    desc: "One-click JSON / CSV export of optimal routes, alternatives, optimality proofs and solver statistics.",
    href: "/dashboard",
  },
];

const ALGOS = [
  {
    name: "Dijkstra",
    tag: "Uniform-cost optimum",
    bigO: "O((V+E) log V)",
    desc: "Settles nodes in strictly increasing distance — when the destination pops from the priority queue, the answer is mathematically final.",
    color: "from-cyan-500 to-sky-500",
  },
  {
    name: "A* Search",
    tag: "Goal-directed optimum",
    bigO: "O(E) guided by h(n)",
    desc: "Adds an admissible haversine heuristic to Dijkstra's g-cost, steering expansion toward the target and exploring far fewer nodes.",
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    name: "Floyd–Warshall",
    tag: "All-pairs optimum",
    bigO: "O(V³)",
    desc: "Dynamic programming over intermediate pivots — solves every source→destination pair in the entire network in one sweep.",
    color: "from-emerald-500 to-teal-500",
  },
];

export default function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />

      {/* ── HERO ─────────────────────────────── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-45"
          style={{ backgroundImage: "url(/images/hero-city.jpg)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05070f]/85 via-[#05070f]/55 to-[#05070f]" />
        <div className="grid-bg absolute inset-0" />
        <NetworkBackground />
        <div className="absolute -left-40 top-1/4 h-[480px] w-[480px] rounded-full bg-cyan-500/10 blur-[140px]" />
        <div className="absolute -right-40 bottom-1/4 h-[480px] w-[480px] rounded-full bg-blue-600/10 blur-[140px]" />

        <div className="relative z-10 mx-auto max-w-5xl px-6 pt-32 pb-20 text-center">
          <div className="anim-fade-up mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            Design & Analysis of Algorithms · Live Engine
          </div>

          <h1 className="anim-fade-up text-5xl font-extrabold leading-[1.04] tracking-tight text-white sm:text-7xl" style={{ animationDelay: "0.08s" }}>
            SMART ROUTE
            <span className="neon-text block drop-shadow-[0_0_30px_rgba(34,211,238,0.35)]">FINDER</span>
          </h1>

          <p className="anim-fade-up mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg" style={{ animationDelay: "0.16s" }}>
            An intelligent path-optimization system that runs <span className="font-semibold text-cyan-300">real Dijkstra, A* and Floyd–Warshall</span> on
            a live Hyderabad road graph — with animated execution traces, head-to-head races,
            what-if road blocking and proof-backed route explanations.
          </p>

          <div className="anim-fade-up mt-10 flex flex-wrap items-center justify-center gap-4" style={{ animationDelay: "0.24s" }}>
            <Link
              href="/dashboard"
              className="btn-neon group flex items-center gap-2 rounded-2xl px-7 py-4 text-sm font-bold tracking-wide text-white"
            >
              <Route className="h-4.5 w-4.5 transition-transform group-hover:rotate-12" />
              Launch Route Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/visualizer"
              className="btn-ghost group flex items-center gap-2 rounded-2xl px-7 py-4 text-sm font-bold tracking-wide text-cyan-100"
            >
              <Play className="h-4.5 w-4.5 text-cyan-300" />
              Watch Algorithms Think
            </Link>
          </div>

          <div className="anim-fade-up mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: "0.32s" }}>
            {[
              { icon: BrainCircuit, k: "3", v: "Real DAA algorithms" },
              { icon: MapPin, k: "23", v: "Hyderabad locations" },
              { icon: Timer, k: "< 1 ms", v: "Median solve time" },
              { icon: Network, k: "39+", v: "Live road segments" },
            ].map(({ icon: Icon, k, v }) => (
              <div key={v} className="glass glass-hover px-4 py-5">
                <Icon className="mx-auto h-5 w-5 text-cyan-300" />
                <div className="mono mt-2 text-2xl font-extrabold text-white">{k}</div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-slate-500">
          <div className="anim-floaty flex flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.3em]">
            Scroll
            <ChevronRight className="h-4 w-4 rotate-90 text-cyan-400" />
          </div>
        </div>
      </section>

      {/* ── FEATURE GRID ─────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="mb-14 text-center">
          <div className="mx-auto mb-4 w-fit rounded-full border border-cyan-400/25 bg-cyan-400/5 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300">
            Full-Stack Capability Matrix
          </div>
          <h2 className="text-3xl font-extrabold text-white sm:text-5xl">
            One system. <span className="neon-text">Every feature works.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400">
            No mock data, no dead buttons — every module below talks to live solver APIs backed by a
            persistent graph database.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc, href }, i) => (
            <Link
              key={title}
              href={href}
              className="glass glass-hover group relative overflow-hidden p-6"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-400/10 blur-2xl transition-all group-hover:bg-cyan-400/25" />
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_18px_-4px_rgba(34,211,238,0.5)]">
                <Icon className="h-5 w-5 text-cyan-300" />
              </div>
              <h3 className="mb-2 text-base font-bold text-white">{title}</h3>
              <p className="text-[13px] leading-relaxed text-slate-400">{desc}</p>
              <span className="mt-4 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-cyan-400 opacity-0 transition-all group-hover:opacity-100">
                Open module <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── ALGORITHM CARDS ──────────────────── */}
      <section className="relative border-y border-cyan-400/10 bg-[#070b16]/70 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Three algorithms. <span className="neon-text">Three personalities.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              Exact implementations with full execution tracing — then pitted against each other.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {ALGOS.map((a) => (
              <div key={a.name} className="glass glass-hover group p-7">
                <div className={`mb-5 h-1.5 w-16 rounded-full bg-gradient-to-r ${a.color} shadow-[0_0_14px_rgba(34,211,238,0.4)]`} />
                <div className="flex items-baseline justify-between">
                  <h3 className="text-xl font-extrabold text-white">{a.name}</h3>
                  <span className="mono rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-bold text-cyan-300">
                    {a.bigO}
                  </span>
                </div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{a.tag}</div>
                <p className="mt-4 text-[13.5px] leading-relaxed text-slate-400">{a.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/compare"
              className="btn-ghost inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-cyan-100"
            >
              <BarChart3 className="h-4 w-4 text-cyan-300" />
              Open the Comparison Lab
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-14 text-center text-3xl font-extrabold text-white sm:text-4xl">
          From click to <span className="neon-text">proven optimum</span> in 3 steps
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              n: "01",
              icon: MapPin,
              title: "Select on the map",
              desc: "Click any two of 23 Hyderabad locations — Gachibowli, Hitech City, Madhapur, Secunderabad, Kukatpally and more — right on OpenStreetMap.",
            },
            {
              n: "02",
              icon: Waypoints,
              title: "Solvers execute live",
              desc: "The API runs Dijkstra for the optimal corridor, Yen's method for alternatives, and Floyd–Warshall to cross-validate — with real measured timings.",
            },
            {
              n: "03",
              icon: BrainCircuit,
              title: "Understand the why",
              desc: "Get an evidence-backed explanation: settle-order invariants, quantified detour costs under blocked roads, and matrix-verified optimality.",
            },
          ].map((s) => (
            <div key={s.n} className="glass glass-hover relative overflow-hidden p-7">
              <div className="mono absolute right-5 top-4 text-5xl font-black text-cyan-400/10">{s.n}</div>
              <s.icon className="mb-4 h-6 w-6 text-cyan-300" />
              <h3 className="mb-2 text-lg font-bold text-white">{s.title}</h3>
              <p className="text-[13.5px] leading-relaxed text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────── */}
      <footer className="border-t border-cyan-400/10 bg-[#04060d]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
              <Waypoints className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-bold tracking-widest text-white">
              SMART ROUTE <span className="neon-text">FINDER</span>
            </span>
          </div>
          <p className="text-[11px] tracking-wide text-slate-500">
            Intelligent Path Optimization System · OpenStreetMap data · Real Dijkstra / A* / Floyd–Warshall execution
          </p>
        </div>
      </footer>
    </main>
  );
}
