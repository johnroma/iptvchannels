import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: Home,
})

function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-3 max-w-4xl">
        <p className="text-base text-muted-foreground">
          This app manages live TV channels, movies, and series imported from
          M3U sources. It lets you maintain metadata in PostgreSQL, generate
          Home Assistant YAML for active channels, sync Kodi content IDs, and
          serve live M3U playlists directly to clients such as VLC.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Home</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Overview of the system, export behaviour, and what each navigation
            item is for.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Channels</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage live TV channels, filters, favourites, active state, Kodi
            sync, YAML export, and downloadable M3U export.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Channels M3U URL</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Direct live playlist feed at <code>/channels/m3u</code> for active
            channels. Intended for VLC and other IPTV clients.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Add Channel</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a new live TV entry with stream metadata, group, country,
            aliases, and export-related fields.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Movies</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage movie records from the media library. This view excludes
            series episodes and supports active-state M3U export.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Movies M3U URL</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Direct live playlist feed at <code>/movies/m3u</code> for active
            movie entries only.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Add Movie</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a standalone movie in the media library with title, poster,
            stream URL, and grouping metadata.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Series</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage series containers and their episode collections, including
            active state and export behaviour for episode playlists.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Add Series</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a new series entry and define the episode set that belongs to
            it.
          </p>
        </div>
      </section>
    </div>
  )
}
