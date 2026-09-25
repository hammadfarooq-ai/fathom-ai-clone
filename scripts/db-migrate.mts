import "./env.mts";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb } from "@/db";

const db = getDb();
await migrate(db, { migrationsFolder: "drizzle" });
console.log("Migrations applied.");
await db.$client.end();
