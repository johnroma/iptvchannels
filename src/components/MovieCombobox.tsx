import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ChevronsUpDown, Search } from "lucide-react"
import { Button } from "@ui/components/button"
import { Input } from "@ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@ui/components/popover"
import { searchStreams } from "~/server/shared"

type SearchResult = {
  id: string
  name: string | null
  tvgName: string
}

function displayLabel(item: SearchResult): string {
  return item.name || item.tvgName
}

export function MovieCombobox() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["search", "media", query],
    queryFn: () =>
      searchStreams({ data: { table: "media", query, limit: 30 } }),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  })

  function handleSelect(id: string) {
    setOpen(false)
    setQuery("")
    navigate({ to: `/edit-movie/${id}` })
  }

  return (
    <div className="flex items-center space-x-2 border-l pl-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              role="combobox"
              aria-expanded={open}
              className="w-56 justify-between"
            />
          }
        >
          <Search className="mr-1 h-4 w-4 shrink-0 text-muted-foreground" />
          Search movies...
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="flex h-9 items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 opacity-50" />
            <Input
              placeholder="Type a movie name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 w-full border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
            {isFetching ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : query.trim().length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters.
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No movies found.
              </div>
            ) : (
              results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="truncate">{displayLabel(item)}</span>
                  {item.name && item.tvgName !== item.name && (
                    <span className="ml-auto truncate text-xs text-muted-foreground">
                      {item.tvgName}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
