import { z } from "zod"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { channelsQueryOptions } from "~/server/channels"
import { Checkbox } from "@ui/components/checkbox"
import { Label } from "@ui/components/label"
import { Button } from "@ui/components/button"
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

function RouteComponent() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(channelsQueryOptions())

  const uniqueCountries = [...new Set(data.map((c) => c.countryCode).filter(Boolean))].sort() as string[]

  const filteredChannels = data.filter((channel) => {
    if (search.active && !channel.active) return false
    if (search.favourite && !channel.favourite) return false
    if (search.countries?.length && !search.countries.includes(channel.countryCode ?? "")) return false
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
      </div>

      {uniqueCountries.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
          <span className="text-sm font-medium">Countries:</span>
          {uniqueCountries.map((country) => (
            <div key={country} className="flex items-center space-x-1">
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
              <Label htmlFor={`country-${country}`} className="text-sm">{country}</Label>
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
