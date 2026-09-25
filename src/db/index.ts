import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * One Postgres pool per server process. In development, Next.js hot reload
 * re-evaluates modules, so the client is cached on globalThis to avoid leaking
 * connections.
 */

type Db = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and point it at Postgres.");
  const client = postgres(url, {
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    // Poolers such as Neon/Supabase (transaction mode) don't support prepared statements.
    prepare: !/pooler|pgbouncer/.test(url),
    onnotice: () => {},
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

const globalForDb = globalThis as unknown as { __parleyDb?: Db };

export function getDb(): Db {
  globalForDb.__parleyDb ??= createDb();
  return globalForDb.__parleyDb;
}

export { schema };
