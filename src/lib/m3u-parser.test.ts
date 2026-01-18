import { describe, it, expect } from "vitest"
import {
  parseExtInf,
  isMediaUrl,
  parseMediaType,
  parseYear,
  parseSeasonEpisode,
  isValidEntry,
  parseChannel,
  parseMedia,
  parseM3uContent,
} from "./m3u-parser"

describe("parseExtInf", () => {
  it("parses all attributes from EXTINF line", () => {
    const line =
      '#EXTINF:-1 tvg-id="CNN.us" tvg-name="US| CNN HD" tvg-logo="https://example.com/cnn.png" group-title="US| NEWS",US| CNN HD'

    const result = parseExtInf(line)

    expect(result.tvgId).toBe("CNN.us")
    expect(result.tvgName).toBe("US| CNN HD")
    expect(result.tvgLogo).toBe("https://example.com/cnn.png")
    expect(result.groupTitle).toBe("US| NEWS")
  })

  it("handles empty attributes", () => {
    const line =
      '#EXTINF:-1 tvg-id="" tvg-name="Test Channel" tvg-logo="" group-title="",Test Channel'

    const result = parseExtInf(line)

    expect(result.tvgId).toBe(null)
    expect(result.tvgName).toBe("Test Channel")
    expect(result.tvgLogo).toBe(null)
    expect(result.groupTitle).toBe(null)
  })

  it("handles missing attributes", () => {
    const line = '#EXTINF:-1 tvg-name="Minimal",Minimal'

    const result = parseExtInf(line)

    expect(result.tvgId).toBe(null)
    expect(result.tvgName).toBe("Minimal")
    expect(result.tvgLogo).toBe(null)
    expect(result.groupTitle).toBe(null)
  })
})

describe("isMediaUrl", () => {
  it("returns true for .mp4 URLs", () => {
    expect(isMediaUrl("http://example.com/movie/123.mp4")).toBe(true)
  })

  it("returns true for .mkv URLs", () => {
    expect(isMediaUrl("http://example.com/series/456.mkv")).toBe(true)
  })

  it("returns false for stream URLs", () => {
    expect(isMediaUrl("http://example.com/live/channel.ts")).toBe(false)
    expect(isMediaUrl("http://example.com/live/stream")).toBe(false)
  })
})

describe("parseMediaType", () => {
  it("returns movie for /movie/ URLs", () => {
    expect(parseMediaType("http://example.com/movie/user/pass/123.mp4")).toBe(
      "movie"
    )
  })

  it("returns series for /series/ URLs", () => {
    expect(parseMediaType("http://example.com/series/user/pass/456.mkv")).toBe(
      "series"
    )
  })

  it("returns null for unknown URLs", () => {
    expect(parseMediaType("http://example.com/other/123.mp4")).toBe(null)
  })
})

describe("parseYear", () => {
  it("extracts year from title", () => {
    expect(parseYear("The Shawshank Redemption (1994)")).toBe(1994)
    expect(parseYear("Inception (2010)")).toBe(2010)
  })

  it("returns null when no year present", () => {
    expect(parseYear("Some Title Without Year")).toBe(null)
  })

  it("extracts first year when multiple present", () => {
    expect(parseYear("Movie (2020) - Remastered (2023)")).toBe(2020)
  })
})

describe("parseSeasonEpisode", () => {
  it("parses S02 E11 format", () => {
    const result = parseSeasonEpisode("Show Name S02 E11")
    expect(result.season).toBe(2)
    expect(result.episode).toBe(11)
  })

  it("parses S02E11 format (no space)", () => {
    const result = parseSeasonEpisode("Show Name S02E11")
    expect(result.season).toBe(2)
    expect(result.episode).toBe(11)
  })

  it("parses lowercase s01e05", () => {
    const result = parseSeasonEpisode("Show Name s01e05")
    expect(result.season).toBe(1)
    expect(result.episode).toBe(5)
  })

  it("handles 3-digit episodes", () => {
    const result = parseSeasonEpisode("Long Show S10 E150")
    expect(result.season).toBe(10)
    expect(result.episode).toBe(150)
  })

  it("returns nulls when no season/episode", () => {
    const result = parseSeasonEpisode("Movie Title (2020)")
    expect(result.season).toBe(null)
    expect(result.episode).toBe(null)
  })
})

describe("isValidEntry", () => {
  it("returns true for valid channel entry", () => {
    const entry = {
      extinf:
        '#EXTINF:-1 tvg-id="CNN.us" tvg-name="US| CNN HD" tvg-logo="" group-title="NEWS",US| CNN HD',
      url: "http://example.com/live/cnn.ts",
    }
    expect(isValidEntry(entry)).toBe(true)
  })

  it("returns true for valid media entry", () => {
    const entry = {
      extinf:
        '#EXTINF:-1 tvg-id="" tvg-name="Movie (2020)" tvg-logo="" group-title="MOVIES",Movie (2020)',
      url: "http://example.com/movie/123.mp4",
    }
    expect(isValidEntry(entry)).toBe(true)
  })

  it("returns false when EXTINF missing", () => {
    const entry = {
      extinf: "Some random line",
      url: "http://example.com/stream",
    }
    expect(isValidEntry(entry)).toBe(false)
  })

  it("returns false when URL invalid", () => {
    const entry = {
      extinf: '#EXTINF:-1 tvg-name="Test",Test',
      url: "not-a-url",
    }
    expect(isValidEntry(entry)).toBe(false)
  })

  it("returns false when tvg-name empty", () => {
    const entry = {
      extinf: '#EXTINF:-1 tvg-name="" tvg-id="test",',
      url: "http://example.com/stream",
    }
    expect(isValidEntry(entry)).toBe(false)
  })
})

describe("parseChannel", () => {
  it("parses valid channel entry", () => {
    const entry = {
      extinf:
        '#EXTINF:-1 tvg-id="BBC1.uk" tvg-name="UK| BBC One" tvg-logo="https://example.com/bbc.png" group-title="UK| ENTERTAINMENT",UK| BBC One',
      url: "http://example.com/live/bbc1.ts",
    }

    const result = parseChannel(entry)

    expect(result).not.toBe(null)
    expect(result?.tvgId).toBe("BBC1.uk")
    expect(result?.tvgName).toBe("UK| BBC One")
    expect(result?.streamUrl).toBe("http://example.com/live/bbc1.ts")
  })

  it("returns null for media URL", () => {
    const entry = {
      extinf: '#EXTINF:-1 tvg-name="Movie",Movie',
      url: "http://example.com/movie/123.mp4",
    }
    expect(parseChannel(entry)).toBe(null)
  })

  it("returns null for invalid entry", () => {
    const entry = {
      extinf: "Invalid line",
      url: "http://example.com/stream",
    }
    expect(parseChannel(entry)).toBe(null)
  })
})

describe("parseMedia", () => {
  it("parses movie entry", () => {
    const entry = {
      extinf:
        '#EXTINF:-1 tvg-id="" tvg-name="EX - The Shawshank Redemption (1994)" tvg-logo="https://tmdb.org/poster.jpg" group-title="|EXYU| MOVIES",EX - The Shawshank Redemption (1994)',
      url: "http://example.com/movie/user/pass/1808354.mkv",
    }

    const result = parseMedia(entry)

    expect(result).not.toBe(null)
    expect(result?.tvgName).toBe("EX - The Shawshank Redemption (1994)")
    expect(result?.mediaType).toBe("movie")
    expect(result?.year).toBe(1994)
    expect(result?.season).toBe(null)
    expect(result?.episode).toBe(null)
  })

  it("parses series entry", () => {
    const entry = {
      extinf:
        '#EXTINF:-1 tvg-id="" tvg-name="DE - Senran Kagura (2013) (Ger Sub) S02 E11" tvg-logo="https://tmdb.org/poster.jpg" group-title="|DE| ANIME",DE - Senran Kagura (2013) (Ger Sub) S02 E11',
      url: "http://example.com/series/user/pass/1136293.mkv",
    }

    const result = parseMedia(entry)

    expect(result).not.toBe(null)
    expect(result?.mediaType).toBe("series")
    expect(result?.year).toBe(2013)
    expect(result?.season).toBe(2)
    expect(result?.episode).toBe(11)
  })

  it("returns null for channel URL", () => {
    const entry = {
      extinf: '#EXTINF:-1 tvg-name="Channel",Channel',
      url: "http://example.com/live/stream.ts",
    }
    expect(parseMedia(entry)).toBe(null)
  })
})

describe("parseM3uContent", () => {
  const mockM3u = `#EXTM3U
#EXTINF:-1 tvg-id="CNN.us" tvg-name="US| CNN HD" tvg-logo="https://example.com/cnn.png" group-title="US| NEWS",US| CNN HD
http://example.com/live/cnn.ts
#EXTINF:-1 tvg-id="BBC1.uk" tvg-name="UK| BBC One" tvg-logo="https://example.com/bbc1.png" group-title="UK| ENTERTAINMENT",UK| BBC One
http://example.com/live/bbc1.ts
#EXTINF:-1 tvg-id="" tvg-name="Invalid Channel No URL" tvg-logo="" group-title="TEST"
#EXTINF:-1 tvg-id="" tvg-name="EX - The Shawshank Redemption (1994)" tvg-logo="https://image.tmdb.org/poster.jpg" group-title="|EXYU| MOVIES",EX - The Shawshank Redemption (1994)
http://example.com/movie/user/pass/1808354.mkv
#EXTINF:-1 tvg-id="" tvg-name="DE - Show S02 E11" tvg-logo="https://tmdb.org/poster.jpg" group-title="|DE| SERIES",DE - Show S02 E11
http://example.com/series/user/pass/1136293.mkv`

  it("parses channels only and stops at first media", () => {
    const result = parseM3uContent(mockM3u, "channels")

    expect(result.channels.length).toBe(2)
    expect(result.media.length).toBe(0)
    expect(result.skipped).toBe(1) // Invalid channel
    expect(result.stoppedAtLine).toBeDefined()
  })

  it("parses media only", () => {
    const result = parseM3uContent(mockM3u, "media")

    expect(result.channels.length).toBe(0)
    expect(result.media.length).toBe(2)
    expect(result.media[0].mediaType).toBe("movie")
    expect(result.media[1].mediaType).toBe("series")
  })

  it("parses all content", () => {
    const result = parseM3uContent(mockM3u, "all")

    expect(result.channels.length).toBe(2)
    expect(result.media.length).toBe(2)
    expect(result.skipped).toBe(1)
  })

  it("handles empty content", () => {
    const result = parseM3uContent("")

    expect(result.channels.length).toBe(0)
    expect(result.media.length).toBe(0)
    expect(result.skipped).toBe(0)
  })

  it("handles orphan URLs (URL without EXTINF)", () => {
    const content = `#EXTM3U
http://example.com/orphan.ts
#EXTINF:-1 tvg-name="Valid",Valid
http://example.com/valid.ts`

    const result = parseM3uContent(content, "all")

    expect(result.channels.length).toBe(1)
    expect(result.channels[0].tvgName).toBe("Valid")
  })

  it("handles orphan EXTINF (EXTINF without URL)", () => {
    const content = `#EXTM3U
#EXTINF:-1 tvg-name="Orphan",Orphan
#EXTINF:-1 tvg-name="Valid",Valid
http://example.com/valid.ts`

    const result = parseM3uContent(content, "all")

    expect(result.channels.length).toBe(1)
    expect(result.skipped).toBe(1)
  })
})
