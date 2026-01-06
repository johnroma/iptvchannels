import { FormEvent, useRef, useState } from "react"
import { createServerFn, useServerFn } from "@tanstack/react-start"
import z from "zod"
import { db } from "@/db"
import { type Channel, channels } from "@/db/schema"
import { redirect } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { Button } from "@ui/components/button"
import { Input } from "@ui/components/input"

type ChannelFormProps = {
  channel: Channel
}

const updateChannel = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), name: z.string().min(1) }))
  .handler(async ({ data }) => {
    await db
      .update(channels)
      .set({ name: data.name })
      .where(eq(channels.id, data.id))

    throw redirect({ to: "/" })
  })

export function ChannelForm({ channel }: Readonly<ChannelFormProps>) {
  const nameRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const updateChannelFn = useServerFn(updateChannel)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const name = nameRef.current?.value
    if (!name) return

    setIsLoading(true)

    await updateChannelFn({ data: { name, id: channel.id } })

    setIsLoading(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2"
    >
      <Input
        autoFocus
        ref={nameRef}
        placeholder="Enter channel name..."
        className="flex-1"
        aria-label="Name"
        defaultValue={channel.name || ""}
      />
      <Button
        type="submit"
        disabled={isLoading}
      >
        Update
      </Button>
    </form>
  )
}
