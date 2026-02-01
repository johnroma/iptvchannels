import { z } from "zod"
import {
  eq,
  asc,
  desc,
  and,
  count,
  sql,
  getTableColumns,
} from "drizzle-orm"
import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { db, series, media, groupTitles } from "~/db"
import { seriesSchema, seriesUpdateSchema } from "~/db/validators"
import { resolveGroupTitleId } from "./shared"

// ─── List Series ────────────────────────────────────────────

const listSeriesSchema = z.object({
  cursor: z.number().optional().default(0),
  limit: z.number().optional().default(100),
  sortBy: z.enum(["name", "createdAt"]).optional().default("name"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("asc"),
  groupTitleId: z.coerce.number().optional(),
  active: z.boolean().optional(),
  favourite: z.boolean().optional(),
})

export const listSeries = createServerFn({ method: "GET" })
  .inputValidator(listSeriesSchema)
  .handler(async ({ data }) => {
    const filters = []
    if (data.active !== undefined) filters.push(eq(series.active, data.active))
    if (data.favourite !== undefined)
      filters.push(eq(series.favourite, data.favourite))
    if (data.groupTitleId)
      filters.push(eq(series.groupTitleId, data.groupTitleId))

    const whereClause = filters.length > 0 ? and(...filters) : undefined

    const [countResult] = await db
      .select({ count: count() })
      .from(series)
      .where(whereClause)
    const totalCount = countResult?.count ?? 0

    const sortColumn = data.sortBy === "name" ? series.name : series.createdAt
    const order =
      data.sortDirection === "desc" ? desc(sortColumn) : asc(sortColumn)

    // episodeCount is a denormalized column — no subquery needed
    const result = await db
      .select({
        ...getTableColumns(series),
        groupTitle: groupTitles.name,
      })
      .from(series)
      .leftJoin(groupTitles, eq(series.groupTitleId, groupTitles.id))
      .where(whereClause)
      .orderBy(order, asc(series.id))
      .limit(data.limit)
      .offset(data.cursor)

    return { data: result, totalCount }
  })

// ─── Series Query Options ───────────────────────────────────

type SeriesQueryOpts = {
  page?: number
  sortBy?: "name" | "createdAt"
  sortDirection?: "asc" | "desc"
  groupTitleId?: number
  active?: boolean
  favourite?: boolean
}

export const seriesQueryOptions = (options: SeriesQueryOpts = {}) => {
  const {
    page = 1,
    sortBy = "name",
    sortDirection = "asc",
    groupTitleId,
    active,
    favourite,
  } = options
  return queryOptions({
    queryKey: [
      "series",
      page,
      sortBy,
      sortDirection,
      groupTitleId,
      active,
      favourite,
    ],
    queryFn: () =>
      listSeries({
        data: {
          cursor: (page - 1) * 100,
          sortBy,
          sortDirection,
          groupTitleId,
          active,
          favourite,
        },
      }),
  })
}

// ─── Get Series With Episodes ───────────────────────────────

export const getSeriesWithEpisodes = createServerFn({ method: "GET" })
  .inputValidator((data: string) => (typeof data === "string" ? data : null))
  .handler(async ({ data: id }) => {
    if (!id) return null

    const seriesResult = await db
      .select({
        ...getTableColumns(series),
        groupTitle: groupTitles.name,
        groupTitleAlias: groupTitles.alias,
      })
      .from(series)
      .leftJoin(groupTitles, eq(series.groupTitleId, groupTitles.id))
      .where(eq(series.id, id))
      .limit(1)

    const seriesRow = seriesResult[0]
    if (!seriesRow) return null

    const episodes = await db
      .select()
      .from(media)
      .where(eq(media.seriesId, id))
      .orderBy(asc(media.season), asc(media.episode))

    return { ...seriesRow, episodes }
  })

// ─── Toggle Series Active (cascade) ────────────────────────

export const toggleSeriesActive = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    const result = await db
      .update(series)
      .set({ active: data.active, updatedAt: new Date() })
      .where(eq(series.id, data.id))
      .returning({ id: series.id, active: series.active })

    // Cascade to all episodes
    await db
      .update(media)
      .set({ active: data.active, updatedAt: new Date() })
      .where(eq(media.seriesId, data.id))

    return result[0]
  })

// ─── Update Series ──────────────────────────────────────────

export const updateSeries = createServerFn({ method: "POST" })
  .inputValidator(seriesUpdateSchema)
  .handler(async ({ data }) => {
    const {
      id,
      groupTitle,
      groupTitleAlias,
      groupTitleId: inputGroupId,
      episodes,
      ...updateData
    } = data

    // Resolve Group Title ID
    let groupTitleId = inputGroupId
    if (!groupTitleId && groupTitle) {
      groupTitleId = await resolveGroupTitleId(groupTitle)
    } else if (inputGroupId === undefined && groupTitle === "") {
      groupTitleId = null
    }

    // Update Group Title Alias
    if (groupTitleId && groupTitleAlias !== undefined) {
      await db
        .update(groupTitles)
        .set({ alias: groupTitleAlias || null })
        .where(eq(groupTitles.id, groupTitleId))
    }

    // Update series record
    const result = await db
      .update(series)
      .set({
        ...updateData,
        groupTitleId,
        tvgLogo: updateData.tvgLogo || null,
        updatedAt: new Date(),
      })
      .where(eq(series.id, id))
      .returning()

    const updated = result[0]
    if (!updated) return undefined

    // Bulk episode upsert
    if (episodes) {
      // Get existing episode IDs for this series
      const existingEpisodes = await db
        .select({ id: media.id })
        .from(media)
        .where(eq(media.seriesId, id))

      const existingIds = new Set(existingEpisodes.map((e) => e.id))
      const incomingIds = new Set(
        episodes.filter((e) => e.id).map((e) => e.id as string),
      )

      // Delete episodes that are no longer in the list
      for (const existId of existingIds) {
        if (!incomingIds.has(existId)) {
          await db.delete(media).where(eq(media.id, existId))
        }
      }

      // Upsert episodes
      for (const ep of episodes) {
        if (ep.id && existingIds.has(ep.id)) {
          // Update existing
          await db
            .update(media)
            .set({
              season: ep.season ?? null,
              episode: ep.episode ?? null,
              year: ep.year ?? null,
              streamUrl: ep.streamUrl || null,
              name: ep.name || null,
              updatedAt: new Date(),
            })
            .where(eq(media.id, ep.id))
        } else {
          // Insert new
          const tvgName =
            ep.season != null && ep.episode != null
              ? `${updated.tvgName} S${String(ep.season).padStart(2, "0")} E${String(ep.episode).padStart(2, "0")}`
              : updated.tvgName
          await db.insert(media).values({
            tvgName,
            tvgLogo: updated.tvgLogo,
            groupTitleId: updated.groupTitleId,
            seriesId: id,
            mediaType: "series",
            season: ep.season ?? null,
            episode: ep.episode ?? null,
            year: ep.year ?? null,
            streamUrl: ep.streamUrl || null,
            name: ep.name || null,
            active: updated.active ?? false,
          })
        }
      }

      // Update denormalized episode count
      const [epCount] = await db
        .select({ count: count() })
        .from(media)
        .where(eq(media.seriesId, id))
      await db
        .update(series)
        .set({ episodeCount: epCount?.count ?? 0 })
        .where(eq(series.id, id))
    }

    // Fetch fresh group data
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
  })

// ─── Create Series ──────────────────────────────────────────

export const createSeries = createServerFn({ method: "POST" })
  .inputValidator(seriesSchema)
  .handler(async ({ data }) => {
    const { groupTitle, groupTitleId: inputGroupId, ...insertData } = data

    let groupTitleId = inputGroupId
    if (!groupTitleId && groupTitle) {
      groupTitleId = await resolveGroupTitleId(groupTitle)
    }

    const result = await db
      .insert(series)
      .values({
        ...insertData,
        groupTitleId,
        tvgLogo: insertData.tvgLogo || null,
      })
      .returning()

    const created = result[0]
    if (!created) return undefined

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

// ─── Export Active Series M3U ───────────────────────────────

export const exportActiveSeriesM3u = createServerFn({ method: "GET" })
  .handler(async () => {
    const { generateM3u } = await import("~/lib/m3u-export")

    // Get all episodes of active series
    const episodes = await db
      .select({
        tvgId: media.tvgId,
        tvgName: media.tvgName,
        tvgLogo: media.tvgLogo,
        streamUrl: media.streamUrl,
        name: media.name,
        groupTitle: sql<
          string | null
        >`COALESCE(${groupTitles.alias}, ${groupTitles.name})`,
      })
      .from(media)
      .innerJoin(series, eq(media.seriesId, series.id))
      .leftJoin(groupTitles, eq(series.groupTitleId, groupTitles.id))
      .where(eq(series.active, true))
      .orderBy(asc(series.name), asc(media.season), asc(media.episode))

    const m3u = generateM3u(episodes)
    return { m3u, count: episodes.filter((e) => e.streamUrl).length }
  })

// ─── Group Titles for Series ────────────────────────────────

export const getSeriesGroupTitles = createServerFn({ method: "GET" })
  .handler(async () => {
    const result = await db
      .selectDistinct({
        id: groupTitles.id,
        name: groupTitles.name,
        alias: groupTitles.alias,
      })
      .from(groupTitles)
      .innerJoin(series, eq(groupTitles.id, series.groupTitleId))
      .orderBy(asc(groupTitles.name))
    return result
  })
