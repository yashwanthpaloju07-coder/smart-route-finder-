"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, MapPin, CornerDownLeft } from "lucide-react";

export interface GeoPick {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
  type: string;
}

export default function MapSearch({
  onPick,
  placeholder = "Search any place on Earth…",
}: {
  onPick: (r: GeoPick) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoPick[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (q.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`);
        const d = await res.json();
        if (d.ok) {
          setResults(d.results);
          setOpen(true);
        }
      } catch {
        /* offline geocoder — keep quiet */
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (r: GeoPick) => {
    onPick(r);
    setOpen(false);
    setQ(r.name);
  };

  return (
    <div ref={boxRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (results[0]) pick(results[0]);
        }}
        className="flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-[#050a14]/92 px-3 py-2.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md focus-within:border-cyan-400/60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-300" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-cyan-300" />
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[12.5px] font-semibold text-slate-100 outline-none placeholder:text-slate-500"
        />
      </form>

      {open && results.length > 0 && (
        <div className="anim-fade-up absolute left-0 right-0 top-[calc(100%+6px)] z-[600] max-h-72 overflow-y-auto rounded-xl border border-cyan-400/25 bg-[#050a14]/97 p-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.9)] backdrop-blur-md">
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => pick(r)}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-cyan-400/10"
            >
              <MapPin className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${i === 0 ? "text-cyan-300" : "text-slate-500"}`} />
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-bold text-slate-100">{r.name}</span>
                <span className="block truncate text-[10px] text-slate-500">{r.detail}</span>
              </span>
              {i === 0 && <CornerDownLeft className="ml-auto mt-1 h-3 w-3 shrink-0 text-slate-600" />}
            </button>
          ))}
          <div className="border-t border-white/5 px-2.5 py-1.5 text-right text-[8.5px] font-semibold uppercase tracking-widest text-slate-600">
            Geocoding © OpenStreetMap Nominatim
          </div>
        </div>
      )}
    </div>
  );
}
