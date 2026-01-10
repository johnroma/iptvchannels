import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toggleChannelActive } from "~/server/channels"
import { Switch } from "@ui/components/switch"
import { Spinner } from "@ui/components/spinner"
import { type Channel } from "~/db/schema"

type ChannelActiveSwitchProps = Pick<Channel, "id" | "active" | "tvgName">

export function ChannelActiveSwitch({
  id,
  active,
  tvgName,
}: Readonly<ChannelActiveSwitchProps>) {
  const queryClient = useQueryClient()
  const [isUpdating, setIsUpdating] = useState(false)

  const mutation = useMutation({
    mutationFn: (newActive: boolean) =>
      toggleChannelActive({ data: { id, active: newActive } }),

    onMutate: async (newActive) => {
      setIsUpdating(true)
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["channels"] })

      // Snapshot previous value
      const previousChannels = queryClient.getQueryData<Channel[]>(["channels"])

      // Optimistically update
      queryClient.setQueryData<Channel[]>(["channels"], (old) =>
        old?.map((c) => (c.id === id ? { ...c, active: newActive } : c))
      )

      return { previousChannels }
    },

    onError: (_err, _newActive, context) => {
      // Rollback on error
      if (context?.previousChannels) {
        queryClient.setQueryData(["channels"], context.previousChannels)
      }
    },

    onSettled: () => {
      setIsUpdating(false)
    },
  })

  if (isUpdating) {
    return <Spinner className="size-5" />
  }

  return (
    <Switch
      checked={!!active}
      onCheckedChange={(checked) => mutation.mutate(checked)}
      aria-label={`Toggle ${tvgName} active`}
    />
  )
}
