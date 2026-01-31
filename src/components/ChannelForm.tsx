import { FormEvent, useState, useEffect } from "react"
import { useServerFn } from "@tanstack/react-start"
import { type Channel } from "~/db/schema"
import { type CountryCode } from "~/db/validators"
import { Button } from "@ui/components/button"
import { Input } from "@ui/components/input"
import { Label } from "@ui/components/label"
import { Switch } from "@ui/components/switch"
import { createChannel, updateChannelForId } from "~/server/channels"

type ChannelFormProps =
  | {
      mode: "edit"
      channel: Channel
      onChannelSave?: (channel: Channel) => void
    }
  | {
      mode: "create"
      channel?: never
      onChannelSave?: (channel: Channel) => void
    }

const defaultFormData = {
  tvgId: "",
  tvgName: "",
  tvgLogo: "",
  groupTitle: "",
  groupTitleAlias: "",
  streamUrl: "",
  contentId: null as number | null,
  name: "",
  countryCode: "",
  favourite: false,
  active: false,
  scriptAlias: "",
}

export function ChannelForm(props: Readonly<ChannelFormProps>) {
  const { mode, onChannelSave } = props
  const channel = mode === "edit" ? props.channel : undefined

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const updateChannelFn = useServerFn(updateChannelForId)
  const createChannelFn = useServerFn(createChannel)

  // Initialize form state
  const [formData, setFormData] = useState(() => {
    if (channel) {
      return {
        tvgId: channel.tvgId || "",
        tvgName: channel.tvgName,
        tvgLogo: channel.tvgLogo || "",
        groupTitle: channel.groupTitle || "",
        groupTitleAlias: channel.groupTitleAlias || "",
        streamUrl: channel.streamUrl || "",
        contentId: channel.contentId,
        name: channel.name || "",
        countryCode: channel.countryCode || "",
        favourite: channel.favourite ?? false,
        active: channel.active ?? false,
        scriptAlias: channel.scriptAlias || "",
      }
    }
    return defaultFormData
  })

  // Keep form state in sync with channel prop
  useEffect(() => {
    if (channel) {
      setFormData({
        tvgId: channel.tvgId || "",
        tvgName: channel.tvgName,
        tvgLogo: channel.tvgLogo || "",
        groupTitle: channel.groupTitle || "",
        groupTitleAlias: channel.groupTitleAlias || "",
        streamUrl: channel.streamUrl || "",
        contentId: channel.contentId,
        name: channel.name || "",
        countryCode: channel.countryCode || "",
        favourite: channel.favourite ?? false,
        active: channel.active ?? false,
        scriptAlias: channel.scriptAlias || "",
      })
    }
  }, [channel])

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
        countryCode: (formData.countryCode || undefined) as
          | CountryCode
          | undefined,
      }

      let result: Channel | undefined
      if (mode === "edit" && channel) {
        result = await updateChannelFn({
          data: { id: channel.id, ...submitData },
        })
      } else {
        result = await createChannelFn({ data: submitData })
      }
      setIsLoading(false)
      if (result) onChannelSave?.(result)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("An unexpected error occurred")
      }
      setIsLoading(false)
    }
  }

  const buttonText = mode === "edit" ? "Save Changes" : "Create Channel"
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
              placeholder="e.g., US| A&E HD"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tvgId">EPG ID</Label>
            <Input
              id="tvgId"
              value={formData.tvgId}
              onChange={(e) => updateField("tvgId", e.target.value)}
              placeholder="e.g., AandE.us"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupTitle">Group/Category</Label>
            <Input
              id="groupTitle"
              value={formData.groupTitle}
              onChange={(e) => updateField("groupTitle", e.target.value)}
              placeholder="e.g., US| ENTERTAINMENT"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupTitleAlias">Group Alias</Label>
            <Input
              id="groupTitleAlias"
              value={formData.groupTitleAlias}
              onChange={(e) => updateField("groupTitleAlias", e.target.value)}
              placeholder="e.g., USA Entertainment"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tvgLogo">Logo URL</Label>
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

      {/* CMS Fields */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">
          CMS Settings
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Custom Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Override display name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="countryCode">Country Code</Label>
            <Input
              id="countryCode"
              value={formData.countryCode}
              onChange={(e) =>
                updateField(
                  "countryCode",
                  e.target.value.toUpperCase().slice(0, 2),
                )
              }
              placeholder="e.g., US, UK, SE"
              maxLength={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contentId">Kodi Content ID</Label>
            <Input
              id="contentId"
              type="number"
              value={formData.contentId ?? ""}
              onChange={(e) =>
                updateField(
                  "contentId",
                  e.target.value ? parseInt(e.target.value, 10) : null,
                )
              }
              placeholder="e.g., 123"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scriptAlias">Script Alias</Label>
            <Input
              id="scriptAlias"
              value={formData.scriptAlias}
              onChange={(e) => updateField("scriptAlias", e.target.value)}
              placeholder="e.g., channel_abc"
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
