import type { StepEvent } from "./algorithms";
import { edgeKey } from "./graph";

export type NodeVis = "unvisited" | "frontier" | "current" | "settled" | "path" | "pivot";
export type EdgeVis = "idle" | "active" | "path";

export interface VizState {
  nodeState: Record<string, NodeVis>;
  edgeState: Record<string, EdgeVis>;
  distLabel: Record<string, number>;
  log: { idx: number; note: string }[];
  explored: number;
  line: number;
  currentNode: string | null;
  finished: boolean;
  finalPath: string[];
}

export function emptyVizState(): VizState {
  return {
    nodeState: {},
    edgeState: {},
    distLabel: {},
    log: [],
    explored: 0,
    line: -1,
    currentNode: null,
    finished: false,
    finalPath: [],
  };
}

function applyStep(s: VizState, step: StepEvent, idx: number) {
  s.line = step.line;
  if (step.note) {
    s.log.push({ idx, note: step.note });
    if (s.log.length > 140) s.log.shift();
  }
  switch (step.op) {
    case "init":
      if (step.node) {
        s.nodeState[step.node] = "frontier";
        s.distLabel[step.node] = 0;
      }
      break;
    case "dequeue":
      if (step.node) {
        s.nodeState[step.node] = "current";
        s.currentNode = step.node;
      }
      break;
    case "settle":
      if (step.node) {
        if (s.nodeState[step.node] !== "settled") s.explored++;
        s.nodeState[step.node] = "settled";
        if (s.currentNode === step.node) s.currentNode = null;
      }
      break;
    case "consider":
      if (step.from && step.to) s.edgeState[edgeKey(step.from, step.to)] = "active";
      break;
    case "update":
      if (step.from && step.to) {
        s.edgeState[edgeKey(step.from, step.to)] = "active";
        if (s.nodeState[step.to] !== "settled") s.nodeState[step.to] = "frontier";
        if (typeof step.dist === "number") s.distLabel[step.to] = step.dist;
      }
      break;
    case "skip":
      if (step.from && step.to) s.edgeState[edgeKey(step.from, step.to)] = "idle";
      break;
    case "fw-pivot":
      if (step.via) s.nodeState[step.via] = "pivot";
      break;
    case "fw-update":
      if (step.from && step.to) s.edgeState[edgeKey(step.from, step.to)] = "active";
      if (step.via) s.nodeState[step.via] = "pivot";
      break;
    case "path":
      if (step.path) {
        s.finalPath = step.path;
        for (const id of step.path) s.nodeState[id] = "path";
        for (let i = 0; i < step.path.length - 1; i++) {
          s.edgeState[edgeKey(step.path[i], step.path[i + 1])] = "path";
        }
      }
      break;
    case "done":
    case "fw-done":
      s.finished = true;
      break;
  }
}

// Replays the trace from 0..upto (exclusive). Cheap enough for scrubbing.
export function computeState(steps: StepEvent[], upto: number): VizState {
  const s = emptyVizState();
  const n = Math.min(upto, steps.length);
  for (let i = 0; i < n; i++) applyStep(s, steps[i], i);
  if (upto >= steps.length) s.finished = true;
  return s;
}
