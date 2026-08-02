import { createServerFn } from "@tanstack/react-start"
import { asc, isNotNull } from "drizzle-orm"
import { db, channels, channelSchema, channelUpdateSchema } from "~/db"
import { updateStreamLogic, createStreamLogic } from "./shared"
import { runKodiSync } from "./kodi"
import { getActiveChannelsYaml } from "./yaml"

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
}).handler(async () => getActiveChannelsYaml())

// ─── Kodi Sync (channel-specific) ───────────────────────────

export const syncKodiContentIds = createServerFn({ method: "POST" }).handler(
  async () => runKodiSync(),
)
