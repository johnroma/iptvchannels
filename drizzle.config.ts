import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  // Output to supabase/migrations for compatibility with supabase db push
  out: "./supabase/migrations",
  dbCredentials: {
    // Loaded from .env (local) or .env.production (Supabase)
    url: process.env.DATABASE_URL!,
  },
});
