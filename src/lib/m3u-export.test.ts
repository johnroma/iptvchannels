import { describe, it, expect } from "vitest"
import { generateM3u, type M3uChannel } from "./m3u-export"

describe("generateM3u", () => {
  it("generates a valid M3U file with all fields", () => {
    const channels: M3uChannel[] = [
      {
        tvgId: "AandE.us",
        tvgName: "US| A&E HD",
        tvgLogo: "http://example.com/logo1.png",
        groupTitle: "US| ENTERTAINMENT",
        streamUrl: "http://example.com/stream1",
        name: "A&E",
      },
      {
        tvgId: "US-ABC HD Boston",
        tvgName: "US| ABC HD",
        tvgLogo: "http://example.com/logo2.png",
        groupTitle: "US| ENTERTAINMENT",
        streamUrl: "http://example.com/stream2",
        name: null,
      },
    ]

    const result = generateM3u(channels)

    expect(result).toMatch(/^#EXTM3U\n/)
    expect(result).toContain(
      '#EXTINF:-1 tvg-id="AandE.us" tvg-name="US| A&E HD" tvg-logo="http://example.com/logo1.png" group-title="US| ENTERTAINMENT",US| A&E HD'
    )
    expect(result).toContain("http://example.com/stream1\n")
    expect(result).toContain(
      '#EXTINF:-1 tvg-id="US-ABC HD Boston" tvg-name="US| ABC HD" tvg-logo="http://example.com/logo2.png" group-title="US| ENTERTAINMENT",US| ABC HD'
    )
    expect(result).toContain("http://example.com/stream2\n")
  })

  it("skips channels without streamUrl", () => {
    const channels: M3uChannel[] = [
      {
        tvgName: "No Stream",
        streamUrl: null,
      },
      {
        tvgName: "With Stream",
        streamUrl: "http://example.com/stream",
      },
    ]

    const result = generateM3u(channels)

    expect(result).not.toContain("No Stream")
    expect(result).toContain("With Stream")
    expect(result).toContain("http://example.com/stream")
  })

  it("handles missing optional fields gracefully", () => {
    const channels: M3uChannel[] = [
      {
        tvgName: "Minimal Channel",
        streamUrl: "http://example.com/minimal",
      },
    ]

    const result = generateM3u(channels)

    expect(result).toBe(
      '#EXTM3U\n#EXTINF:-1 tvg-name="Minimal Channel",Minimal Channel\nhttp://example.com/minimal\n'
    )
  })

  it("returns only header for empty array", () => {
    const result = generateM3u([])
    expect(result).toBe("#EXTM3U\n")
  })
})
