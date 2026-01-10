export type ChannelExportData = {
  scriptAlias: string | null
  name: string | null
  tvgName: string
  contentId: number | null
  tvgLogo: string | null
}

export type ExportResult = {
  yaml: string
  count: number
  skipped: { reason: string; channel: string }[]
}

export function generateHomeAssistantYaml(channels: ChannelExportData[]): ExportResult {
  const yamlLines: string[] = []
  const skipped: { reason: string; channel: string }[] = []

  for (const channel of channels) {
    const channelName = channel.name || channel.tvgName

    // Track why channels are skipped
    if (!channel.scriptAlias) {
      skipped.push({ reason: "missing scriptAlias", channel: channelName })
      continue
    }
    if (!channel.contentId) {
      skipped.push({ reason: "missing contentId", channel: channelName })
      continue
    }

    const alias = channel.name || channel.tvgName
    const title = channel.tvgName
    const thumbnail = channel.tvgLogo || ""

    yamlLines.push(`  ${channel.scriptAlias}:`)
    yamlLines.push(`    alias: "${alias}"`)
    yamlLines.push(`    icon: mdi:view-stream`)
    yamlLines.push(`    sequence:`)
    yamlLines.push(`      - service: script.play_channel`)
    yamlLines.push(`        data:`)
    yamlLines.push(`          content_id: ${channel.contentId}`)
    yamlLines.push(`          channel_title: "${title}"`)
    yamlLines.push(`          channel_thumbnail: "${thumbnail}"`)
  }

  const count = channels.length - skipped.length

  return {
    yaml:
      yamlLines.length > 0
        ? `script:\n${yamlLines.join("\n")}`
        : "# No channels with scriptAlias and contentId found",
    count,
    skipped,
  }
}
