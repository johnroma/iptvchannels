import { createServerFn } from "@tanstack/react-start"
import { mediaSchema, mediaUpdateSchema } from "~/db"
import { updateStreamLogic, createStreamLogic } from "./shared"

// ─── Media CRUD (validation wrappers) ───────────────────────

export const updateMediaForId = createServerFn({ method: "POST" })
  .inputValidator(mediaUpdateSchema)
  .handler(async ({ data }) => updateStreamLogic("media", data))

export const createMedia = createServerFn({ method: "POST" })
  .inputValidator(mediaSchema)
  .handler(async ({ data }) => createStreamLogic("media", data))
