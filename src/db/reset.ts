import postgres from "postgres"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}

const sql = postgres(connectionString)

async function main() {
  try {
    console.log("🗑️  Dropping tables and migration history...")
    await sql`DROP TABLE IF EXISTS "channels" CASCADE`
    await sql`DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE`
    await sql`DROP SCHEMA IF EXISTS "drizzle" CASCADE`
    console.log("✅ Database reset complete.")
  } catch (err) {
    console.error("❌ Reset failed:", err)
  } finally {
    await sql.end()
  }
}

await main()
