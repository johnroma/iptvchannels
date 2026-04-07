import { COUNTRY_CODES } from "~/db/validators"

export interface M3uChannel {
  tvgId?: string | null
  tvgName: string
  tvgLogo?: string | null
  groupTitle?: string | null
  streamUrl?: string | null
  name?: string | null
  countryCode?: string | null
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
const countryNameByCode = new Map(
  COUNTRY_CODES.map((countryCode) => [
    countryCode,
    regionNames.of(countryCode) ?? countryCode,
  ]),
)

export function generateM3u(channels: M3uChannel[]): string {
  let m3u = "#EXTM3U\n"

  for (const channel of channels) {
    if (!channel.streamUrl) continue

    const tvgId = channel.tvgId ? ` tvg-id="${channel.tvgId}"` : ""
    const tvgName = ` tvg-name="${channel.tvgName}"`
    const tvgLogo = channel.tvgLogo ? ` tvg-logo="${channel.tvgLogo}"` : ""
    const resolvedGroupTitle =
      channel.countryCode && countryNameByCode.has(channel.countryCode)
        ? countryNameByCode.get(channel.countryCode)
        : channel.groupTitle
    const groupTitle = resolvedGroupTitle
      ? ` group-title="${resolvedGroupTitle}"`
      : ""
    const displayName = channel.name || channel.tvgName
    m3u += `#EXTINF:-1${tvgId}${tvgName}${tvgLogo}${groupTitle},${displayName}\n`
    m3u += `${channel.streamUrl}\n`
  }

  return m3u
}
