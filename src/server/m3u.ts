import { and, asc, eq, isNull, sql } from "drizzle-orm"
import { db, channels, media, groupTitles } from "~/db"
import { generateM3u } from "~/lib/m3u-export"

const exportTables = {
  channels,
  media,
} as const

export type ExportTable = keyof typeof exportTables

export async function getActiveStreamsM3u(tableKey: ExportTable) {
  const table = exportTables[tableKey]

  const exportFilter =
    tableKey === "media"
      ? and(
          eq(media.active, true),
          isNull(media.seriesId),
          eq(media.mediaType, "movie"),
        )
      : eq(channels.active, true)

  const activeItems = await db
    .select({
      tvgId: table.tvgId,
      tvgName: table.tvgName,
      tvgLogo: table.tvgLogo,
      streamUrl: table.streamUrl,
      name: table.name,
      countryCode: tableKey === "channels" ? channels.countryCode : sql<null>`NULL`,
      groupTitle: sql<
        string | null
      >`COALESCE(${groupTitles.alias}, ${groupTitles.name})`,
    })
    .from(table)
    .leftJoin(groupTitles, eq(table.groupTitleId, groupTitles.id))
    .where(exportFilter)
    .orderBy(asc(table.name))

  const m3u = generateM3u(activeItems)
  return { m3u, count: activeItems.filter((item) => item.streamUrl).length }
}
