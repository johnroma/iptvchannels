import {
  createStartHandler,
  defaultStreamHandler,
  type RequestHandler,
} from "@tanstack/react-start/server"
import type { Register } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { db, channels, media } from "~/db"
import { getActiveStreamsM3u } from "~/server/m3u"
import { buildStreamUrl } from "~/lib/stream-url"

const fetch = createStartHandler(defaultStreamHandler)

export type ServerEntry = { fetch: RequestHandler<Register> }

function createM3uResponse(
  m3u: string,
  filename: string,
  disposition: "inline" | "attachment" = "inline",
) {
  return new Response(m3u, {
    headers: {
      "Content-Type": "audio/x-mpegurl; charset=utf-8",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

export function createServerEntry(entry: ServerEntry): ServerEntry {
  return {
    async fetch(request, ...args) {
      const { pathname } = new URL(request.url)

      if (request.method === "GET" && pathname === "/channels/m3u") {
        const { m3u } = await getActiveStreamsM3u("channels")
        return createM3uResponse(m3u, "channels.m3u")
      }

      if (request.method === "GET" && pathname === "/movies/m3u") {
        const { m3u } = await getActiveStreamsM3u("media")
        return createM3uResponse(m3u, "movies.m3u")
      }

      const playMatch = pathname.match(/^\/play\/(channels|media)\/([^/]+)$/)
      if (request.method === "GET" && playMatch) {
        const tableKey = playMatch[1] as "channels" | "media"
        const id = playMatch[2]
        const table = tableKey === "channels" ? channels : media
        const rows = await db.select().from(table).where(eq(table.id, id)).limit(1)
        const item = rows[0]
        if (!item?.streamUrl) {
          return new Response("Stream not found", { status: 404 })
        }
        const streamUrl = buildStreamUrl(item.streamUrl)
        if (!streamUrl) {
          return new Response("Stream URL not configured", { status: 404 })
        }
        const label = item.name ?? item.tvgName
        const logo = item.tvgLogo ?? ""
        const m3u = `#EXTM3U\n#EXTINF:-1 tvg-name="${item.tvgName}" tvg-logo="${logo}",${label}\n${streamUrl}`
        const safeFilename = label.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "_")
        return createM3uResponse(m3u, `${safeFilename}.m3u`, "attachment")
      }

      return entry.fetch(request, ...args)
    },
  }
}

export default createServerEntry({ fetch })
