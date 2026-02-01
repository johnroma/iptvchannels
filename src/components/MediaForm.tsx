import { FormEvent, useState, useEffect } from "react"
import { useServerFn } from "@tanstack/react-start"
import { type Media } from "~/db/schema"
import { Button } from "@ui/components/button"
import { Input } from "@ui/components/input"
import { Label } from "@ui/components/label"
import { Switch } from "@ui/components/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/components/select"
import { createMedia, updateMediaForId } from "~/server/media"

type MediaFormProps =
  | {
      mode: "edit"
      media: Media
      onMediaSave?: (media: Media) => void
    }
  | {
      mode: "create"
      media?: never
      onMediaSave?: (media: Media) => void
    }

const defaultFormData = {
  tvgId: "",
  tvgName: "",
  tvgLogo: "",
  groupTitle: "",
  groupTitleAlias: "",
  streamUrl: "",
  mediaType: "" as string,
  year: null as number | null,
  season: null as number | null,
  episode: null as number | null,
  name: "",
  favourite: false,
  active: false,
}

export function MediaForm(props: Readonly<MediaFormProps>) {
  const { mode, onMediaSave } = props
  const mediaItem = mode === "edit" ? props.media : undefined

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const updateMediaFn = useServerFn(updateMediaForId)
  const createMediaFn = useServerFn(createMedia)

  const [formData, setFormData] = useState(() => {
    if (mediaItem) {
      return {
        tvgId: mediaItem.tvgId || "",
        tvgName: mediaItem.tvgName,
        tvgLogo: mediaItem.tvgLogo || "",
        groupTitle: mediaItem.groupTitle || "",
        groupTitleAlias: mediaItem.groupTitleAlias || "",
        streamUrl: mediaItem.streamUrl || "",
        mediaType: mediaItem.mediaType || "",
        year: mediaItem.year,
        season: mediaItem.season,
        episode: mediaItem.episode,
        name: mediaItem.name || "",
        favourite: mediaItem.favourite ?? false,
        active: mediaItem.active ?? false,
      }
    }
    return defaultFormData
  })

  useEffect(() => {
    if (mediaItem) {
      setFormData({
        tvgId: mediaItem.tvgId || "",
        tvgName: mediaItem.tvgName,
        tvgLogo: mediaItem.tvgLogo || "",
        groupTitle: mediaItem.groupTitle || "",
        groupTitleAlias: mediaItem.groupTitleAlias || "",
        streamUrl: mediaItem.streamUrl || "",
        mediaType: mediaItem.mediaType || "",
        year: mediaItem.year,
        season: mediaItem.season,
        episode: mediaItem.episode,
        name: mediaItem.name || "",
        favourite: mediaItem.favourite ?? false,
        active: mediaItem.active ?? false,
      })
    }
  }, [mediaItem])

  function updateField<K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K],
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const submitData = {
        ...formData,
        groupTitleAlias: formData.groupTitleAlias || null,
        mediaType: (formData.mediaType || null) as
          | "movie"
          | "series"
          | null,
      }

      let result: Media | undefined
      if (mode === "edit" && mediaItem) {
        result = (await updateMediaFn({
          data: { id: mediaItem.id, ...submitData },
        })) as Media | undefined
      } else {
        result = (await createMediaFn({ data: submitData })) as
          | Media
          | undefined
      }
      setIsLoading(false)
      if (result) onMediaSave?.(result)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("An unexpected error occurred")
      }
      setIsLoading(false)
    }
  }

  const buttonText = mode === "edit" ? "Save Changes" : "Create Media"
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

      {/* M3U Fields */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">
          M3U Data
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tvgName">Display Name *</Label>
            <Input
              id="tvgName"
              value={formData.tvgName}
              onChange={(e) => updateField("tvgName", e.target.value)}
              placeholder="e.g., DE - Senran Kagura (2013) S02 E11"
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
            <Label htmlFor="tvgLogo">Logo / Poster URL</Label>
            <Input
              id="tvgLogo"
              type="url"
              value={formData.tvgLogo}
              onChange={(e) => updateField("tvgLogo", e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="streamUrl">Stream URL</Label>
            <Input
              id="streamUrl"
              type="url"
              value={formData.streamUrl}
              onChange={(e) => updateField("streamUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
      </fieldset>

      {/* Media Info */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">
          Media Info
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mediaType">Type</Label>
            <Select
              value={formData.mediaType}
              onValueChange={(value) =>
                updateField("mediaType", value === "none" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="movie">Movie</SelectItem>
                <SelectItem value="series">Series</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              type="number"
              value={formData.year ?? ""}
              onChange={(e) =>
                updateField(
                  "year",
                  e.target.value ? parseInt(e.target.value, 10) : null,
                )
              }
              placeholder="e.g., 2013"
              min={1888}
              max={2100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="season">Season</Label>
            <Input
              id="season"
              type="number"
              value={formData.season ?? ""}
              onChange={(e) =>
                updateField(
                  "season",
                  e.target.value ? parseInt(e.target.value, 10) : null,
                )
              }
              placeholder="e.g., 2"
              min={0}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="episode">Episode</Label>
            <Input
              id="episode"
              type="number"
              value={formData.episode ?? ""}
              onChange={(e) =>
                updateField(
                  "episode",
                  e.target.value ? parseInt(e.target.value, 10) : null,
                )
              }
              placeholder="e.g., 11"
              min={0}
            />
          </div>
        </div>
      </fieldset>

      {/* CMS */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">
          CMS Settings
        </legend>

        <div className="space-y-2">
          <Label htmlFor="name">Custom Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Override display name"
          />
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
