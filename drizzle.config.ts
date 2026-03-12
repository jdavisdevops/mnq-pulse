import { defineConfig } from "drizzle-kit";

// Only require DATABASE_URL when actually running Drizzle Kit (e.g. db:push), not during app build/run
const isDrizzleKit = process.argv.some(
  (arg) => typeof arg === "string" && (arg.includes("drizzle-kit") || arg.includes("drizzle-kit.js"))
);
if (isDrizzleKit && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Drizzle Kit. Set it when running db:push or other drizzle-kit commands.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
