import fs from "node:fs";

/** Load .env.local for CLI scripts (Next.js loads it for the app itself). */
for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
