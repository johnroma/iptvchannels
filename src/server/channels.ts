import { z } from "zod"
import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { asc, desc, eq, count, isNotNull, and, inArray, sql } from "drizzle-orm"
import {
  db,
  channels,
  groupTitles,
  channelSchema,
  channelUpdateSchema,
} from "~/db"

const listChannelsSchema = z.object({
  cursor: z.number().optional().default(0),
  limit: z.number().optional().default(100),
  sortBy: z.enum(["name", "createdAt"]).optional().default("name"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("asc"),
  groupTitle: z.string().optional(),
  groupTitleId: z.coerce.number().optional(),
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
        groupTitleId,
        active,
        favourite,
        countries,
      },
    }) => {
      // 1. Build filters - groupTitle filter needs to join with lookup table
      const filters = []
      if (active !== undefined) filters.push(eq(channels.active, active))
      if (favourite !== undefined)
        filters.push(eq(channels.favourite, favourite))
      if (countries && countries.length > 0) {
        filters.push(inArray(channels.countryCode, countries))
      }
      // Filter by group title name (from lookup table)
      if (groupTitle) {
        filters.push(eq(groupTitles.name, groupTitle))
      }
      // Filter by group title ID (faster than joining on name)
      if (groupTitleId) {
        filters.push(eq(channels.groupTitleId, groupTitleId))
      }

      const whereClause = filters.length > 0 ? and(...filters) : undefined

      // 2. Get total count with JOIN for group filter
      const countQueryBase = db
        .select({ count: count() })
        .from(channels)
        .$dynamic()

      const countQuery = groupTitle
        ? countQueryBase.leftJoin(
            groupTitles,
            eq(channels.groupTitleId, groupTitles.id),
          )
        : countQueryBase

      const [countResult] = await countQuery.where(whereClause)
      const totalCount = countResult?.count ?? 0

      // 3. Determine sort order
      const sortColumn = sortBy === "name" ? channels.name : channels.createdAt
      const order =
        sortDirection === "desc" ? desc(sortColumn) : asc(sortColumn)

      // 4. Fetch paginated data with JOIN to get group title
      const result = await db
        .select({
          id: channels.id,
          tvgId: channels.tvgId,
          tvgName: channels.tvgName,
          tvgLogo: channels.tvgLogo,
          name: channels.name,
          streamUrl: channels.streamUrl,
          contentId: channels.contentId,
          active: channels.active,
          favourite: channels.favourite,
          countryCode: channels.countryCode,
          scriptAlias: channels.scriptAlias,
          createdAt: channels.createdAt,
          updatedAt: channels.updatedAt,
          groupTitleId: channels.groupTitleId,
          // Use alias if set, otherwise name
          groupTitle: sql<
            string | null
          >`COALESCE(${groupTitles.alias}, ${groupTitles.name})`,
        })
        .from(channels)
        .leftJoin(groupTitles, eq(channels.groupTitleId, groupTitles.id))
        .where(whereClause)
        .orderBy(order, asc(channels.id))
        .limit(limit)
        .offset(cursor)

      return {
        data: result,
        totalCount,
      }
    },
  )

export const getGroupTitles = createServerFn({ method: "GET" }).handler(
  async () => {
    // Query lookup table directly - much faster than DISTINCT scan
    const result = await db
      .select({
        id: groupTitles.id,
        name: groupTitles.name,
        alias: groupTitles.alias,
      })
      .from(groupTitles)
      .orderBy(asc(groupTitles.name))

    // Return full object so frontend can use ID for filtering and Alias for display
    return result
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

type ChannelsQueryOptions = {
  page?: number
  sortBy?: "name" | "createdAt"
  sortDirection?: "asc" | "desc"
  groupTitleId?: number
  active?: boolean
  favourite?: boolean
  countries?: string[]
}

export const channelsQueryOptions = (options: ChannelsQueryOptions = {}) => {
  const {
    page = 1,
    sortBy = "createdAt",
    sortDirection = "asc",
    groupTitleId,
    active,
    favourite,
    countries,
  } = options
  return queryOptions({
    queryKey: [
      "channels",
      page,
      sortBy,
      sortDirection,
      groupTitleId,
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
          groupTitleId,
          active,
          favourite,
          countries,
        },
      }),
  })
}

export const getChannelById = createServerFn({ method: "GET" })
  .inputValidator((data: string) => {
    if (typeof data === "string") {
      return data
    }
    return null
  })
  .handler(async ({ data }) => {
    if (data === null) return null

    // Use JOIN to get group title name/alias
    const result = await db
      .select({
        id: channels.id,
        tvgId: channels.tvgId,
        tvgName: channels.tvgName,
        tvgLogo: channels.tvgLogo,
        streamUrl: channels.streamUrl,
        contentId: channels.contentId,
        name: channels.name,
        countryCode: channels.countryCode,
        favourite: channels.favourite,
        active: channels.active,
        scriptAlias: channels.scriptAlias,
        createdAt: channels.createdAt,
        updatedAt: channels.updatedAt,
        groupTitleId: channels.groupTitleId,
        // Resolve FK to string for frontend
        groupTitle: groupTitles.name,
        groupTitleAlias: groupTitles.alias,
      })
      .from(channels)
      .leftJoin(groupTitles, eq(channels.groupTitleId, groupTitles.id))
      .where(eq(channels.id, data))
      .limit(1)

    return result[0] ?? null
  })

// Helper to resolve groupTitle string to FK (upserts if needed)
async function resolveGroupTitleId(
  groupTitle: string | null | undefined,
): Promise<number | null> {
  if (!groupTitle) return null

  // Upsert: insert if not exists, return id
  const result = await db
    .insert(groupTitles)
    .values({ name: groupTitle })
    .onConflictDoNothing({ target: groupTitles.name })
    .returning({ id: groupTitles.id })

  // If insert succeeded, use that id
  if (result[0]) {
    return result[0].id
  }

  // Otherwise, fetch existing
  const existing = await db
    .select({ id: groupTitles.id })
    .from(groupTitles)
    .where(eq(groupTitles.name, groupTitle))
    .limit(1)

  return existing[0]?.id ?? null
}

export const updateChannelLogic = async (
  data: z.infer<typeof channelUpdateSchema>,
) => {
  const {
    id,
    groupTitle,
    groupTitleAlias,
    groupTitleId: inputGroupId,
    ...updateData
  } = data

  // 1. Resolve Group Title ID
  let groupTitleId = inputGroupId
  if (!groupTitleId && groupTitle) {
    groupTitleId = await resolveGroupTitleId(groupTitle)
  } else if (inputGroupId === undefined && groupTitle === "") {
    // Handle clearing the group title
    groupTitleId = null
  }

  // 2. Update Group Title Alias if ID and Alias are provided
  if (groupTitleId && groupTitleAlias !== undefined) {
    await db
      .update(groupTitles)
      .set({ alias: groupTitleAlias || null })
      .where(eq(groupTitles.id, groupTitleId))
  }

  // 3. Update Channel Data
  const result = await db
    .update(channels)
    .set({
      ...updateData,
      groupTitleId,
      tvgLogo: updateData.tvgLogo || null,
      streamUrl: updateData.streamUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(channels.id, id))
    .returning()

  const updated = result[0]
  if (!updated) {
    return undefined
  }

  // 4. Fetch fresh group data for the response
  const groupData = updated.groupTitleId
    ? await db
        .select({
          groupTitle: groupTitles.name,
          groupTitleAlias: groupTitles.alias,
        })
        .from(groupTitles)
        .where(eq(groupTitles.id, updated.groupTitleId))
        .limit(1)
    : []

  return {
    ...updated,
    groupTitle: groupData[0]?.groupTitle ?? null,
    groupTitleAlias: groupData[0]?.groupTitleAlias ?? null,
  }
}

export const updateChannelForId = createServerFn({ method: "POST" })
  .inputValidator(channelUpdateSchema)
  .handler(async ({ data }) => {
    return updateChannelLogic(data)
  })

export const createChannel = createServerFn({ method: "POST" })
  .inputValidator(channelSchema)
  .handler(async ({ data }) => {
    const { groupTitle, groupTitleId: inputGroupId, ...insertData } = data

    // Use ID if provided, otherwise resolve string
    let groupTitleId = inputGroupId
    if (!groupTitleId && groupTitle) {
      groupTitleId = await resolveGroupTitleId(groupTitle)
    }

    const result = await db
      .insert(channels)
      .values({
        ...insertData,
        groupTitleId,
        tvgLogo: insertData.tvgLogo || null,
        streamUrl: insertData.streamUrl || null,
      })
      .returning()

    const created = result[0]
    if (!created) return undefined

    // Fetch groupTitle name and alias for response
    const groupData = created.groupTitleId
      ? await db
          .select({
            groupTitle: groupTitles.name,
            groupTitleAlias: groupTitles.alias,
          })
          .from(groupTitles)
          .where(eq(groupTitles.id, created.groupTitleId))
          .limit(1)
      : []

    return {
      ...created,
      groupTitle: groupData[0]?.groupTitle ?? null,
      groupTitleAlias: groupData[0]?.groupTitleAlias ?? null,
    }
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

  const activeChannels = await db
    .select({
      scriptAlias: channels.scriptAlias,
      name: channels.name,
      tvgName: channels.tvgName,
      contentId: channels.contentId,
      tvgLogo: channels.tvgLogo,
    })
    .from(channels)
    .where(eq(channels.active, true))
    .orderBy(asc(channels.name))

  return generateHomeAssistantYaml(activeChannels)
})

export const exportActiveChannelsM3u = createServerFn({
  method: "GET",
}).handler(async () => {
  const { generateM3u } = await import("~/lib/m3u-export")

  const activeChannels = await db
    .select({
      tvgId: channels.tvgId,
      tvgName: channels.tvgName,
      tvgLogo: channels.tvgLogo,
      streamUrl: channels.streamUrl,
      name: channels.name,
      // Use alias if set, otherwise original name
      groupTitle: sql<
        string | null
      >`COALESCE(${groupTitles.alias}, ${groupTitles.name})`,
    })
    .from(channels)
    .leftJoin(groupTitles, eq(channels.groupTitleId, groupTitles.id))
    .where(eq(channels.active, true))
    .orderBy(asc(channels.name))

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
