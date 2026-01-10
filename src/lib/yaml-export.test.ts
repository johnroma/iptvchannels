import { describe, it, expect } from "vitest"
import { generateHomeAssistantYaml, type ChannelExportData } from "./yaml-export"

describe("generateHomeAssistantYaml", () => {
  it("generates valid YAML for channels with all required fields", () => {
    const channels: ChannelExportData[] = [
      {
        scriptAlias: "channel_abc",
        name: "ABC",
        tvgName: "US| ABC HD",
        contentId: 754,
        tvgLogo: "http://example.com/abc.png",
      },
      {
        scriptAlias: "channel_cnn",
        name: null,
        tvgName: "US| CNN",
        contentId: 2147,
        tvgLogo: "http://example.com/cnn.png",
      },
    ]

    const result = generateHomeAssistantYaml(channels)

    expect(result.count).toBe(2)
    expect(result.skipped).toHaveLength(0)
    expect(result.yaml).toContain("script:")
    expect(result.yaml).toContain("channel_abc:")
    expect(result.yaml).toContain('alias: "ABC"')
    expect(result.yaml).toContain("content_id: 754")
    expect(result.yaml).toContain("channel_cnn:")
    expect(result.yaml).toContain('alias: "US| CNN"') // Falls back to tvgName when name is null
    expect(result.yaml).toContain("content_id: 2147")
  })

  it("skips channels without scriptAlias and tracks them", () => {
    const channels: ChannelExportData[] = [
      {
        scriptAlias: null,
        name: "Missing Alias",
        tvgName: "US| Missing",
        contentId: 123,
        tvgLogo: null,
      },
    ]

    const result = generateHomeAssistantYaml(channels)

    expect(result.count).toBe(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0]).toEqual({
      reason: "missing scriptAlias",
      channel: "Missing Alias",
    })
    expect(result.yaml).toBe("# No channels with scriptAlias and contentId found")
  })

  it("skips channels without contentId and tracks them", () => {
    const channels: ChannelExportData[] = [
      {
        scriptAlias: "channel_test",
        name: "Missing ContentId",
        tvgName: "US| Test",
        contentId: null,
        tvgLogo: null,
      },
    ]

    const result = generateHomeAssistantYaml(channels)

    expect(result.count).toBe(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0]).toEqual({
      reason: "missing contentId",
      channel: "Missing ContentId",
    })
  })

  it("handles empty thumbnail gracefully", () => {
    const channels: ChannelExportData[] = [
      {
        scriptAlias: "channel_no_thumb",
        name: "No Thumbnail",
        tvgName: "US| No Thumb",
        contentId: 999,
        tvgLogo: null,
      },
    ]

    const result = generateHomeAssistantYaml(channels)

    expect(result.count).toBe(1)
    expect(result.yaml).toContain('channel_thumbnail: ""')
  })

  it("returns empty result for empty array", () => {
    const result = generateHomeAssistantYaml([])

    expect(result.count).toBe(0)
    expect(result.skipped).toHaveLength(0)
    expect(result.yaml).toBe("# No channels with scriptAlias and contentId found")
  })

  it("generates correct YAML structure matching Home Assistant format", () => {
    const channels: ChannelExportData[] = [
      {
        scriptAlias: "channel_bbc1",
        name: "BBC One",
        tvgName: "UK| BBC 1",
        contentId: 2246,
        tvgLogo: "http://example.com/bbc.png",
      },
    ]

    const result = generateHomeAssistantYaml(channels)

    const expectedYaml = `script:
  channel_bbc1:
    alias: "BBC One"
    icon: mdi:view-stream
    sequence:
      - service: script.play_channel
        data:
          content_id: 2246
          channel_title: "UK| BBC 1"
          channel_thumbnail: "http://example.com/bbc.png"`

    expect(result.yaml).toBe(expectedYaml)
  })

  it("processes mixed valid and invalid channels correctly", () => {
    const channels: ChannelExportData[] = [
      {
        scriptAlias: "channel_valid",
        name: "Valid Channel",
        tvgName: "US| Valid",
        contentId: 100,
        tvgLogo: null,
      },
      {
        scriptAlias: null, // Invalid - missing scriptAlias
        name: "Invalid 1",
        tvgName: "US| Invalid 1",
        contentId: 200,
        tvgLogo: null,
      },
      {
        scriptAlias: "channel_invalid2",
        name: "Invalid 2",
        tvgName: "US| Invalid 2",
        contentId: null, // Invalid - missing contentId
        tvgLogo: null,
      },
    ]

    const result = generateHomeAssistantYaml(channels)

    expect(result.count).toBe(1)
    expect(result.skipped).toHaveLength(2)
    expect(result.yaml).toContain("channel_valid:")
    expect(result.yaml).not.toContain("Invalid 1")
    expect(result.yaml).not.toContain("channel_invalid2")
  })
})
