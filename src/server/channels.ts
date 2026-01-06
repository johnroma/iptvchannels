import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import z from "zod"
import { db } from "~/db"
import { channels } from "~/db/schema"

export const listChannels = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await db.query.channels.findMany({
      columns: { id: true, tvgName: true, name: true },
    })
    return result
  }
)

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
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string().min(6, "Name must be at least 6 characters"),
    })
  )
  .handler(async ({ data }) => {
    const result = await db
      .update(channels)
      .set({ name: data.name })
      .where(eq(channels.id, data.id))
      .returning()
    return result[0]
  })

// export const editChannelById = createServerFn({ method: "POST" })
//   .inputValidator((data: unknown) => channelInputSchema.parse(data))
//   .handler(async ({ data }) => {
//     const { id, ...updateData } = data
//     const result = await db
//       .update(channels)
//       .set(updateData)
//       .where(eq(channels.id, id))
//       .returning()
//     return result[0]
//   })
