import "./env.mts";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb } from "@/db";
import { seedDatabase } from "@/server/seed";

/**
 * Deploy step: apply migrations, then seed only if the workspace is empty, so
 * redeploys never wipe data people created in the live app.
 */
const db = getDb();
await migrate(db, { migrationsFolder: "drizzle" });
const [{ count }] = await db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM meetings`);
if (count === 0) {
  const result = await seedDatabase(db);
  console.log(`Migrated and seeded ${result.meetings} meetings.`);
} else {
  console.log(`Migrated. Workspace already has ${count} meetings; seed skipped.`);
}
await db.$client.end();
