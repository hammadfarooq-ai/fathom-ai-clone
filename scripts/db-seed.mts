import "./env.mts";
import { getDb } from "@/db";
import { seedDatabase } from "@/server/seed";

const db = getDb();
const result = await seedDatabase(db);
console.log(`Seeded ${result.meetings} meetings (dates shifted by ${result.shiftedDays} days).`);
await db.$client.end();
