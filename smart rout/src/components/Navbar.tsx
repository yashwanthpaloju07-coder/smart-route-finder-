"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Waypoints,
  Map,
  Play,
  BarChart3,
  Swords,
  PenTool,
  History,
  Menu,
  X,
  TramFront,
} from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: Map },
  { href: "/metro", label: "Metro Tickets", icon: TramFront },
  { href: "/visualizer", label: "Visualizer", icon: Play },
  { href: "/compare", label: "Compare", icon: BarChart3 },
  { href: "/race", label: "Race", icon: Swords },
  { href: "/editor", label: "Graph Editor", icon: PenTool },
  { href: "/history", label: "History", icon: History },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-[1500px] px-3 sm:px-6">
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-cyan-400/15 bg-[#070c18]/80 px-4 py-2.5 backdrop-blur-xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.8)]">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_18px_rgba(34,211,238,0.5)]">
              <Waypoints className="h-5 w-5 text-white" strokeWidth={2.2} />
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-bold tracking-[0.18em] text-white">
                SMART ROUTE <span className="neon-text">FINDER</span>
              </span>
              <span className="block text-[9px] font-medium uppercase tracking-[0.28em] text-cyan-300/60">
                Intelligent Path Optimization
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-all ${
                    active
                      ? "bg-cyan-400/15 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35),0_0_16px_-4px_rgba(34,211,238,0.5)]"
                      : "text-slate-400 hover:bg-white/5 hover:text-cyan-100"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              <span className="anim-glow h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              Engine Online
            </span>
          </div>

          <button
            className="btn-ghost rounded-xl p-2 text-cyan-200 lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="anim-fade-up mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-cyan-400/15 bg-[#070c18]/95 p-3 backdrop-blur-xl lg:hidden">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  pathname === href
                    ? "bg-cyan-400/15 text-cyan-200"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
