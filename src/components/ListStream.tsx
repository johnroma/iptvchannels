import { type ReactNode } from "react"
import { ActiveSwitch } from "./ActiveSwitch"

export type Stream = {
  id: string
  tvgName: string
  name: string | null
  active: boolean | null
}

type ListStreamProps = {
  item: Stream
  editHref: string
  queryKey: string
  onToggle?: (id: string, active: boolean) => Promise<unknown>
  children?: ReactNode
}

export function ListStream({
  item,
  editHref,
  queryKey,
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
      <span className="text-gray-400">-</span>
      <a
        href={editHref}
        className="text-blue-600 hover:underline"
      >
        Edit
      </a>
    </li>
  )
}
