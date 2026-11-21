import { describe, expect, it, vi } from "vitest"
import { createServerFn } from "@tanstack/react-start"
import { listStreamSchema } from "./src/server/shared"

// Do not initialize a DB merely to check the server-function contract.
vi.mock("~/db", async () => ({
  ...await import("./src/db/schema"),
  db: {},
}))

describe("server function input validation", () => {
  it("retains defaults and rejects invalid tables on the current Start API", () => {
    const schema = listStreamSchema
    expect(createServerFn({ method: "GET" }).validator(schema).options.validator)
      .toBe(schema)
    expect(schema.parse({ table: "channels" })).toMatchObject({
      table: "channels", cursor: 0, limit: 100,
      sortBy: "name", sortDirection: "asc",
    })
    expect(() => schema.parse({ table: "unknown" })).toThrow()
  })
})
