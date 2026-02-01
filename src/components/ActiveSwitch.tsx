import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Switch } from "@ui/components/switch"
import { Spinner } from "@ui/components/spinner"
import { toggleActive, type TableKey } from "~/server/shared"

type ActiveSwitchProps = {
  id: string
  active: boolean | null
  label: string
  queryKey: string
  onToggle?: (id: string, active: boolean) => Promise<unknown>
}

type PaginatedResult = {
  data: { id: string; active: boolean }[]
  totalCount: number
}

export function ActiveSwitch({
  id,
  active,
  label,
  queryKey,
  onToggle,
}: Readonly<ActiveSwitchProps>) {
  const queryClient = useQueryClient()
  const [isUpdating, setIsUpdating] = useState(false)

  const mutation = useMutation({
    mutationFn: (newActive: boolean) => {
      if (onToggle) {
        return onToggle(id, newActive)
      }
      return toggleActive({
        data: { id, active: newActive, table: queryKey as TableKey },
      })
    },

    onMutate: async (newActive) => {
      setIsUpdating(true)

      await queryClient.cancelQueries({ queryKey: [queryKey] })

      const previousQueries = queryClient.getQueriesData({
        queryKey: [queryKey],
      })

      queryClient.setQueriesData<PaginatedResult>(
        { queryKey: [queryKey] },
        (old) => {
          if (!old || !old.data) return old

          return {
            ...old,
            data: old.data.map((item) =>
              item.id === id ? { ...item, active: newActive } : item,
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
      queryClient.invalidateQueries({ queryKey: [queryKey] })
    },
  })

  if (isUpdating) {
    return <Spinner className="size-5" />
  }

  return (
    <Switch
      checked={!!active}
      onCheckedChange={(checked) => mutation.mutate(checked)}
      aria-label={`Toggle ${label} active`}
    />
  )
}
