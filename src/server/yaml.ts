import { asc, eq } from "drizzle-orm"
import { db, channels } from "~/db"
import { generateHomeAssistantYaml, type ExportResult } from "~/lib/yaml-export"

/**
 * Builds the Home Assistant `script:` YAML for every active channel that has
 * both a `scriptAlias` and a `contentId`. Channels missing either are reported
 * in `skipped` rather than silently dropped.
 */
export async function getActiveChannelsYaml(): Promise<ExportResult> {
  const activeChannels = await db
    .select({
      scriptAlias: channels.scriptAlias,
      name: channels.name,
      tvgName: channels.tvgName,
      contentId: channels.contentId,
      tvgLogo: channels.tvgLogo,
    })
    .from(channels)
    .where(eq(channels.active, true))
    .orderBy(asc(channels.name))

  return generateHomeAssistantYaml(activeChannels)
}
