import { FormEvent, useRef, useState } from "react"
import { useServerFn } from "@tanstack/react-start"
import { type Channel } from "~/db/schema"
import { Button } from "@ui/components/button"
import { Input } from "@ui/components/input"
import { updateChannelForId } from "~/server/channels"

type ChannelFormProps = {
  channel: Channel
  onChannelUpdate?: (channel: Channel) => void
}

export function ChannelForm({ channel, onChannelUpdate }: Readonly<ChannelFormProps>) {
  const nameRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const updateChannelFn = useServerFn(updateChannelForId)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const name = nameRef.current?.value
    if (!name) return

    setError(null)
    setIsLoading(true)

    try {
      const updated = await updateChannelFn({ data: { name, id: channel.id } })
      setIsLoading(false)
      if (updated) onChannelUpdate?.(updated)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("An unexpected error occurred")
      }
      setIsLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2"
    >
      <div className="flex-1">
        <Input
          autoFocus
          ref={nameRef}
          placeholder="Enter channel name..."
          aria-label="Name"
          aria-invalid={!!error}
          defaultValue={channel.name || ""}
          onChange={() => error && setError(null)}
        />
        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      </div>
      <Button
        type="submit"
        disabled={isLoading}
      >
        Update
      </Button>
    </form>
  )
}
