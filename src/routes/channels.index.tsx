import { z } from "zod"
import {
  useMutation,
  useQuery,
  useSuspenseQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  channelsQueryOptions,
  getGroupTitles,
  getCountryCodes,
  exportActiveChannelsYaml,
  exportActiveChannelsM3u,
  syncKodiContentIds,
} from "~/server/channels"
import { Checkbox } from "@ui/components/checkbox"
import { Label } from "@ui/components/label"
import { Button } from "@ui/components/button"
import { Spinner } from "@ui/components/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/select"
import { ChannelRow } from "~/components/ChannelRow"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

const groupTitlesQueryOptions = {
  queryKey: ["groupTitles"],
  queryFn: () => getGroupTitles(),
}

const countryCodesQueryOptions = {
  queryKey: ["countryCodes"],
  queryFn: () => getCountryCodes(),
}

const channelsSearchSchema = z.object({
  page: z.number().optional().default(1),
  active: z.boolean().optional(),
  favourite: z.boolean().optional(),
  // TanStack Router's built-in parser handles comma-separated arrays
  // Incoming: "GR,IR" → transform to ["GR","IR"]
  countries: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => {
      if (typeof val === "string") {
        return val.split(",").filter(Boolean)
      }
      return val
    })
    .optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  groupTitleId: z.coerce.number().optional(),
})

export const Route = createFileRoute("/channels/")({
  validateSearch: (search) => channelsSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    page: search.page,
    sortDirection: search.sortDirection,
    groupTitleId: search.groupTitleId,
    active: search.active,
    favourite: search.favourite,
    countries: search.countries,
  }),
  loader: async ({ context, deps }) => {
    const sortDirection = deps.sortDirection ?? "asc"
    await Promise.all([
      context.queryClient.ensureQueryData(
        channelsQueryOptions({
          page: deps.page,
          sortBy: "name",
          sortDirection,
          groupTitleId: deps.groupTitleId,
          active: deps.active,
          favourite: deps.favourite,
          countries: deps.countries,
        }),
      ),
      context.queryClient.ensureQueryData(groupTitlesQueryOptions),
      context.queryClient.ensureQueryData(countryCodesQueryOptions),
    ])
  },
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
  const page = search.page
  const sortDirection = search.sortDirection ?? "asc"
  const groupFilterEnabled = search.groupTitleId !== undefined

  const { data: groupTitles } = useSuspenseQuery(groupTitlesQueryOptions)
  const { data: countryCodes } = useSuspenseQuery(countryCodesQueryOptions)

  const { data: channelsData, isFetching } = useQuery({
    ...channelsQueryOptions({
      page,
      sortBy: "name",
      sortDirection,
      groupTitleId: search.groupTitleId,
      active: search.active,
      favourite: search.favourite,
      countries: search.countries,
    }),
    placeholderData: keepPreviousData,
  })

  const allChannels = channelsData?.data ?? []
  const totalCount = channelsData?.totalCount ?? 0
  const totalPages = Math.ceil(totalCount / 100)

  const exportYamlMutation = useMutation({
    mutationFn: exportActiveChannelsYaml,
    onSuccess: (result) => {
      if (result.count === 0) {
        const reasons = result.skipped
          .map((s) => `• ${s.channel}: ${s.reason}`)
          .join("\n")
        alert(
          `No channels exported.\n\nChannels need both 'scriptAlias' and 'contentId' to be exported.\n\nSkipped channels:\n${reasons || "No active channels found"}`,
        )
        return
      }

      downloadFile(result.yaml, "channels.yaml", "text/yaml")

      if (result.skipped.length > 0) {
        const reasons = result.skipped
          .map((s) => `• ${s.channel}: ${s.reason}`)
          .join("\n")
        alert(
          `Exported ${result.count} channel(s).\n\nSkipped ${result.skipped.length} channel(s):\n${reasons}`,
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
          `Skipped (no match): ${result.skipped}`,
      )
    },
    onError: (error) => {
      alert(`Kodi sync failed: ${error.message}`)
    },
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
                  page: 1,
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
                  page: 1,
                  favourite: checked === true ? true : undefined,
                }),
              })
            }}
          />
          <Label htmlFor="favourite">Favourite only</Label>
        </div>

        <div className="flex items-center space-x-2 border-l pl-4">
          <Checkbox
            id="groupFilter"
            checked={groupFilterEnabled}
            onCheckedChange={(checked) => {
              const firstGroup = groupTitles[0]
              navigate({
                search: (prev) => ({
                  ...prev,
                  page: 1,
                  groupTitleId: checked ? firstGroup?.id : undefined,
                }),
              })
            }}
          />
          <Label htmlFor="groupFilter">Group:</Label>
          <Select
            value={search.groupTitleId?.toString() ?? ""}
            onValueChange={(value) => {
              navigate({
                search: (prev) => ({
                  ...prev,
                  page: 1,
                  groupTitleId: value ? parseInt(value, 10) : undefined,
                }),
              })
            }}
            disabled={!groupFilterEnabled}
          >
            <SelectTrigger
              size="sm"
              className="w-48"
            >
              <SelectValue placeholder="Select group" />
            </SelectTrigger>
            <SelectContent>
              {groupTitles.map((group) => (
                <SelectItem
                  key={group.id}
                  value={group.id.toString()}
                >
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2 border-l pl-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigate({
                search: (prev) => ({
                  ...prev,
                  page: 1,
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

      {countryCodes.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
          <span className="text-sm font-medium">Countries:</span>
          {countryCodes.map((country) => (
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
                        page: 1,
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

      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-bold">Channel List</div>
        <div className="text-sm text-muted-foreground">
          Showing {allChannels.length} of {totalCount} channels
          {isFetching && <span className="ml-2">(Updating...)</span>}
        </div>
      </div>

      {allChannels.length === 0 ? (
        <div>No channels found.</div>
      ) : (
        <ul className="space-y-2">
          {allChannels.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: 1 }) })
            }
            disabled={page === 1 || isFetching}
            title="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: page - 1 }) })
            }
            disabled={page === 1 || isFetching}
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-24 text-center">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: page + 1 }) })
            }
            disabled={page === totalPages || isFetching}
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: totalPages }) })
            }
            disabled={page === totalPages || isFetching}
            title="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
