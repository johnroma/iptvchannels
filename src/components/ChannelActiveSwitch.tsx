import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toggleChannelActive } from "~/server/channels"
import { Switch } from "@ui/components/switch"
import { Spinner } from "@ui/components/spinner"
import { type Channel } from "~/db/schema"

type ChannelActiveSwitchProps = Pick<Channel, "id" | "active" | "tvgName">

type PaginatedResult = {
  data: Channel[]
  totalCount: number
}

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

      await queryClient.cancelQueries({ queryKey: ["channels"] })

      const previousQueries = queryClient.getQueriesData({
        queryKey: ["channels"],
      })

      queryClient.setQueriesData<PaginatedResult>(
        { queryKey: ["channels"] },
        (old) => {
          if (!old || !old.data) return old

          return {
            ...old,
            data: old.data.map((c) =>
              c.id === id ? { ...c, active: newActive } : c,
            ),
          }
        },
      )

      return { previousQueries }
    },

    onError: (_err, _newActive, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data)
        }
      }
    },

    onSettled: () => {
      setIsUpdating(false)
      queryClient.invalidateQueries({ queryKey: ["channels"] })
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
