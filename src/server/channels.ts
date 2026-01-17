import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { asc, eq } from "drizzle-orm"
import { db, channels, channelSchema, channelUpdateSchema } from "~/db"

export const listChannels = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await db.query.channels.findMany({
      columns: {
        id: true,
        tvgName: true,
        name: true,
        active: true,
        favourite: true,
        countryCode: true,
      },
      orderBy: [asc(channels.createdAt)],
    })
    return result
  }
)

export const channelsQueryOptions = () =>
  queryOptions({
    queryKey: ["channels"],
    queryFn: () => listChannels(),
  })

export const getChannelById = createServerFn({ method: "GET" })
  .inputValidator((data: string) => {
    if (typeof data === "string") {
      return data
    }
    return null
  })
  .handler(async ({ data }) => {
    if (data === null) return null
    const channelData = await db.query.channels.findFirst({
      where: eq(channels.id, data),
    })

    return channelData
  })

export const updateChannelForId = createServerFn({ method: "POST" })
  .inputValidator(channelUpdateSchema)
  .handler(async ({ data }) => {
    const { id, ...updateData } = data
    const result = await db
      .update(channels)
      .set({
        ...updateData,
        tvgLogo: updateData.tvgLogo || null,
        streamUrl: updateData.streamUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(channels.id, id))
      .returning()
    return result[0]
  })

export const createChannel = createServerFn({ method: "POST" })
  .inputValidator(channelSchema)
  .handler(async ({ data }) => {
    const result = await db
      .insert(channels)
      .values({
        ...data,
        tvgLogo: data.tvgLogo || null,
        streamUrl: data.streamUrl || null,
      })
      .returning()
    return result[0]
  })

export const toggleChannelActive = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    const result = await db
      .update(channels)
      .set({ active: data.active, updatedAt: new Date() })
      .where(eq(channels.id, data.id))
      .returning({ id: channels.id, active: channels.active })
    return result[0]
  })

export const exportActiveChannelsYaml = createServerFn({
  method: "GET",
}).handler(async () => {
  const { generateHomeAssistantYaml } = await import("~/lib/yaml-export")

  const activeChannels = await db.query.channels.findMany({
    where: eq(channels.active, true),
    columns: {
      scriptAlias: true,
      name: true,
      tvgName: true,
      contentId: true,
      tvgLogo: true,
    },
    orderBy: [asc(channels.name)],
  })

  return generateHomeAssistantYaml(activeChannels)
})

export const exportActiveChannelsM3u = createServerFn({
  method: "GET",
}).handler(async () => {
  const { generateM3u } = await import("~/lib/m3u-export")

  const activeChannels = await db.query.channels.findMany({
    where: eq(channels.active, true),
    columns: {
      tvgId: true,
      tvgName: true,
      tvgLogo: true,
      groupTitle: true,
      streamUrl: true,
      name: true,
    },
    orderBy: [asc(channels.name)],
  })

  const m3u = generateM3u(activeChannels)
  return {
    m3u,
    count: activeChannels.filter((c) => c.streamUrl).length,
  }
})

interface KodiChannel {
  channelid: number
  label: string
}

interface KodiResponse {
  result: {
    channels: KodiChannel[]
  }
}

export const syncKodiContentIds = createServerFn({ method: "POST" }).handler(
  async () => {
    const host = process.env.KODI_HOST
    const port = process.env.KODI_PORT

    if (!host || !port) {
      throw new Error(
        "KODI_HOST and KODI_PORT environment variables are required"
      )
    }

    // Fetch channels from Kodi JSON-RPC API
    const kodiRequest = {
      jsonrpc: "2.0",
      method: "PVR.GetChannels",
      params: { channelgroupid: "alltv" },
      id: 1,
    }

    const kodiResponse = await fetch(`http://${host}:${port}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kodiRequest),
    })

    if (!kodiResponse.ok) {
      throw new Error(`Kodi API error: ${kodiResponse.status}`)
    }

    const kodiData = (await kodiResponse.json()) as KodiResponse

    if (!kodiData.result?.channels) {
      throw new Error("No channels returned from Kodi")
    }

    // Get all DB channels
    const dbChannels = await db.query.channels.findMany({
      columns: {
        id: true,
        tvgName: true,
        contentId: true,
      },
    })

    // Build Kodi lookup map (lowercase label -> channelid)
    const kodiMap = new Map<string, number>(
      kodiData.result.channels.map((c) => [c.label.toLowerCase(), c.channelid])
    )

    // Match and update
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
)
