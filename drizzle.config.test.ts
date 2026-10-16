import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("Drizzle schema filter", () => {
  it.each([undefined, "", "   ", "public", " PUBLIC "])(
    "omits the filter for the default namespace (%s)",
    async (schema) => {
      vi.stubEnv("DB_SCHEMA", schema)
      vi.resetModules()
      const { default: config } = await import("./drizzle.config")

      expect(config).not.toHaveProperty("schemaFilter")
    },
  )

  it("filters to the trimmed custom namespace", async () => {
    vi.stubEnv("DB_SCHEMA", " iptvchannels ")
    vi.resetModules()
    const { default: config } = await import("./drizzle.config")

    expect(config.schemaFilter).toEqual(["iptvchannels"])
  })
})
