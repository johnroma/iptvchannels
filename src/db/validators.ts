import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"
import { channels } from "./schema"

// Base schema derived from Drizzle - single source of truth
const baseSchema = createInsertSchema(channels)

// Channel form schema - omit auto-generated fields, add custom validation
export const channelSchema = baseSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    // Override with custom validation messages
    tvgName: z.string().min(1, { error: "Display name is required" }),
    tvgLogo: z.union([z.url(), z.literal("")]).optional().nullable(),
    streamUrl: z.union([z.url(), z.literal("")]).optional().nullable(),
    countryCode: z
      .string()
      .max(2, { error: "Country code must be 2 characters" })
      .optional()
      .nullable(),
  })

// Update schema includes the id
export const channelUpdateSchema = channelSchema.extend({
  id: z.uuid(),
})
