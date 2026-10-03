import {
  pgTable,
  text,
  doublePrecision,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
} from "drizzle-orm/pg-core";

export const graphNodes = pgTable("graph_nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  custom: boolean("custom").notNull().default(false),
});

export const graphEdges = pgTable("graph_edges", {
  id: serial("id").primaryKey(),
  a: text("a").notNull(),
  b: text("b").notNull(),
  distance: doublePrecision("distance").notNull(),
  blocked: boolean("blocked").notNull().default(false),
});

export const routeHistory = pgTable("route_history", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  sourceId: text("source_id").notNull(),
  sourceName: text("source_name").notNull(),
  targetId: text("target_id").notNull(),
  targetName: text("target_name").notNull(),
  algorithm: text("algorithm").notNull(),
  distance: doublePrecision("distance").notNull(),
  hops: integer("hops").notNull(),
  explored: integer("explored").notNull(),
  execMs: doublePrecision("exec_ms").notNull(),
  path: jsonb("path").notNull(),
});

export const metroTickets = pgTable("metro_tickets", {
  id: serial("id").primaryKey(),
  pnr: text("pnr").notNull().unique(),
  passenger: text("passenger").notNull(),
  phone: text("phone"),
  fromId: text("from_id").notNull(),
  fromName: text("from_name").notNull(),
  toId: text("to_id").notNull(),
  toName: text("to_name").notNull(),
  segments: jsonb("segments").notNull(),
  transfers: integer("transfers").notNull(),
  stops: integer("stops").notNull(),
  distanceKm: doublePrecision("distance_km").notNull(),
  minutes: integer("minutes").notNull(),
  fareEach: doublePrecision("fare_each").notNull(),
  quantity: integer("quantity").notNull(),
  totalFare: doublePrecision("total_fare").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
