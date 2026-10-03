import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { graphNodes, graphEdges } from "@/db/schema";
import { asc } from "drizzle-orm";
import type { Graph } from "@/lib/graph";

export async function getGraph(): Promise<Graph> {
  await ensureDb();
  const [nodes, edges] = await Promise.all([
    db.select().from(graphNodes).orderBy(asc(graphNodes.name)),
    db.select().from(graphEdges).orderBy(asc(graphEdges.id)),
  ]);
  return { nodes, edges };
}
