import { Link } from "@tanstack/react-router"
import { ChannelActiveSwitch } from "./ChannelActiveSwitch"
import { type Channel } from "~/db/schema"

export type ChannelListItem = Pick<
  Channel,
  "id" | "tvgName" | "name" | "active" | "favourite"
>

export function ChannelRow({
  channel,
}: Readonly<{ channel: ChannelListItem }>) {
  return (
    <li className="flex items-center gap-3">
      <div className="flex items-center gap-2 min-w-17.5">
        <ChannelActiveSwitch
          id={channel.id}
          active={channel.active}
          tvgName={channel.tvgName}
        />
      </div>
      {channel.name && (
        <>
          <span>{channel.name}</span>
          <span className="text-gray-400">-</span>
        </>
      )}
      <span>{channel.tvgName}</span>

      <span className="text-gray-400">-</span>
      <Link
        to="/edit/$id"
        params={{ id: String(channel.id) }}
        className="text-blue-600 hover:underline"
      >
        Edit
      </Link>
    </li>
  )
}
