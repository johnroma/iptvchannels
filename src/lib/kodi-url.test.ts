import { describe, it, expect } from "vitest"
import {
  matchKodiChannels,
  resolveKodiConnection,
  type MatchableChannel,
} from "./kodi-url"

describe("resolveKodiConnection", () => {
  it("defaults to localhost:8080 when nothing is configured", () => {
    expect(resolveKodiConnection({}).url).toBe("http://localhost:8080/jsonrpc")
  })

  it("assembles the URL from host and port", () => {
    expect(
      resolveKodiConnection({ KODI_HOST: "192.168.86.44", KODI_PORT: "8080" })
        .url,
    ).toBe("http://192.168.86.44:8080/jsonrpc")
  })

  it("prefers KODI_URL over host/port", () => {
    expect(
      resolveKodiConnection({
        KODI_URL: "http://kodi.local:9090",
        KODI_HOST: "192.168.86.44",
        KODI_PORT: "8080",
      }).url,
    ).toBe("http://kodi.local:9090/jsonrpc")
  })

  it("does not double-append /jsonrpc, with or without a trailing slash", () => {
    expect(
      resolveKodiConnection({ KODI_URL: "http://kodi.local:8080/jsonrpc" }).url,
    ).toBe("http://kodi.local:8080/jsonrpc")
    expect(
      resolveKodiConnection({ KODI_URL: "http://kodi.local:8080/jsonrpc/" }).url,
    ).toBe("http://kodi.local:8080/jsonrpc")
    expect(
      resolveKodiConnection({ KODI_URL: "http://kodi.local:8080/" }).url,
    ).toBe("http://kodi.local:8080/jsonrpc")
  })

  it("ignores blank env values (empty vars are set but unused)", () => {
    const { url, headers, authenticated } = resolveKodiConnection({
      KODI_URL: "  ",
      KODI_HOST: "  ",
      KODI_PORT: "",
      KODI_USER: "",
      KODI_PASSWORD: "",
    })
    expect(url).toBe("http://localhost:8080/jsonrpc")
    expect(authenticated).toBe(false)
    expect(headers.Authorization).toBeUndefined()
  })

  it("adds a Basic auth header when KODI_USER is set", () => {
    const { headers, authenticated } = resolveKodiConnection({
      KODI_USER: "kodi",
      KODI_PASSWORD: "s3cret",
    })
    expect(authenticated).toBe(true)
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("kodi:s3cret").toString("base64")}`,
    )
  })

  it("allows an empty password", () => {
    const { headers } = resolveKodiConnection({ KODI_USER: "kodi" })
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("kodi:").toString("base64")}`,
    )
  })

  it("always sends the JSON content type", () => {
    expect(resolveKodiConnection({}).headers["Content-Type"]).toBe(
      "application/json",
    )
  })
})

describe("matchKodiChannels", () => {
  // Real shape from this deployment: Kodi labels are the CMS display name,
  // not the raw M3U tvg-name.
  const kodi = [
    { channelid: 18, label: "CNN" },
    { channelid: 12, label: "France 2" },
    { channelid: 9, label: "SVT1" },
  ]

  const channel = (over: Partial<MatchableChannel>): MatchableChannel => ({
    id: "id-1",
    name: null,
    tvgName: "US| SOMETHING",
    contentId: null,
    ...over,
  })

  it("matches on name when tvgName is the raw M3U value", () => {
    const matches = matchKodiChannels(
      [channel({ id: "a", name: "CNN", tvgName: "US| CNN FHD" })],
      kodi,
    )
    expect(matches).toEqual([
      { id: "a", label: "CNN", contentId: 18, changed: true },
    ])
  })

  it("still matches on tvgName when name is unset", () => {
    const matches = matchKodiChannels(
      [channel({ id: "b", name: null, tvgName: "SVT1" })],
      kodi,
    )
    expect(matches[0]).toMatchObject({ id: "b", contentId: 9 })
  })

  it("prefers name over tvgName when both match different Kodi channels", () => {
    const matches = matchKodiChannels(
      [channel({ id: "c", name: "CNN", tvgName: "SVT1" })],
      kodi,
    )
    expect(matches[0].contentId).toBe(18)
  })

  it("is case- and whitespace-insensitive", () => {
    const matches = matchKodiChannels(
      [channel({ id: "d", name: "  france 2 " })],
      kodi,
    )
    expect(matches[0].contentId).toBe(12)
  })

  it("flags changed=false when contentId already matches", () => {
    const matches = matchKodiChannels(
      [channel({ id: "e", name: "CNN", contentId: 18 })],
      kodi,
    )
    expect(matches[0].changed).toBe(false)
  })

  it("returns no match for unknown channels and ignores blank names", () => {
    expect(
      matchKodiChannels(
        [
          channel({ id: "f", name: "Not In Kodi", tvgName: "US| NOPE" }),
          channel({ id: "g", name: "   ", tvgName: "US| ALSO NOPE" }),
        ],
        kodi,
      ),
    ).toEqual([])
  })

  it("matches each DB channel at most once", () => {
    const matches = matchKodiChannels(
      [channel({ id: "h", name: "CNN", tvgName: "CNN" })],
      kodi,
    )
    expect(matches).toHaveLength(1)
  })
})
