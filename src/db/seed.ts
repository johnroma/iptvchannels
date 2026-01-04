import { db, channels } from "./index.js";
import { sql } from "drizzle-orm";

async function seed() {
  // Clear existing data
  await db.execute(sql`TRUNCATE TABLE channels RESTART IDENTITY`);

  // Insert one mock row for local development
  await db.insert(channels).values({
    tvgId: "test.channel",
    tvgName: "TEST| Mock Channel",
    tvgLogo: "https://via.placeholder.com/100",
    groupTitle: "TEST| DEVELOPMENT",
    streamUrl: "http://example.com/stream/test",
    contentId: 9999,
    name: null,
    countryCode: null,
    favourite: false,
    active: false,
    scriptAlias: null,
  });

  console.log("Local dev seed complete: 1 mock row inserted");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
