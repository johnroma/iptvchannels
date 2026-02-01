import { FormEvent, useState, useEffect } from "react"
import { useServerFn } from "@tanstack/react-start"
import { type Series } from "~/db/schema"
import { Button } from "@ui/components/button"
import { Input } from "@ui/components/input"
import { Label } from "@ui/components/label"
import { Switch } from "@ui/components/switch"
import { updateSeries, createSeries } from "~/server/series"
import { Trash2, Plus } from "lucide-react"

type EpisodeRow = {
  id?: string
  season: number | null
  episode: number | null
  year: number | null
  streamUrl: string
  name: string
}

type EpisodeData = {
  id: string
  season: number | null
  episode: number | null
  year: number | null
  streamUrl: string | null
  name: string | null
}

type SeriesWithEpisodes = Series & {
  episodes?: EpisodeData[]
}

type SeriesFormProps =
  | {
      mode: "edit"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      series: SeriesWithEpisodes & { episodes: any[] }
      onSeriesSave?: (series: Series) => void
    }
  | {
      mode: "create"
      series?: never
      onSeriesSave?: (series: Series) => void
    }

const defaultFormData = {
  tvgId: "",
  tvgName: "",
  tvgLogo: "",
  groupTitle: "",
  groupTitleAlias: "",
  name: "",
  favourite: false,
  active: false,
}

const defaultEpisode: EpisodeRow = {
  season: null,
  episode: null,
  year: null,
  streamUrl: "",
  name: "",
}

function toEpisodeRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  episodes: any[],
): EpisodeRow[] {
  return episodes.map((ep) => ({
    id: ep.id,
    season: ep.season,
    episode: ep.episode,
    year: ep.year,
    streamUrl: ep.streamUrl || "",
    name: ep.name || "",
  }))
}

export function SeriesForm(props: Readonly<SeriesFormProps>) {
  const { mode, onSeriesSave } = props
  const seriesItem = mode === "edit" ? props.series : undefined

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const updateSeriesFn = useServerFn(updateSeries)
  const createSeriesFn = useServerFn(createSeries)

  const [formData, setFormData] = useState(() => {
    if (seriesItem) {
      return {
        tvgId: seriesItem.tvgId || "",
        tvgName: seriesItem.tvgName,
        tvgLogo: seriesItem.tvgLogo || "",
        groupTitle: seriesItem.groupTitle || "",
        groupTitleAlias: seriesItem.groupTitleAlias || "",
        name: seriesItem.name || "",
        favourite: seriesItem.favourite ?? false,
        active: seriesItem.active ?? false,
      }
    }
    return defaultFormData
  })

  const [episodes, setEpisodes] = useState<EpisodeRow[]>(() => {
    if (seriesItem?.episodes) {
      return toEpisodeRows(seriesItem.episodes)
    }
    return []
  })

  useEffect(() => {
    if (seriesItem) {
      setFormData({
        tvgId: seriesItem.tvgId || "",
        tvgName: seriesItem.tvgName,
        tvgLogo: seriesItem.tvgLogo || "",
        groupTitle: seriesItem.groupTitle || "",
        groupTitleAlias: seriesItem.groupTitleAlias || "",
        name: seriesItem.name || "",
        favourite: seriesItem.favourite ?? false,
        active: seriesItem.active ?? false,
      })
      if (seriesItem.episodes) {
        setEpisodes(toEpisodeRows(seriesItem.episodes))
      }
    }
  }, [seriesItem])

  function updateField<K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K],
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  function updateEpisode<K extends keyof EpisodeRow>(
    index: number,
    field: K,
    value: EpisodeRow[K],
  ) {
    setEpisodes((prev) =>
      prev.map((ep, i) => (i === index ? { ...ep, [field]: value } : ep)),
    )
  }

  function addEpisode() {
    setEpisodes((prev) => [...prev, { ...defaultEpisode }])
  }

  function removeEpisode(index: number) {
    setEpisodes((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const episodesData = episodes.map((ep) => ({
        id: ep.id,
        season: ep.season,
        episode: ep.episode,
        year: ep.year,
        streamUrl: ep.streamUrl || null,
        name: ep.name || null,
      }))

      let result: Series | undefined
      if (mode === "edit" && seriesItem) {
        result = (await updateSeriesFn({
          data: {
            id: seriesItem.id,
            ...formData,
            groupTitleAlias: formData.groupTitleAlias || null,
            episodes: episodesData,
          },
        })) as Series | undefined
      } else {
        const { groupTitleAlias: _alias, ...createData } = formData
        result = (await createSeriesFn({
          data: createData,
        })) as Series | undefined
      }
      setIsLoading(false)
      if (result) onSeriesSave?.(result)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("An unexpected error occurred")
      }
      setIsLoading(false)
    }
  }

  const buttonText = mode === "edit" ? "Save Changes" : "Create Series"
  const loadingText = mode === "edit" ? "Saving..." : "Creating..."

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Series-Level Fields */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">
          Series Info
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tvgName">Series Name *</Label>
            <Input
              id="tvgName"
              value={formData.tvgName}
              onChange={(e) => updateField("tvgName", e.target.value)}
              placeholder="e.g., DE - Senran Kagura (2013) (Ger Sub)"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tvgId">TVG ID</Label>
            <Input
              id="tvgId"
              value={formData.tvgId}
              onChange={(e) => updateField("tvgId", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupTitle">Group/Category</Label>
            <Input
              id="groupTitle"
              value={formData.groupTitle}
              onChange={(e) => updateField("groupTitle", e.target.value)}
              placeholder="e.g., |DE| ANIME SERIEN"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupTitleAlias">Group Alias</Label>
            <Input
              id="groupTitleAlias"
              value={formData.groupTitleAlias}
              onChange={(e) => updateField("groupTitleAlias", e.target.value)}
              placeholder="e.g., Anime Series"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tvgLogo">Poster URL</Label>
            <Input
              id="tvgLogo"
              type="url"
              value={formData.tvgLogo}
              onChange={(e) => updateField("tvgLogo", e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Custom Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Override display name"
            />
          </div>
        </div>
      </fieldset>

      {/* Toggles */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">
          Status
        </legend>

        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="favourite"
              checked={formData.favourite}
              onCheckedChange={(checked) => updateField("favourite", checked)}
            />
            <Label htmlFor="favourite">Favourite</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => updateField("active", checked)}
            />
            <Label htmlFor="active">Active (include in export)</Label>
          </div>
        </div>
      </fieldset>

      {/* Episodes Table (edit mode only) */}
      {mode === "edit" && (
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-muted-foreground">
            Episodes ({episodes.length})
          </legend>

          {episodes.length > 0 && (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Season</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Episode
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Year</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Stream URL
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Episode Title
                    </th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {episodes.map((ep, idx) => (
                    <tr
                      key={ep.id ?? `new-${idx}`}
                      className="border-t"
                    >
                      <td className="px-3 py-1">
                        <Input
                          type="number"
                          value={ep.season ?? ""}
                          onChange={(e) =>
                            updateEpisode(
                              idx,
                              "season",
                              e.target.value
                                ? parseInt(e.target.value, 10)
                                : null,
                            )
                          }
                          className="w-20"
                          min={0}
                        />
                      </td>
                      <td className="px-3 py-1">
                        <Input
                          type="number"
                          value={ep.episode ?? ""}
                          onChange={(e) =>
                            updateEpisode(
                              idx,
                              "episode",
                              e.target.value
                                ? parseInt(e.target.value, 10)
                                : null,
                            )
                          }
                          className="w-20"
                          min={0}
                        />
                      </td>
                      <td className="px-3 py-1">
                        <Input
                          type="number"
                          value={ep.year ?? ""}
                          onChange={(e) =>
                            updateEpisode(
                              idx,
                              "year",
                              e.target.value
                                ? parseInt(e.target.value, 10)
                                : null,
                            )
                          }
                          className="w-24"
                          min={1888}
                          max={2100}
                        />
                      </td>
                      <td className="px-3 py-1">
                        <Input
                          type="url"
                          value={ep.streamUrl}
                          onChange={(e) =>
                            updateEpisode(idx, "streamUrl", e.target.value)
                          }
                          placeholder="https://..."
                        />
                      </td>
                      <td className="px-3 py-1">
                        <Input
                          value={ep.name}
                          onChange={(e) =>
                            updateEpisode(idx, "name", e.target.value)
                          }
                          placeholder="Episode title"
                        />
                      </td>
                      <td className="px-3 py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEpisode(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEpisode}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Episode
          </Button>
        </fieldset>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? loadingText : buttonText}
        </Button>
      </div>
    </form>
  )
}
