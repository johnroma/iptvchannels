import { describe, it, expect } from "vitest"
import { resolveKodiConnection } from "./kodi-url"

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
