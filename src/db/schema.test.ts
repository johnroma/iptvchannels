import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import { getTableConfig } from "drizzle-orm/pg-core"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("table namespace configuration", () => {
  it.each([
    [undefined, undefined],
    ["", undefined],
    ["   ", undefined],
    ["public", undefined],
    [" PUBLIC ", undefined],
    [" iptvchannels ", "iptvchannels"],
  ])("preserves table metadata for DB_SCHEMA=%s", async (schema, namespace) => {
    vi.stubEnv("DB_SCHEMA", schema)
    vi.resetModules()
    const { channels, groupTitles, media, series } = await import("./schema")

    const tables = [groupTitles, channels, series, media]
    expect(tables.map((table) => getTableConfig(table).name)).toEqual([
      "group_titles", "channels", "series", "media",
    ])
    expect(tables.map((table) => getTableConfig(table).schema)).toEqual(
      tables.map(() => namespace),
    )
    expect(tables.map((table) => getTableConfig(table).columns.length)).toEqual([
      3, 14, 11, 16,
    ])
    expect(tables.map((table) => getTableConfig(table).indexes.length)).toEqual([
      0, 4, 4, 5,
    ])
    expect(tables.map((table) => getTableConfig(table).foreignKeys.length)).toEqual([
      0, 1, 1, 2,
    ])
    for (const table of tables) {
      for (const foreignKey of getTableConfig(table).foreignKeys) {
        expect(getTableConfig(foreignKey.reference().foreignTable).schema).toBe(namespace)
      }
    }

    expectTypeOf<typeof channels.$inferSelect>().toHaveProperty("id").toEqualTypeOf<string>()
    expectTypeOf<typeof channels.$inferSelect>().toHaveProperty("active").toEqualTypeOf<boolean | null>()
    expectTypeOf<typeof series.$inferSelect>().toHaveProperty("episodeCount").toEqualTypeOf<number>()
    expectTypeOf<typeof media.$inferSelect>().toHaveProperty("seriesId").toEqualTypeOf<string | null>()
  })
})
