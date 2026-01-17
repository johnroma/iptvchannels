export interface M3uChannel {
  tvgId?: string | null
  tvgName: string
  tvgLogo?: string | null
  groupTitle?: string | null
  streamUrl?: string | null
  name?: string | null
}

export function generateM3u(channels: M3uChannel[]): string {
  let m3u = "#EXTM3U\n"

  for (const channel of channels) {
    if (!channel.streamUrl) continue

    const tvgId = channel.tvgId ? ` tvg-id="${channel.tvgId}"` : ""
    const tvgName = ` tvg-name="${channel.tvgName}"`
    const tvgLogo = channel.tvgLogo ? ` tvg-logo="${channel.tvgLogo}"` : ""
    const groupTitle = channel.groupTitle
      ? ` group-title="${channel.groupTitle}"`
      : ""
    m3u += `#EXTINF:-1${tvgId}${tvgName}${tvgLogo}${groupTitle},${channel.tvgName}\n`
    m3u += `${channel.streamUrl}\n`
  }

  return m3u
}
