import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { Sentry } from "./lib/sentry";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Explicit resilience defaults (was: all implicit). We talk to the Supabase
  // transaction pooler (pooler.supabase.com:6543), where short-lived idle clients
  // are routine, so these matter:
  max: 10, // cap concurrent connections (sane default for the pooler)
  idleTimeoutMillis: 30_000, // drop idle clients after 30s so we don't sit on a half-dead TCP socket across a sleep/blip
  connectionTimeoutMillis: 10_000, // fail a connect attempt in 10s instead of hanging forever
  keepAlive: true, // TCP keepalive so a dead peer is detected promptly
});

// node-postgres footgun: idle clients in the pool stay connected to the Postgres
// backend, so when the backend restarts or the network partitions (Supabase pooler
// blip, DNS hiccup, laptop sleep) every idle client emits an 'error'. If the Pool
// emits 'error' with NO listener attached, Node escalates it to an uncaught exception
// and crashes the whole process (this took the server down twice — getaddrinfo
// ENOTFOUND / read EADDRNOTAVAIL). Attaching this handler makes those transient
// errors non-fatal: we log + report them, and the pool transparently discards the
// dead client and opens a fresh one on the next query. Do NOT exit here.
pool.on("error", (err) => {
  console.error("[db-pool] idle client error (non-fatal, pool will recover):", err);
  Sentry.captureException(err);
});

export const db = drizzle(pool, { schema });
