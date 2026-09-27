type ProbeRow = { database: string; server_address: string | null; active_schema: string | null;
  user_relations: number; extra_schemas: number };
type Probe = { query(sql: string): Promise<{ rows: ProbeRow[] }> };

export function validatePostgresTestUrl(raw: string): string {
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
    !url.port || url.search || url.hash || !/^irl_r1_test_[a-z0-9_]+$/.test(database))
    throw new Error('Verification requires a loopback URL without query parameters and a database named irl_r1_test_*');
  return database;
}

export async function assertEmptyPostgresTestDatabase(probe: Probe, database: string): Promise<void> {
  const { rows } = await probe.query(`SELECT current_database() AS database, host(inet_server_addr()) AS server_address,
    current_schema() AS active_schema,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
        AND c.relkind IN ('r','p','v','m','f','S')) AS user_relations,
    (SELECT count(*)::int FROM pg_namespace
      WHERE nspname NOT IN ('public','information_schema') AND nspname !~ '^pg_') AS extra_schemas`);
  const state = rows[0];
  if (!state || state.database !== database || state.server_address !== '127.0.0.1' ||
    state.active_schema !== 'public' || state.user_relations !== 0 || state.extra_schemas !== 0)
    throw new Error('Verification requires an empty loopback PostgreSQL database with public as the active schema');
}
