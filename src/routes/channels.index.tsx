import { z } from "zod"
import {
  useMutation,
  useSuspenseQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  channelsQueryOptions,
  exportActiveChannelsYaml,
  exportActiveChannelsM3u,
  syncKodiContentIds,
} from "~/server/channels"
import { Checkbox } from "@ui/components/checkbox"
import { Label } from "@ui/components/label"
import { Button } from "@ui/components/button"
import { Spinner } from "@ui/components/spinner"
import { ChannelRow } from "~/components/ChannelRow"

const channelsSearchSchema = z.object({
  active: z.boolean().optional(),
  favourite: z.boolean().optional(),
  countries: z.array(z.string().length(2)).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
})

export const Route = createFileRoute("/channels/")({
  validateSearch: (search) => channelsSearchSchema.parse(search),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(channelsQueryOptions()),
  component: RouteComponent,
})

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function RouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(channelsQueryOptions())

  const exportYamlMutation = useMutation({
    mutationFn: exportActiveChannelsYaml,
    onSuccess: (result) => {
      if (result.count === 0) {
        const reasons = result.skipped
          .map((s) => `• ${s.channel}: ${s.reason}`)
          .join("\n")
        alert(
          `No channels exported.\n\nChannels need both 'scriptAlias' and 'contentId' to be exported.\n\nSkipped channels:\n${reasons || "No active channels found"}`
        )
        return
      }

      downloadFile(result.yaml, "channels.yaml", "text/yaml")

      if (result.skipped.length > 0) {
        const reasons = result.skipped
          .map((s) => `• ${s.channel}: ${s.reason}`)
          .join("\n")
        alert(
          `Exported ${result.count} channel(s).\n\nSkipped ${result.skipped.length} channel(s):\n${reasons}`
        )
      }
    },
  })

  const exportM3uMutation = useMutation({
    mutationFn: exportActiveChannelsM3u,
    onSuccess: (result) => {
      if (result.count === 0) {
        alert("No active channels with stream URLs found to export.")
        return
      }
      downloadFile(result.m3u, "channels.m3u", "text/plain")
    },
  })

  const syncKodiMutation = useMutation({
    mutationFn: syncKodiContentIds,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] })
      alert(
        `Kodi sync complete!\n\n` +
          `Total DB channels: ${result.total}\n` +
          `Kodi channels: ${result.kodiChannels}\n` +
          `Matched: ${result.matched}\n` +
          `Updated: ${result.updated}\n` +
          `Skipped (no match): ${result.skipped}`
      )
    },
    onError: (error) => {
      alert(`Kodi sync failed: ${error.message}`)
    },
  })

  const uniqueCountries = [
    ...new Set(data.map((c) => c.countryCode).filter(Boolean)),
  ].sort() as string[]

  const filteredChannels = data.filter((channel) => {
    if (search.active && !channel.active) return false
    if (search.favourite && !channel.favourite) return false
    if (
      search.countries?.length &&
      !search.countries.includes(channel.countryCode ?? "")
    )
      return false
    return true
  })

  const sortDirection = search.sortDirection ?? "asc"
  const sortedChannels = [...filteredChannels].sort((a, b) => {
    const nameA = (a.name || a.tvgName).toLowerCase()
    const nameB = (b.name || b.tvgName).toLowerCase()
    const comparison = nameA.localeCompare(nameB)
    return sortDirection === "desc" ? -comparison : comparison
  })

  return (
    <div className="p-4">
      <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="active"
            checked={!!search.active}
            onCheckedChange={(checked) => {
              navigate({
                search: (prev) => ({
                  ...prev,
                  active: checked === true ? true : undefined,
                }),
              })
            }}
          />
          <Label htmlFor="active">Active only</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="favourite"
            checked={!!search.favourite}
            onCheckedChange={(checked) => {
              navigate({
                search: (prev) => ({
                  ...prev,
                  favourite: checked === true ? true : undefined,
                }),
              })
            }}
          />
          <Label htmlFor="favourite">Favourite only</Label>
        </div>

        <div className="flex items-center space-x-2 border-l pl-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigate({
                search: (prev) => ({
                  ...prev,
                  sortDirection: sortDirection === "asc" ? "desc" : "asc",
                }),
              })
            }}
          >
            Name {sortDirection === "asc" ? "A-Z" : "Z-A"}
          </Button>
        </div>

        <div className="flex items-center space-x-2 pl-4 ml-auto gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportM3uMutation.mutate(undefined)}
            disabled={exportM3uMutation.isPending}
          >
            {exportM3uMutation.isPending ? (
              <>
                <Spinner className="mr-2" />
                Exporting...
              </>
            ) : (
              "Export M3U"
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncKodiMutation.mutate(undefined)}
            disabled={syncKodiMutation.isPending}
          >
            {syncKodiMutation.isPending ? (
              <>
                <Spinner className="mr-2" />
                Syncing...
              </>
            ) : (
              "Sync Kodi"
            )}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => exportYamlMutation.mutate(undefined)}
            disabled={exportYamlMutation.isPending}
          >
            {exportYamlMutation.isPending ? (
              <>
                <Spinner className="mr-2" />
                Exporting...
              </>
            ) : (
              "Export YAML"
            )}
          </Button>
        </div>
      </div>

      {uniqueCountries.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
          <span className="text-sm font-medium">Countries:</span>
          {uniqueCountries.map((country) => (
            <div
              key={country}
              className="flex items-center space-x-1"
            >
              <Checkbox
                id={`country-${country}`}
                checked={search.countries?.includes(country) ?? false}
                onCheckedChange={(checked) => {
                  navigate({
                    search: (prev) => {
                      const current = prev.countries ?? []
                      const updated = checked
                        ? [...current, country]
                        : current.filter((c) => c !== country)
                      return {
                        ...prev,
                        countries: updated.length > 0 ? updated : undefined,
                      }
                    },
                  })
                }}
              />
              <Label
                htmlFor={`country-${country}`}
                className="text-sm"
              >
                {country}
              </Label>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 text-xl font-bold">Channel List</div>

      {sortedChannels.length === 0 ? (
        <div>No channels found.</div>
      ) : (
        <ul className="space-y-2">
          {sortedChannels.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
