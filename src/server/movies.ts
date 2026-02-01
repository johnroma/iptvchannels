import { createServerFn } from "@tanstack/react-start"
import { mediaSchema, mediaUpdateSchema } from "~/db"
import { updateStreamLogic, createStreamLogic } from "./shared"

// ─── Movie CRUD (validation wrappers) ───────────────────────

export const updateMovieForId = createServerFn({ method: "POST" })
  .inputValidator(mediaUpdateSchema)
  .handler(async ({ data }) => updateStreamLogic("media", data))

export const createMovie = createServerFn({ method: "POST" })
  .inputValidator(mediaSchema)
  .handler(async ({ data }) =>
    createStreamLogic("media", { ...data, mediaType: "movie", seriesId: null }),
  )
