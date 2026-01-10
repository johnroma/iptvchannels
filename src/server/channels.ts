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

export const exportActiveChannelsYaml = createServerFn({ method: "GET" }).handler(
  async () => {
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
  }
)
