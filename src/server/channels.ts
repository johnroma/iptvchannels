import { z } from "zod"
import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { asc, desc, eq, count, isNotNull, and, inArray } from "drizzle-orm"
import { db, channels, channelSchema, channelUpdateSchema } from "~/db"

const listChannelsSchema = z.object({
  cursor: z.number().optional().default(0),
  limit: z.number().optional().default(100),
  sortBy: z.enum(["name", "createdAt"]).optional().default("name"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("asc"),
  groupTitle: z.string().optional(),
  active: z.boolean().optional(),
  favourite: z.boolean().optional(),
  countries: z.array(z.string()).optional(),
})

export const listChannels = createServerFn({ method: "GET" })
  .inputValidator(listChannelsSchema)
  .handler(
    async ({
      data: {
        cursor,
        limit,
        sortBy,
        sortDirection,
        groupTitle,
        active,
        favourite,
        countries,
      },
    }) => {
      // 1. Get total count (filtered if needed)
      const filters = []
      if (groupTitle) filters.push(eq(channels.groupTitle, groupTitle))
      if (active !== undefined) filters.push(eq(channels.active, active))
      if (favourite !== undefined)
        filters.push(eq(channels.favourite, favourite))
      if (countries && countries.length > 0) {
        filters.push(inArray(channels.countryCode, countries))
      }

      const whereClause = filters.length > 0 ? and(...filters) : undefined

      const [countResult] = await db
        .select({ count: count() })
        .from(channels)
        .where(whereClause)
      const totalCount = countResult?.count ?? 0

      // 2. Determine sort order
      const sortColumn = sortBy === "name" ? channels.name : channels.createdAt
      const order =
        sortDirection === "desc" ? desc(sortColumn) : asc(sortColumn)
      // Secondary sort by ID to ensure stable pagination
      const orderBy = [order, asc(channels.id)]

      // 3. Fetch paginated data
      const result = await db.query.channels.findMany({
        where: whereClause,
        columns: {
          id: true,
          tvgName: true,
          name: true,
          active: true,
          favourite: true,
          countryCode: true,
          groupTitle: true,
        },
        orderBy: orderBy,
        limit,
        offset: cursor,
      })

      return {
        data: result,
        totalCount,
      }
    },
  )

export const getGroupTitles = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await db
      .selectDistinct({ groupTitle: channels.groupTitle })
      .from(channels)
      .where(isNotNull(channels.groupTitle))
      .orderBy(asc(channels.groupTitle))

    return result
      .map((r) => r.groupTitle)
      .filter((g): g is string => typeof g === "string")
  },
)

export const getCountryCodes = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await db
      .selectDistinct({ countryCode: channels.countryCode })
      .from(channels)
      .where(isNotNull(channels.countryCode))
      .orderBy(asc(channels.countryCode))

    return result
      .map((r) => r.countryCode)
      .filter((c): c is string => typeof c === "string")
  },
)

export const channelsQueryOptions = (
  page: number = 1,
  sortBy: "name" | "createdAt" = "createdAt",
  sortDirection: "asc" | "desc" = "asc",
  groupTitle?: string,
  active?: boolean,
  favourite?: boolean,
  countries?: string[],
) =>
  queryOptions({
    queryKey: [
      "channels",
      page,
      sortBy,
      sortDirection,
      groupTitle,
      active,
      favourite,
      countries,
    ],
    queryFn: () =>
      listChannels({
        data: {
          cursor: (page - 1) * 100,
          sortBy,
          sortDirection,
          groupTitle,
          active,
          favourite,
          countries,
        },
      }),
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

type KodiChannel = {
  channelid: number
  label: string
}

type KodiResponse = {
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
        "KODI_HOST and KODI_PORT environment variables are required",
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
      kodiData.result.channels.map((c) => [c.label.toLowerCase(), c.channelid]),
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
  },
)
