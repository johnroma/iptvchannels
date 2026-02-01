/**
 * M3U Parser for seed operations
 * Parses M3U entries into channel or media objects
 */

export interface ParsedChannel {
  tvgId: string | null
  tvgName: string
  tvgLogo: string | null
  groupTitle: string | null
  streamUrl: string
}

export interface ParsedMedia extends ParsedChannel {
  mediaType: "movie" | "series" | null
  year: number | null
  season: number | null
  episode: number | null
  seriesBaseName: string | null
}

export interface M3uEntry {
  extinf: string
  url: string
}

/**
 * Parse attributes from an EXTINF line
 */
export function parseExtInf(line: string): Omit<ParsedChannel, "streamUrl"> {
  const getAttr = (key: string): string | null => {
    const match = line.match(new RegExp(`${key}="([^"]*)"`))
    return match?.[1] || null
  }

  return {
    tvgId: getAttr("tvg-id") || null,
    tvgName: getAttr("tvg-name") || "",
    tvgLogo: getAttr("tvg-logo") || null,
    groupTitle: getAttr("group-title") || null,
  }
}

/**
 * Check if a URL is for media (movie/series) vs live channel
 */
export function isMediaUrl(url: string): boolean {
  return url.endsWith(".mp4") || url.endsWith(".mkv")
}

/**
 * Determine media type from URL path
 */
export function parseMediaType(url: string): "movie" | "series" | null {
  if (url.includes("/movie/")) return "movie"
  if (url.includes("/series/")) return "series"
  return null
}

/**
 * Parse year from title like "The Shawshank Redemption (1994)"
 */
export function parseYear(title: string): number | null {
  const match = title.match(/\((\d{4})\)/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Strip SXX EXX suffix to get the series base name
 * e.g., "DE - Senran Kagura (2013) (Ger Sub) S02 E11" → "DE - Senran Kagura (2013) (Ger Sub)"
 */
export function parseSeriesBaseName(title: string): string {
  return title.replace(/\s*[Ss]\d{1,4}\s*[Ee]\d{1,4}\s*$/, "").trim()
}

/**
 * Parse season/episode from title like "S02 E11", "S02E11", or "S2024 E6942"
 */
export function parseSeasonEpisode(title: string): {
  season: number | null
  episode: number | null
} {
  const match = title.match(/[Ss](\d{1,4})\s*[Ee](\d{1,4})/)
  if (match) {
    return {
      season: parseInt(match[1], 10),
      episode: parseInt(match[2], 10),
    }
  }
  return { season: null, episode: null }
}

/**
 * Validate an M3U entry pair (EXTINF line + URL line)
 */
export function isValidEntry(entry: M3uEntry): boolean {
  // Must have EXTINF line starting with #EXTINF:
  if (!entry.extinf.startsWith("#EXTINF:")) return false

  // Must have URL starting with http
  if (!entry.url.startsWith("http")) return false

  // Must have tvg-name
  const parsed = parseExtInf(entry.extinf)
  if (!parsed.tvgName) return false

  return true
}

/**
 * Parse an M3U entry into a channel object
 */
export function parseChannel(entry: M3uEntry): ParsedChannel | null {
  if (!isValidEntry(entry)) return null
  if (isMediaUrl(entry.url)) return null

  const info = parseExtInf(entry.extinf)
  return {
    ...info,
    streamUrl: entry.url,
  }
}

/**
 * Parse an M3U entry into a media object
 */
export function parseMedia(entry: M3uEntry): ParsedMedia | null {
  if (!isValidEntry(entry)) return null
  if (!isMediaUrl(entry.url)) return null

  const info = parseExtInf(entry.extinf)
  const { season, episode } = parseSeasonEpisode(info.tvgName)
  const mediaType = parseMediaType(entry.url)

  return {
    ...info,
    streamUrl: entry.url,
    mediaType,
    year: parseYear(info.tvgName),
    season,
    episode,
    seriesBaseName:
      mediaType === "series" && season !== null
        ? parseSeriesBaseName(info.tvgName)
        : null,
  }
}

export interface ParseResult {
  channels: ParsedChannel[]
  media: ParsedMedia[]
  skipped: number
  stoppedAtLine?: number
}

/**
 * Parse M3U content into channels and media
 * @param content - Full M3U file content
 * @param mode - "channels" stops at first media, "media" only parses media, "all" parses both
 */
export function parseM3uContent(
  content: string,
  mode: "channels" | "media" | "all" = "all"
): ParseResult {
  const lines = content.split(/\r?\n/)
  const channels: ParsedChannel[] = []
  const media: ParsedMedia[] = []
  let skipped = 0
  let stoppedAtLine: number | undefined

  let currentExtInf: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    if (line.startsWith("#EXTINF:")) {
      // If we had a pending EXTINF without a URL, count as skipped
      if (currentExtInf !== null) {
        skipped++
      }
      currentExtInf = line
      continue
    }

    if (line.startsWith("http") && currentExtInf !== null) {
      const entry: M3uEntry = { extinf: currentExtInf, url: line }

      if (isMediaUrl(line)) {
        // This is media
        if (mode === "channels") {
          // Stop at first media entry
          stoppedAtLine = i + 1
          currentExtInf = null // Don't count this as skipped
          break
        }

        if (mode === "media" || mode === "all") {
          const parsed = parseMedia(entry)
          if (parsed) {
            media.push(parsed)
          } else {
            skipped++
          }
        }
      } else {
        // This is a channel
        if (mode === "channels" || mode === "all") {
          const parsed = parseChannel(entry)
          if (parsed) {
            channels.push(parsed)
          } else {
            skipped++
          }
        }
      }

      currentExtInf = null
      continue
    }

    // Any other non-comment line without a pending EXTINF or not starting with http
    if (!line.startsWith("#") && currentExtInf !== null) {
      // Invalid URL line
      skipped++
      currentExtInf = null
    }
  }

  // Count any trailing EXTINF without URL
  if (currentExtInf !== null) {
    skipped++
  }

  return { channels, media, skipped, stoppedAtLine }
}
