import { db } from "./index";
import { sql } from "drizzle-orm";
import { SEED_NODES, seedEdges } from "@/lib/graph";

// Self-bootstrapping data layer: creates tables if missing and seeds the
// default Hyderabad network on first use. Memoized so it runs once per
// server process.
let ready: Promise<void> | null = null;

export function ensureDb(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS graph_nodes (
          id text PRIMARY KEY,
          name text NOT NULL,
          lat double precision NOT NULL,
          lng double precision NOT NULL,
          custom boolean NOT NULL DEFAULT false
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS graph_edges (
          id serial PRIMARY KEY,
          a text NOT NULL,
          b text NOT NULL,
          distance double precision NOT NULL,
          blocked boolean NOT NULL DEFAULT false
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS route_history (
          id serial PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          source_id text NOT NULL,
          source_name text NOT NULL,
          target_id text NOT NULL,
          target_name text NOT NULL,
          algorithm text NOT NULL,
          distance double precision NOT NULL,
          hops integer NOT NULL,
          explored integer NOT NULL,
          exec_ms double precision NOT NULL,
          path jsonb NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS metro_tickets (
          id serial PRIMARY KEY,
          pnr text NOT NULL UNIQUE,
          passenger text NOT NULL,
          phone text,
          from_id text NOT NULL,
          from_name text NOT NULL,
          to_id text NOT NULL,
          to_name text NOT NULL,
          segments jsonb NOT NULL,
          transfers integer NOT NULL,
          stops integer NOT NULL,
          distance_km double precision NOT NULL,
          minutes integer NOT NULL,
          fare_each double precision NOT NULL,
          quantity integer NOT NULL,
          total_fare double precision NOT NULL,
          status text NOT NULL DEFAULT 'active',
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      const res = await db.execute(sql`SELECT COUNT(*)::int AS c FROM graph_nodes`);
      const count = Number((res.rows[0] as { c: number }).c);
      if (count === 0) {
        for (const n of SEED_NODES) {
          await db.execute(sql`
            INSERT INTO graph_nodes (id, name, lat, lng, custom)
            VALUES (${n.id}, ${n.name}, ${n.lat}, ${n.lng}, false)
            ON CONFLICT (id) DO NOTHING
          `);
        }
        for (const e of seedEdges()) {
          await db.execute(sql`
            INSERT INTO graph_edges (a, b, distance, blocked)
            VALUES (${e.a}, ${e.b}, ${e.distance}, false)
          `);
        }
      }
    })().catch((err) => {
      ready = null; // allow retry on next request
      throw err;
    });
  }
  return ready;
}
