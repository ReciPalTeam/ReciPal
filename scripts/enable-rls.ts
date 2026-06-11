/**
 * Phase M / WS-A4 — enable Row-Level Security on every public table.
 *
 * Both apps (ReciPal server + RP2 sync) reach Supabase via the SERVICE ROLE key or the
 * direct Postgres owner connection — both bypass RLS. The anon/authenticated PostgREST
 * roles have no policies, so after this they can read/write NOTHING. Pure defense in
 * depth: a leaked anon key yields zero data. (ENABLE, not FORCE — owner queries via
 * Drizzle/DATABASE_URL are unaffected.)
 *
 * Idempotent. Run: node --env-file=.env --import tsx scripts/enable-rls.ts
 */
import pg from "pg";

const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows: tables } = await pool.query<{ tablename: string; rowsecurity: boolean }>(
      `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    console.log(`Found ${tables.length} public tables.`);

    for (const t of tables) {
      if (t.rowsecurity) {
        console.log(`  = ${t.tablename} (already enabled)`);
        continue;
      }
      await pool.query(`ALTER TABLE public."${t.tablename}" ENABLE ROW LEVEL SECURITY`);
      console.log(`  + ${t.tablename} RLS ENABLED`);
    }

    const { rows: after } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false`,
    );
    if (after.length === 0) {
      console.log(`\nVERIFIED: RLS enabled on all ${tables.length} public tables.`);
    } else {
      console.error(`\nWARNING: RLS still disabled on: ${after.map((r) => r.tablename).join(", ")}`);
      process.exitCode = 1;
    }

    const { rows: policies } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM pg_policies WHERE schemaname = 'public'`,
    );
    console.log(`Public policies in place: ${policies[0].count} (expected 0 — anon gets nothing).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("enable-rls failed:", err);
  process.exit(1);
});
