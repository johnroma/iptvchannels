import { eq } from "drizzle-orm"
import { db, channels } from "~/db"
import { resolveKodiConnection } from "~/lib/kodi-url"

// ─── Sync ───────────────────────────────────────────────────

type KodiChannel = {
  channelid: number
  label: string
}

type KodiResponse = {
  result?: {
    channels?: KodiChannel[]
  }
  error?: { code: number; message: string }
}

export type KodiSyncResult = {
  total: number
  kodiChannels: number
  matched: number
  updated: number
  skipped: number
}

/**
 * Pulls the current Kodi PVR channel list and refreshes `channels.content_id`
 * for rows whose `tvg_name` matches a Kodi channel label (case-insensitive).
 * Throws on any connection/auth/protocol failure so callers can surface it.
 */
export async function runKodiSync(): Promise<KodiSyncResult> {
  const { url, headers, authenticated } = resolveKodiConnection()

  const kodiRequest = {
    jsonrpc: "2.0",
    method: "PVR.GetChannels",
    params: { channelgroupid: "alltv" },
    id: 1,
  }

  let kodiResponse: Response
  try {
    kodiResponse = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(kodiRequest),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Failed to connect to Kodi JSON-RPC at ${url}. ` +
        `Set KODI_URL (preferred) or KODI_HOST/KODI_PORT, and ensure Kodi's web server is enabled. ` +
        `Underlying error: ${message}`,
    )
  }

  if (kodiResponse.status === 401) {
    throw new Error(
      `Kodi rejected the request with 401 at ${url}. ` +
        (authenticated
          ? `Check KODI_USER/KODI_PASSWORD against Kodi's web server credentials.`
          : `Kodi's web server requires a username/password — set KODI_USER and KODI_PASSWORD.`),
    )
  }

  if (!kodiResponse.ok) {
    throw new Error(`Kodi API error: ${kodiResponse.status}`)
  }

  const kodiData = (await kodiResponse.json()) as KodiResponse

  if (kodiData.error) {
    throw new Error(
      `Kodi JSON-RPC error ${kodiData.error.code}: ${kodiData.error.message}`,
    )
  }

  if (!kodiData.result?.channels) {
    throw new Error("No channels returned from Kodi")
  }

  const dbChannels = await db.query.channels.findMany({
    columns: {
      id: true,
      tvgName: true,
      contentId: true,
    },
  })

  const kodiMap = new Map<string, number>(
    kodiData.result.channels.map((c) => [c.label.toLowerCase(), c.channelid]),
  )

  let updated = 0
  const matchedChannels: string[] = []
  const updatedChannels: string[] = []
  for (const channel of dbChannels) {
    const kodiId = kodiMap.get(channel.tvgName.toLowerCase())
    if (kodiId !== undefined) {
      matchedChannels.push(channel.tvgName)
      if (kodiId !== channel.contentId) {
        await db
          .update(channels)
          .set({ contentId: kodiId, updatedAt: new Date() })
          .where(eq(channels.id, channel.id))
        updated++
        updatedChannels.push(channel.tvgName)
      }
    }
  }

  console.log("Matched channels:", matchedChannels)
  if (updatedChannels.length > 0) {
    console.log("Updated channels:", updatedChannels)
  }

  return {
    total: dbChannels.length,
    kodiChannels: kodiData.result.channels.length,
    matched: matchedChannels.length,
    updated,
    skipped: dbChannels.length - matchedChannels.length,
  }
}
