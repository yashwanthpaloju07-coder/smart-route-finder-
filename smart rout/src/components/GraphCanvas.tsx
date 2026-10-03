"use client";

import { useMemo } from "react";
import type { GNode, GEdge } from "@/lib/graph";
import { edgeKey } from "@/lib/graph";
import type { NodeVis, EdgeVis } from "@/lib/player";
import { fmtKm } from "@/lib/graph";

interface Pt {
  x: number;
  y: number;
}

const W = 1000;
const H = 640;

function project(nodes: GNode[]): Map<string, Pt> {
  const lats = nodes.map((n) => n.lat);
  const lngs = nodes.map((n) => n.lng);
  const minLa = Math.min(...lats);
  const maxLa = Math.max(...lats);
  const minLo = Math.min(...lngs);
  const maxLo = Math.max(...lngs);
  const padX = 70;
  const padY = 60;
  const map = new Map<string, Pt>();
  for (const n of nodes) {
    const fx = (n.lng - minLo) / Math.max(1e-9, maxLo - minLo);
    const fy = (n.lat - minLa) / Math.max(1e-9, maxLa - minLa);
    map.set(n.id, {
      x: padX + fx * (W - padX * 2),
      y: H - padY - fy * (H - padY * 2),
    });
  }
  return map;
}

const NODE_STYLE: Record<NodeVis, { fill: string; stroke: string; r: number; glow?: string; text: string }> = {
  unvisited: { fill: "#0b1322", stroke: "rgba(103,232,249,0.35)", r: 11, text: "#67e8f9" },
  frontier: { fill: "#0e7490", stroke: "#22d3ee", r: 12, glow: "rgba(34,211,238,0.8)", text: "#cffafe" },
  current: { fill: "#b45309", stroke: "#fbbf24", r: 14, glow: "rgba(251,191,36,0.9)", text: "#fef3c7" },
  settled: { fill: "#1d4ed8", stroke: "#60a5fa", r: 11.5, glow: "rgba(96,165,250,0.6)", text: "#dbeafe" },
  path: { fill: "#059669", stroke: "#34d399", r: 13, glow: "rgba(52,211,153,0.95)", text: "#d1fae5" },
  pivot: { fill: "#6d28d9", stroke: "#a78bfa", r: 13, glow: "rgba(167,139,250,0.9)", text: "#ede9fe" },
};

export default function GraphCanvas({
  nodes,
  edges,
  nodeState = {},
  edgeState = {},
  distLabel = {},
  showDist = true,
  compact = false,
  onNodeClick,
  highlightPath = [],
}: {
  nodes: GNode[];
  edges: GEdge[];
  nodeState?: Record<string, NodeVis>;
  edgeState?: Record<string, EdgeVis>;
  distLabel?: Record<string, number>;
  showDist?: boolean;
  compact?: boolean;
  onNodeClick?: (id: string) => void;
  highlightPath?: string[];
}) {
  const pts = useMemo(() => project(nodes), [nodes]);
  const pathSet = useMemo(() => new Set(highlightPath), [highlightPath]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full select-none"
      role="img"
      aria-label="Algorithm graph visualization"
    >
      <defs>
        <filter id="glowC" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glowS" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* edges */}
      {edges.map((e) => {
        const pa = pts.get(e.a);
        const pb = pts.get(e.b);
        if (!pa || !pb) return null;
        const st = edgeState[edgeKey(e.a, e.b)] ?? "idle";
        const blocked = e.blocked;
        let stroke = "rgba(103,232,249,0.16)";
        let width = 1.6;
        let opacity = 1;
        let cls = "viz-edge";
        if (blocked) {
          stroke = "rgba(244,63,94,0.55)";
          width = 1.8;
          cls += " flow-anim";
        } else if (st === "active") {
          stroke = "#fbbf24";
          width = 3;
          cls += " flow-anim";
        } else if (st === "path") {
          stroke = "#22d3ee";
          width = compact ? 3.4 : 4.2;
        }
        return (
          <g key={e.id}>
            {st === "path" && !blocked && (
              <line
                x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke="#22d3ee" strokeWidth={width + 7} opacity={0.22}
                strokeLinecap="round" filter="url(#glowC)"
              />
            )}
            <line
              className={cls}
              x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke={stroke} strokeWidth={width} opacity={opacity}
              strokeLinecap="round"
              strokeDasharray={blocked ? "6 8" : st === "path" ? "none" : undefined}
            />
            {!compact && (
              <text
                x={(pa.x + pb.x) / 2}
                y={(pa.y + pb.y) / 2 - 5}
                textAnchor="middle"
                fontSize={blocked ? 11 : 10.5}
                className="mono"
                fill={blocked ? "#fb7185" : st === "path" ? "#a5f3fc" : "rgba(148,163,184,0.55)"}
              >
                {fmtKm(e.distance)}
              </text>
            )}
          </g>
        );
      })}

      {/* nodes */}
      {nodes.map((n, i) => {
        const p = pts.get(n.id)!;
        const st: NodeVis = nodeState[n.id] ?? "unvisited";
        const sty = NODE_STYLE[st];
        const d = distLabel[n.id];
        const clickable = !!onNodeClick;
        return (
          <g
            key={n.id}
            className="viz-node"
            style={{ cursor: clickable ? "pointer" : "default" }}
            onClick={() => onNodeClick?.(n.id)}
          >
            {sty.glow && (
              <circle cx={p.x} cy={p.y} r={sty.r + 7} fill="none" stroke={sty.glow} strokeWidth={2} opacity={0.45} filter="url(#glowS)" />
            )}
            {(st === "current" || st === "pivot") && (
              <circle cx={p.x} cy={p.y} r={sty.r + 13} fill="none" stroke={sty.stroke} strokeWidth={1.2} opacity={0.5} className="flow-anim" strokeDasharray="4 6" />
            )}
            <circle
              className="core"
              cx={p.x} cy={p.y} r={sty.r}
              fill={sty.fill} stroke={pathSet.has(n.id) && st === "unvisited" ? "#22d3ee" : sty.stroke}
              strokeWidth={2.2}
              filter={st !== "unvisited" ? "url(#glowS)" : undefined}
            />
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} className="mono" fill={sty.text}>
              {i + 1}
            </text>
            <text
              x={p.x} y={p.y + sty.r + (compact ? 13 : 15)}
              textAnchor="middle" fontSize={compact ? 10.5 : 11.5} fontWeight={600}
              fill={st === "unvisited" ? "rgba(203,225,255,0.72)" : "#e0f2fe"}
              style={{ paintOrder: "stroke", stroke: "#05070f", strokeWidth: 3.5 }}
            >
              {n.name}
            </text>
            {showDist && !compact && d !== undefined && isFinite(d) && (
              <text
                x={p.x} y={p.y - sty.r - 7}
                textAnchor="middle" fontSize={10.5} fontWeight={700} className="mono"
                fill="#fbbf24"
                style={{ paintOrder: "stroke", stroke: "#05070f", strokeWidth: 3 }}
              >
                {fmtKm(d)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
