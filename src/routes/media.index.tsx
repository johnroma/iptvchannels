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
  streamQueryOptions,
  getGroupTitles,
  exportActiveStreamsM3u,
} from "~/server/shared"
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
import { ListStream } from "~/components/ListStream"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

const groupTitlesQueryOptions = {
  queryKey: ["groupTitles", "media"],
  queryFn: () => getGroupTitles({ data: { table: "media" } }),
}

const mediaSearchSchema = z.object({
  page: z.number().optional().default(1),
  active: z.boolean().optional(),
  favourite: z.boolean().optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  groupTitleId: z.coerce.number().optional(),
})

export const Route = createFileRoute("/media/")({
  validateSearch: (search) => mediaSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    page: search.page,
    sortDirection: search.sortDirection,
    groupTitleId: search.groupTitleId,
    active: search.active,
    favourite: search.favourite,
  }),
  loader: async ({ context, deps }) => {
    const sortDirection = deps.sortDirection ?? "asc"
    await Promise.all([
      context.queryClient.ensureQueryData(
        streamQueryOptions("media", {
          page: deps.page,
          sortBy: "name",
          sortDirection,
          groupTitleId: deps.groupTitleId,
          active: deps.active,
          favourite: deps.favourite,
        }),
      ),
      context.queryClient.ensureQueryData(groupTitlesQueryOptions),
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
  const page = search.page
  const sortDirection = search.sortDirection ?? "asc"
  const groupFilterEnabled = search.groupTitleId !== undefined

  const { data: groupTitles } = useSuspenseQuery(groupTitlesQueryOptions)

  const { data: mediaData, isFetching } = useQuery({
    ...streamQueryOptions("media", {
      page,
      sortBy: "name",
      sortDirection,
      groupTitleId: search.groupTitleId,
      active: search.active,
      favourite: search.favourite,
    }),
    placeholderData: keepPreviousData,
  })

  const allMedia = mediaData?.data ?? []
  const totalCount = mediaData?.totalCount ?? 0
  const totalPages = Math.ceil(totalCount / 100)

  const exportM3uMutation = useMutation({
    mutationFn: () => exportActiveStreamsM3u({ data: { table: "media" } }),
    onSuccess: (result) => {
      if (result.count === 0) {
        alert("No active media with stream URLs found to export.")
        return
      }
      downloadFile(result.m3u, "media.m3u", "text/plain")
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
            onClick={() => exportM3uMutation.mutate()}
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
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-bold">Media List</div>
        <div className="text-sm text-muted-foreground">
          Showing {allMedia.length} of {totalCount} media
          {isFetching && <span className="ml-2">(Updating...)</span>}
        </div>
      </div>

      {allMedia.length === 0 ? (
        <div>No media found.</div>
      ) : (
        <ul className="space-y-2">
          {allMedia.map((item) => (
            <ListStream
              key={item.id}
              item={item}
              editHref={`/edit-media/${item.id}`}
              queryKey="media"
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
