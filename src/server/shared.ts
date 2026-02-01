import { z } from "zod"
import {
  eq,
  asc,
  desc,
  and,
  count,
  inArray,
  sql,
  getTableColumns,
} from "drizzle-orm"
import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import { db, channels, media, series, groupTitles } from "~/db"
import { isNull } from "drizzle-orm"

// ─── Table Registry ─────────────────────────────────────────

const tables = { channels, media, series } as const
export type TableKey = keyof typeof tables

// ─── Toggle Active ──────────────────────────────────────────

export const toggleActive = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; active: boolean; table: TableKey }) => data)
  .handler(async ({ data }) => {
    const table = tables[data.table]
    const result = await db
      .update(table)
      .set({ active: data.active, updatedAt: new Date() })
      .where(eq(table.id, data.id))
      .returning({ id: table.id, active: table.active })
    return result[0]
  })

// ─── List Streams ───────────────────────────────────────────

const listStreamSchema = z.object({
  table: z.enum(["channels", "media", "series"]),
  cursor: z.number().optional().default(0),
  limit: z.number().optional().default(100),
  sortBy: z.enum(["name", "createdAt"]).optional().default("name"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("asc"),
  groupTitleId: z.coerce.number().optional(),
  active: z.boolean().optional(),
  favourite: z.boolean().optional(),
  countries: z.array(z.string()).optional(),
})

export const listStreams = createServerFn({ method: "GET" })
  .inputValidator(listStreamSchema)
  .handler(async ({ data }) => {
    const table = tables[data.table]

    // Build filters
    const filters = []
    if (data.active !== undefined) filters.push(eq(table.active, data.active))
    if (data.favourite !== undefined)
      filters.push(eq(table.favourite, data.favourite))
    if (data.groupTitleId)
      filters.push(eq(table.groupTitleId, data.groupTitleId))
    if (data.table === "channels" && data.countries?.length) {
      filters.push(inArray(channels.countryCode, data.countries))
    }
    // For media table, only show movies (no series episodes)
    if (data.table === "media") {
      filters.push(isNull(media.seriesId))
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined

    // Count
    const [countResult] = await db
      .select({ count: count() })
      .from(table)
      .where(whereClause)
    const totalCount = countResult?.count ?? 0

    // Sort
    const sortColumn = data.sortBy === "name" ? table.name : table.createdAt
    const order =
      data.sortDirection === "desc" ? desc(sortColumn) : asc(sortColumn)

    // Fetch with JOIN for group title
    const result = await db
      .select({
        ...getTableColumns(table),
        groupTitle: sql<
          string | null
        >`COALESCE(${groupTitles.alias}, ${groupTitles.name})`,
      })
      .from(table)
      .leftJoin(groupTitles, eq(table.groupTitleId, groupTitles.id))
      .where(whereClause)
      .orderBy(order, asc(table.id))
      .limit(data.limit)
      .offset(data.cursor)

    return { data: result, totalCount }
  })

// ─── Query Options ──────────────────────────────────────────

type StreamQueryOptions = {
  page?: number
  sortBy?: "name" | "createdAt"
  sortDirection?: "asc" | "desc"
  groupTitleId?: number
  active?: boolean
  favourite?: boolean
  countries?: string[]
}

export const streamQueryOptions = (
  table: TableKey,
  options: StreamQueryOptions = {},
) => {
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
      table,
      page,
      sortBy,
      sortDirection,
      groupTitleId,
      active,
      favourite,
      countries,
    ],
    queryFn: () =>
      listStreams({
        data: {
          table,
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

// ─── Get By ID ──────────────────────────────────────────────

export const getStreamById = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string; table: TableKey }) => data)
  .handler(async ({ data }) => {
    const table = tables[data.table]
    const result = await db
      .select({
        ...getTableColumns(table),
        groupTitle: groupTitles.name,
        groupTitleAlias: groupTitles.alias,
      })
      .from(table)
      .leftJoin(groupTitles, eq(table.groupTitleId, groupTitles.id))
      .where(eq(table.id, data.id))
      .limit(1)

    return result[0] ?? null
  })

// ─── Update Logic ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateStreamLogic(tableKey: TableKey, data: any) {
  const table = tables[tableKey]
  const {
    id,
    groupTitle,
    groupTitleAlias,
    groupTitleId: inputGroupId,
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

  // Update record
  const result = await db
    .update(table)
    .set({
      ...updateData,
      groupTitleId,
      tvgLogo: updateData.tvgLogo || null,
      streamUrl: updateData.streamUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(table.id, id))
    .returning()

  const updated = result[0]
  if (!updated) return undefined

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
}

// ─── Create Logic ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createStreamLogic(tableKey: TableKey, data: any) {
  const table = tables[tableKey]
  const { groupTitle, groupTitleId: inputGroupId, ...insertData } = data

  let groupTitleId = inputGroupId
  if (!groupTitleId && groupTitle) {
    groupTitleId = await resolveGroupTitleId(groupTitle)
  }

  const result = await db
    .insert(table)
    .values({
      ...insertData,
      groupTitleId,
      tvgLogo: insertData.tvgLogo || null,
      streamUrl: insertData.streamUrl || null,
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
}

// ─── Export M3U ─────────────────────────────────────────────

export const exportActiveStreamsM3u = createServerFn({ method: "GET" })
  .inputValidator((data: { table: "channels" | "media" }) => data)
  .handler(async ({ data }) => {
    const { generateM3u } = await import("~/lib/m3u-export")
    const table = tables[data.table]

    // For media, only export movies (no series episodes)
    const exportFilter =
      data.table === "media"
        ? and(eq(table.active, true), isNull(media.seriesId))
        : eq(table.active, true)

    const activeItems = await db
      .select({
        tvgId: table.tvgId,
        tvgName: table.tvgName,
        tvgLogo: table.tvgLogo,
        streamUrl: table.streamUrl,
        name: table.name,
        groupTitle: sql<
          string | null
        >`COALESCE(${groupTitles.alias}, ${groupTitles.name})`,
      })
      .from(table)
      .leftJoin(groupTitles, eq(table.groupTitleId, groupTitles.id))
      .where(exportFilter)
      .orderBy(asc(table.name))

    const m3u = generateM3u(activeItems)
    return { m3u, count: activeItems.filter((m) => m.streamUrl).length }
  })

// ─── Group Titles ───────────────────────────────────────────

export const getGroupTitles = createServerFn({ method: "GET" })
  .inputValidator((data: { table: TableKey }) => data)
  .handler(async ({ data }) => {
    const table = tables[data.table]
    const result = await db
      .selectDistinct({
        id: groupTitles.id,
        name: groupTitles.name,
        alias: groupTitles.alias,
      })
      .from(groupTitles)
      .innerJoin(table, eq(groupTitles.id, table.groupTitleId))
      .orderBy(asc(groupTitles.name))
    return result
  })

// ─── Resolve Group Title ────────────────────────────────────

export async function resolveGroupTitleId(
  groupTitle: string | null | undefined,
): Promise<number | null> {
  if (!groupTitle) return null

  const result = await db
    .insert(groupTitles)
    .values({ name: groupTitle })
    .onConflictDoNothing({ target: groupTitles.name })
    .returning({ id: groupTitles.id })

  if (result[0]) {
    return result[0].id
  }

  const existing = await db
    .select({ id: groupTitles.id })
    .from(groupTitles)
    .where(eq(groupTitles.name, groupTitle))
    .limit(1)

  return existing[0]?.id ?? null
}
