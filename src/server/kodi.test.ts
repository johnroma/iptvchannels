import { afterEach, describe, expect, it, vi } from "vitest"
import { runKodiSync } from "./kodi"

const { select, update } = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn() }))
vi.mock("~/db", () => ({ db: { select, update }, channels: {} }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("Kodi connection failures", () => {
  it("preserves the original error cause without reading or updating the DB", async () => {
    const cause = new Error("mock connection refused")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause))
    await expect(runKodiSync()).rejects.toMatchObject({
      message: expect.stringContaining("Underlying error: mock connection refused"),
      cause,
    })
    expect(select).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})
