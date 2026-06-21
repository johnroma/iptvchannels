import { createFileRoute } from "@tanstack/react-router"
import {
  Clapperboard,
  FileCode,
  Film,
  Plus,
  RefreshCw,
  Rss,
  Tv,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export const Route = createFileRoute("/")({
  component: Home,
})

type Highlight = {
  icon: LucideIcon
  title: string
  description: string
}

const highlights: Highlight[] = [
  {
    icon: Rss,
    title: "Live M3U playlists",
    description:
      "Serve active channels and movies directly to VLC and other IPTV clients.",
  },
  {
    icon: FileCode,
    title: "Home Assistant YAML",
    description:
      "Generate per-channel play scripts for active channels in one click.",
  },
  {
    icon: RefreshCw,
    title: "Kodi sync",
    description:
      "Match channels to Kodi content IDs to keep playback metadata in sync.",
  },
]

type NavCard = {
  href: string
  icon: LucideIcon
  title: string
  description: string
  accent: string
}

const sections: { heading: string; cards: NavCard[] }[] = [
  {
    heading: "Live TV",
    cards: [
      {
        href: "/channels",
        icon: Tv,
        title: "Channels",
        description:
          "Manage live TV channels with filters, favourites, active state, Kodi sync, and YAML/M3U export.",
        accent: "text-sky-500",
      },
      {
        href: "/channels/new",
        icon: Plus,
        title: "Add Channel",
        description:
          "Create a new live TV entry with stream metadata, group, country, and export fields.",
        accent: "text-sky-500",
      },
      {
        href: "/channels/m3u",
        icon: Rss,
        title: "Channels Feed",
        description:
          "Direct live playlist at /channels/m3u for active channels. Built for VLC and IPTV clients.",
        accent: "text-sky-500",
      },
    ],
  },
  {
    heading: "Movies",
    cards: [
      {
        href: "/movies",
        icon: Film,
        title: "Movies",
        description:
          "Manage movie records from the media library, excluding series episodes, with active-state M3U export.",
        accent: "text-violet-500",
      },
      {
        href: "/movies/new",
        icon: Plus,
        title: "Add Movie",
        description:
          "Create a standalone movie with title, poster, stream URL, and grouping metadata.",
        accent: "text-violet-500",
      },
      {
        href: "/movies/m3u",
        icon: Rss,
        title: "Movies Feed",
        description:
          "Direct live playlist at /movies/m3u for active movie entries only.",
        accent: "text-violet-500",
      },
    ],
  },
  {
    heading: "Series",
    cards: [
      {
        href: "/series",
        icon: Clapperboard,
        title: "Series",
        description:
          "Manage series containers and their episode collections, including active state and export behaviour.",
        accent: "text-amber-500",
      },
      {
        href: "/series/new",
        icon: Plus,
        title: "Add Series",
        description:
          "Create a new series entry and define the episode set that belongs to it.",
        accent: "text-amber-500",
      },
    ],
  },
]

function Home() {
  return (
    <div className="space-y-10">
      <section className="max-w-3xl space-y-3">
        <p className="text-base leading-relaxed text-muted-foreground">
          This app manages live TV channels, movies, and series imported from
          M3U sources. Maintain metadata in PostgreSQL, generate Home Assistant
          YAML for active channels, sync Kodi content IDs, and serve live M3U
          playlists directly to clients such as VLC.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {highlights.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4"
          >
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        ))}
      </section>

      {sections.map(({ heading, cards }) => (
        <section
          key={heading}
          className="space-y-4"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {heading}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ href, icon: Icon, title, description, accent }) => (
              <a
                key={href}
                href={href}
                className="group rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-md border bg-background">
                    <Icon className={`size-5 ${accent}`} />
                  </span>
                  <h3 className="text-lg font-semibold group-hover:text-primary">
                    {title}
                  </h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {description}
                </p>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
