import { type ReactNode } from "react"
import { Pencil, Play } from "lucide-react"
import { Button } from "@ui/components/button"
import { ActiveSwitch } from "./ActiveSwitch"

export type Stream = {
  id: string
  tvgName: string
  name: string | null
  active: boolean | null
  playUrl: string | null
}

type ListStreamProps = {
  item: Stream
  editHref: string
  playHref?: string
  queryKey: string
  hidePlay?: boolean
  onToggle?: (id: string, active: boolean) => Promise<unknown>
  children?: ReactNode
}

export function ListStream({
  item,
  editHref,
  playHref,
  queryKey,
  hidePlay = false,
  onToggle,
  children,
}: Readonly<ListStreamProps>) {
  return (
    <li className="flex items-center gap-3">
      <div className="flex items-center gap-2 min-w-17.5">
        <ActiveSwitch
          id={item.id}
          active={item.active}
          label={item.tvgName}
          queryKey={queryKey}
          onToggle={onToggle}
        />
      </div>
      {item.name && (
        <>
          <span>{item.name}</span>
          <span className="text-gray-400">-</span>
        </>
      )}
      <span>{item.tvgName}</span>
      {children}
      <div className="flex items-center gap-1 ml-2">
        <Button variant="outline" size="sm" asChild>
          <a href={editHref}>
            <Pencil />
            Edit
          </a>
        </Button>
        {!hidePlay && playHref && item.playUrl && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
          >
            <a
              href={playHref}
              title={`Play ${item.name ?? item.tvgName}`}
            >
              <Play />
              Play
            </a>
          </Button>
        )}
      </div>
    </li>
  )
}
