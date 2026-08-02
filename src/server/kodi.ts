import { count, eq, inArray, or, sql } from "drizzle-orm"
import { db, channels } from "~/db"
import { matchKodiChannels, resolveKodiConnection } from "~/lib/kodi-url"

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

  const kodiChannels = kodiData.result.channels

  // `total` is reported to the UI as "Total DB channels", so it must stay the
  // whole-table count even though we only fetch matchable rows below.
  const [totalRow] = await db.select({ value: count() }).from(channels)
  const total = totalRow?.value ?? 0

  const labels = kodiChannels
    .map((c) => c.label.trim().toLowerCase())
    .filter(Boolean)

  if (labels.length === 0) {
    return {
      total,
      kodiChannels: kodiChannels.length,
      matched: 0,
      updated: 0,
      skipped: total,
    }
  }

  // matchKodiChannels compares trimmed/lowercased `name` then `tvgName` for
  // exact equality, so a row can only match if one of those is in the Kodi
  // label set. Filtering here is equivalent to scanning the table in Node, but
  // without shipping every row over the wire.
  // NOTE: keep this predicate in sync with matchKodiChannels.
  const dbChannels = await db
    .select({
      id: channels.id,
      name: channels.name,
      tvgName: channels.tvgName,
      contentId: channels.contentId,
    })
    .from(channels)
    .where(
      or(
        inArray(sql`lower(trim(${channels.name}))`, labels),
        inArray(sql`lower(trim(${channels.tvgName}))`, labels),
      ),
    )

  const matches = matchKodiChannels(dbChannels, kodiChannels)
  const changed = matches.filter((m) => m.changed)

  for (const match of changed) {
    await db
      .update(channels)
      .set({ contentId: match.contentId, updatedAt: new Date() })
      .where(eq(channels.id, match.id))
  }

  console.log("Matched channels:", matches.map((m) => m.label))
  if (changed.length > 0) {
    console.log("Updated channels:", changed.map((m) => m.label))
  }

  return {
    total,
    kodiChannels: kodiChannels.length,
    matched: matches.length,
    updated: changed.length,
    skipped: total - matches.length,
  }
}
