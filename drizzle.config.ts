import { defineConfig } from "drizzle-kit";

const configuredSchema = process.env.DB_SCHEMA?.trim();
const useNamedSchema = Boolean(
  configuredSchema && configuredSchema.toLowerCase() !== "public",
);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  // Output to supabase/migrations for compatibility with supabase db push
  out: "./supabase/migrations",
  ...(useNamedSchema ? { schemaFilter: [configuredSchema] } : {}),
  dbCredentials: {
    // Loaded from .env (local) or .env.production (Supabase)
    url: process.env.DATABASE_URL!,
  },
});
