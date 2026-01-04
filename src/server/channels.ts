import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { db } from "~/db"
import { channels } from "~/db/schema"

export const listChannels = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await db.query.channels.findMany({
      columns: { id: true, tvgName: true },
    })
    return result
  }
)

export const getChannelById = createServerFn({ method: "GET" })
  .inputValidator(({ id }) => {
    if (typeof id === "number" && !Number.isNaN(id)) {
      return id
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
