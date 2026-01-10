import { db, channels } from "./index.js"
import { sql } from "drizzle-orm"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Navigate to workspace root from src/db/
// iptvchannels/src/db -> iptvchannels -> workspace root
const ASSETS_DIR = path.resolve(__dirname, "../../../assets")

interface KodiChannel {
  channel: string
  channelid: number
  label: string
}

interface KodiResponse {
  result: {
    channels: KodiChannel[]
  }
}

// Parse attributes from EXTINF line
function parseExtInf(line: string) {
  const getAttr = (key: string) => {
    const match = line.match(new RegExp(`${key}="([^"]*)"`))
    return match ? match[1] : null
  }

  return {
    tvgId: getAttr("tvg-id"),
    tvgName: getAttr("tvg-name"),
    tvgLogo: getAttr("tvg-logo"),
    groupTitle: getAttr("group-title"),
  }
}

async function seed() {
  console.log("Starting seed process...")

  // 1. Load Content IDs
  const contentIdPath = path.join(ASSETS_DIR, "contentid.json")
  console.log(`Reading Content IDs from ${contentIdPath}`)

  let contentIdMap = new Map<string, number>()
  try {
    const contentIdParams = await fs.readFile(contentIdPath, "utf-8")
    const parsed = JSON.parse(contentIdParams) as KodiResponse

    if (parsed.result && parsed.result.channels) {
      for (const ch of parsed.result.channels) {
        contentIdMap.set(ch.channel, ch.channelid)
      }
    }
    console.log(`Loaded ${contentIdMap.size} content ID mappings.`)
  } catch (err) {
    console.error(`Failed to load contentid.json: ${err}`)
    process.exit(1)
  }

  // 2. Load M3U Channels
  const m3uPath = path.join(ASSETS_DIR, "channels.m3u")
  console.log(`Reading Channels from ${m3uPath}`)

  const m3uContent = await fs.readFile(m3uPath, "utf-8")
  const lines = m3uContent.split(/\r?\n/)

  const channelData: (typeof channels.$inferInsert)[] = []

  let currentInfo: ReturnType<typeof parseExtInf> | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith("#EXTINF:")) {
      currentInfo = parseExtInf(trimmed)
    } else if (!trimmed.startsWith("#") && currentInfo) {
      // This assumption holds that a URL follows an EXTINF line
      // If currentInfo is set, this line is the stream URL

      const streamUrl = trimmed
      const { tvgId, tvgName, tvgLogo, groupTitle } = currentInfo

      if (tvgName) {
        channelData.push({
          tvgId,
          tvgName,
          tvgLogo,
          groupTitle,
          streamUrl,
          contentId: contentIdMap.get(tvgName) ?? null,
          name: tvgName, // Default name to tvgName
          active: false,
          favourite: false,
        })
      }

      currentInfo = null // Reset for next channel
    }
  }

  console.log(`Parsed ${channelData.length} channels from M3U.`)

  // 3. Clear existing data
  console.log("Clearing existing channels...")
  await db.execute(sql`TRUNCATE TABLE channels RESTART IDENTITY`)

  // 4. Insert data in batches
  const BATCH_SIZE = 100
  console.log(`Inserting channels in batches of ${BATCH_SIZE}...`)

  for (let i = 0; i < channelData.length; i += BATCH_SIZE) {
    const batch = channelData.slice(i, i + BATCH_SIZE)
    await db.insert(channels).values(batch)
  }

  console.log("Seed complete!")
  process.exit(0)
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
