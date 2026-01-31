import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  uuid,
  serial,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// Group titles lookup table - normalized from channels/media
// Normalized group titles for faster lookups and cleaner data
export const groupTitles = pgTable("group_titles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // Original M3U value (e.g., "US| ENTERTAINMENT")
  alias: text("alias"), // Friendly display name (e.g. "Movies" instead of "US| MOVIES")
})

export type GroupTitle = typeof groupTitles.$inferSelect

// Channels table combining M3U data with Kodi content IDs
export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),

  // From M3U file
  tvgId: text("tvg_id"), // EPG identifier (e.g., "AandE.us")
  tvgName: text("tvg_name").notNull(), // Display name (e.g., "US| A&E HD")
  tvgLogo: text("tvg_logo"), // Logo URL
  groupTitleId: integer("group_title_id").references(() => groupTitles.id), // FK to group_titles
  streamUrl: text("stream_url"), // M3U stream URL

  // From contentid.json (Kodi)
  contentId: integer("content_id"), // Kodi channel ID for playback

  // CMS fields (editable via frontend)
  name: text("name"), // Custom display name
  countryCode: text("country_code"), // Country code (e.g., "US", "UK", "SE")
  favourite: boolean("favourite").default(false), // Mark as favourite

  // Management fields
  active: boolean("active").default(false), // Whether to include in configuration.yaml export
  scriptAlias: text("script_alias"), // Custom alias for HA script (e.g., "channel_abc")

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

// Relations for db.query with 'with'
export const channelsRelations = relations(channels, ({ one }) => ({
  groupTitle: one(groupTitles, {
    fields: [channels.groupTitleId],
    references: [groupTitles.id],
  }),
}))

// Raw database row type (internal use)
type ChannelRow = typeof channels.$inferSelect

// Channel type for application use - has resolved groupTitle instead of FK
export type Channel = ChannelRow & {
  groupTitle: string | null
  groupTitleAlias: string | null
}

// Media table for movies and series
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),

  // From M3U file
  tvgId: text("tvg_id"),
  tvgName: text("tvg_name").notNull(), // e.g., "DE - Senran Kagura (2013) (Ger Sub) S02 E11"
  tvgLogo: text("tvg_logo"), // TMDB poster URL
  groupTitleId: integer("group_title_id").references(() => groupTitles.id), // FK to group_titles
  groupTitle: text("group_title"), // e.g., "|DE| ANIME SERIEN (SUB)"
  streamUrl: text("stream_url"), // URL ending in .mp4 or .mkv

  // Parsed/derived fields
  mediaType: text("media_type"), // "movie" or "series" (derived from URL path)
  year: integer("year"), // Parsed from title, e.g., 1994
  season: integer("season"), // For series, e.g., 2
  episode: integer("episode"), // For series, e.g., 11

  // CMS fields
  name: text("name"), // Custom display name
  favourite: boolean("favourite").default(false),
  active: boolean("active").default(false),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export type Media = typeof media.$inferSelect

// Relations for media
export const mediaRelations = relations(media, ({ one }) => ({
  groupTitle: one(groupTitles, {
    fields: [media.groupTitleId],
    references: [groupTitles.id],
  }),
}))
