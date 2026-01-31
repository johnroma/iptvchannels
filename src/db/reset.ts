import postgres from "postgres"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}

const sql = postgres(connectionString)

async function main() {
  try {
    console.log("🗑️  Truncating all tables...")
    // Truncate in order: children first (CASCADE handles FK constraints)
    await sql`TRUNCATE TABLE "channels" RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE "media" RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE "group_titles" RESTART IDENTITY CASCADE`
    console.log("✅ Tables emptied (channels, media, group_titles).")
  } catch (err) {
    console.error("❌ Reset failed:", err)
  } finally {
    await sql.end()
  }
}

await main()
