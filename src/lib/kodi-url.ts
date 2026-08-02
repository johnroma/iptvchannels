// Kodi JSON-RPC endpoint/auth resolution. Kept free of DB imports so it can be
// tested standalone, matching the other pure helpers in this directory.

type KodiEnv = {
  KODI_URL?: string
  KODI_HOST?: string
  KODI_PORT?: string
  KODI_USER?: string
  KODI_PASSWORD?: string
  // Index signature so `process.env` (ProcessEnv) is assignable.
} & Record<string, string | undefined>

export type KodiConnection = {
  url: string
  headers: Record<string, string>
  authenticated: boolean
}

/**
 * Resolves the Kodi JSON-RPC endpoint from the environment.
 * `KODI_URL` wins; otherwise `http://$KODI_HOST:$KODI_PORT` is assembled
 * (defaulting to localhost:8080). `/jsonrpc` is appended when the configured
 * base does not already end in it. `KODI_USER` (with optional `KODI_PASSWORD`)
 * enables HTTP Basic auth; blank values are treated as unset.
 */
export function resolveKodiConnection(
  env: KodiEnv = process.env,
): KodiConnection {
  const rawUrl = env.KODI_URL?.trim()
  const host = env.KODI_HOST?.trim() || "localhost"
  const port = env.KODI_PORT?.trim() || "8080"

  const base = (rawUrl || `http://${host}:${port}`).replace(/\/+$/, "")
  const url = base.endsWith("/jsonrpc") ? base : `${base}/jsonrpc`

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  const user = env.KODI_USER?.trim()
  const password = env.KODI_PASSWORD ?? ""
  if (user) {
    const encoded = Buffer.from(`${user}:${password}`, "utf8").toString("base64")
    headers.Authorization = `Basic ${encoded}`
  }

  return { url, headers, authenticated: Boolean(user) }
}

// ─── Channel matching ───────────────────────────────────────

export type KodiLabel = { channelid: number; label: string }
export type MatchableChannel = {
  id: string
  name: string | null
  tvgName: string
  contentId: number | null
}
export type ChannelMatch = {
  id: string
  label: string
  contentId: number
  changed: boolean
}

/**
 * Matches DB channels against Kodi's PVR labels, case-insensitively.
 *
 * `name` (the CMS display name) is tried before `tvgName`, because Kodi labels
 * follow what the channel is called in Kodi ("CNN"), not the raw M3U value
 * ("US| CNN FHD"). Matching `tvgName` alone matches nothing on this data.
 */
export function matchKodiChannels(
  dbChannels: MatchableChannel[],
  kodiChannels: KodiLabel[],
): ChannelMatch[] {
  const kodiMap = new Map<string, number>()
  for (const c of kodiChannels) {
    kodiMap.set(c.label.trim().toLowerCase(), c.channelid)
  }

  const matches: ChannelMatch[] = []
  for (const channel of dbChannels) {
    const candidates = [channel.name, channel.tvgName]
    for (const candidate of candidates) {
      const key = candidate?.trim().toLowerCase()
      if (!key) continue
      const contentId = kodiMap.get(key)
      if (contentId === undefined) continue
      matches.push({
        id: channel.id,
        label: candidate as string,
        contentId,
        changed: contentId !== channel.contentId,
      })
      break
    }
  }
  return matches
}
