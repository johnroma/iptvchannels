import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema.js"

// Loaded from .env (local) or .env.production (Supabase) or Vercel env
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required")
}

// Create postgres client
const client = postgres(connectionString)

// Create drizzle instance with schema
export const db = drizzle(client, { schema })

// Export schema and validators for convenience
export * from "./schema.js"
export * from "./validators.js"
