import { Pool } from "pg";

import type { DbQueryStep, RunContext, SeedDefinition } from "./types";
import { assertSafeIdentifier, substitute } from "./utils";

/** Create a PostgreSQL pool using the provided DATABASE_URL. */
export function createDbPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}

/** Run a lightweight SELECT 1 to verify the database is reachable. */
export async function checkDatabase(pool: Pool): Promise<string> {
  try {
    await pool.query("SELECT 1;");
    return "OK";
  } catch (error) {
    return "FAIL";
  }
}

/** Apply seed data entries that insert venues with ON CONFLICT DO NOTHING. */
export async function applySeedData(
  pool: Pool,
  seedData: SeedDefinition[] | undefined,
  context: RunContext
): Promise<string[]> {
  const actions: string[] = [];
  if (!seedData || seedData.length === 0) {
    return actions;
  }

  for (const seed of seedData) {
    if (seed.entity !== "venue") {
      throw new Error(`Unsupported seed entity: ${seed.entity}`);
    }

    const values = substitute(seed.values, context);
    const text =
      "INSERT INTO venues (id, name, address, venue_type, latitude, longitude, operating_hours_start, operating_hours_end) " +
      "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) " +
      "ON CONFLICT (id) DO NOTHING;";

    const params = [
      values.id,
      values.name,
      values.address ?? "",
      values.venueType,
      values.latitude,
      values.longitude,
      values.operatingHoursStart ?? "09:00:00",
      values.operatingHoursEnd ?? "21:00:00"
    ];

    await pool.query(text, params);
    actions.push(`Seeded venue ${values.id}`);
  }

  return actions;
}

/** Execute a simple parameterized SELECT query for a dbQuery step. */
export async function executeDbQuery(
  pool: Pool,
  step: DbQueryStep,
  context: RunContext
): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number }>{
  const targetRaw = substitute(step.target, context);
  const target = assertSafeIdentifier(String(targetRaw), "table");
  let queryText = `SELECT * FROM "${target}"`;
  const params: Array<string> = [];

  if (step.where) {
    const fieldRaw = substitute(step.where.field, context);
    const field = assertSafeIdentifier(String(fieldRaw), "column");
    const valueRaw = substitute(step.where.value, context);
    params.push(String(valueRaw));
    queryText += ` WHERE "${field}" = $1`;
  }

  queryText += ";";

  const result = await pool.query(queryText, params);
  return { rows: result.rows as Array<Record<string, unknown>>, rowCount: result.rowCount || 0 };
}
