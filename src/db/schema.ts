import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

// Channels table combining M3U data with Kodi content IDs
export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),

  // From M3U file
  tvgId: text("tvg_id"), // EPG identifier (e.g., "AandE.us")
  tvgName: text("tvg_name").notNull(), // Display name (e.g., "US| A&E HD")
  tvgLogo: text("tvg_logo"), // Logo URL
  groupTitle: text("group_title"), // Category (e.g., "US| ENTERTAINMENT")
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

// Type exports for use in the application
export type Channel = typeof channels.$inferSelect
export type NewChannel = typeof channels.$inferInsert
