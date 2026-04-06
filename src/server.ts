import {
  createStartHandler,
  defaultStreamHandler,
  type RequestHandler,
} from "@tanstack/react-start/server"
import type { Register } from "@tanstack/react-router"
import { getActiveStreamsM3u } from "~/server/m3u"

const fetch = createStartHandler(defaultStreamHandler)

export type ServerEntry = { fetch: RequestHandler<Register> }

function createM3uResponse(m3u: string, filename: string) {
  return new Response(m3u, {
    headers: {
      "Content-Type": "audio/x-mpegurl; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
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

      return entry.fetch(request, ...args)
    },
  }
}

export default createServerEntry({ fetch })
