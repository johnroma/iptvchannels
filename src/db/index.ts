import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import * as schema from "./schema"

// Export schema and validators for convenience
export * from "./schema"
export * from "./validators"

// Type for our database instance
type Database = PostgresJsDatabase<typeof schema>

// Dynamic database initialization to prevent client-side imports
let _db: Database | null = null

async function initDb(): Promise<Database> {
  if (typeof globalThis.window !== "undefined") {
    throw new Error("Database cannot be initialized on the client")
  }

  if (_db) return _db

  const { drizzle } = await import("drizzle-orm/postgres-js")
  const postgres = (await import("postgres")).default

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required")
  }

  const client = postgres(connectionString)
  _db = drizzle(client, { schema })
  return _db
}

// Export a properly typed proxy for the database
export const db = new Proxy<Database>({} as Database, {
  get(target, prop: keyof Database) {
    if (typeof globalThis.window !== "undefined") {
      throw new Error("Database cannot be accessed on the client")
    }

    if (!_db) {
      throw new Error(
        "Database not initialized. This should not happen in server functions.",
      )
    }

    return _db[prop]
  },
})

// Initialize database immediately on server
if (typeof globalThis.window === "undefined") {
  initDb().catch(console.error)
}
