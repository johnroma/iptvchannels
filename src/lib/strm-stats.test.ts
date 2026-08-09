import { describe, it, expect } from "vitest"
import { parseStrmStats } from "./strm-stats"

describe("parseStrmStats", () => {
  it("parses a normal run", () => {
    const stats = parseStrmStats(
      "fetched 34 active media rows -> 34 .strm files\nwritten=34 unchanged=0 removed=0\n",
    )
    expect(stats).toEqual({
      fetched: 34,
      files: 34,
      written: 34,
      unchanged: 0,
      removed: 0,
    })
  })

  it("parses an idempotent no-op run", () => {
    const stats = parseStrmStats(
      "fetched 34 active media rows -> 34 .strm files\nwritten=0 unchanged=34 removed=0\n",
    )
    expect(stats).toEqual({
      fetched: 34,
      files: 34,
      written: 0,
      unchanged: 34,
      removed: 0,
    })
  })

  it("parses output that includes dry-run/write lines", () => {
    const output = [
      "fetched 2 active media rows -> 2 .strm files",
      "  write  Movies/A (2020)/A (2020).strm",
      "  remove TV Shows/Old/Season 01/Old S01E01.strm",
      "written=1 unchanged=1 removed=1",
    ].join("\n")
    expect(parseStrmStats(output)).toEqual({
      fetched: 2,
      files: 2,
      written: 1,
      unchanged: 1,
      removed: 1,
    })
  })

  it("returns null for unrelated output", () => {
    expect(parseStrmStats("Traceback (most recent call last):")).toBeNull()
    expect(parseStrmStats("")).toBeNull()
  })
})
