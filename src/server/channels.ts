import { createServerFn } from "@tanstack/react-start"
import { asc, eq, isNotNull } from "drizzle-orm"
import { db, channels, channelSchema, channelUpdateSchema } from "~/db"
import { updateStreamLogic, createStreamLogic } from "./shared"

// ─── Channel CRUD (validation wrappers) ─────────────────────

export const updateChannelForId = createServerFn({ method: "POST" })
  .inputValidator(channelUpdateSchema)
  .handler(async ({ data }) => updateStreamLogic("channels", data))

export const createChannel = createServerFn({ method: "POST" })
  .inputValidator(channelSchema)
  .handler(async ({ data }) => createStreamLogic("channels", data))

// ─── Country Codes ──────────────────────────────────────────

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

// ─── YAML Export (channel-specific) ─────────────────────────

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

// ─── Kodi Sync (channel-specific) ───────────────────────────

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
  },
)
