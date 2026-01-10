import { queryOptions, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { listChannels } from "~/server/channels"

// 1. BEST PRACTICE: Define options once.
// This ensures your loader and component always use the exact same Key and Function.
const channelsOptions = queryOptions({
  queryKey: ["channels"],
  queryFn: () => listChannels(),
})

export const Route = createFileRoute("/channels/")({
  component: RouteComponent,
  // 2. Fix: ensureQueryData takes an object in v5, not (key, fn).
  // passing `channelsOptions` handles this automatically.
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(channelsOptions),
})

function RouteComponent() {
  // 3. Fix: Use the same options object here.
  // useSuspenseQuery guarantees `data` is defined (no undefined check needed).
  const { data } = useSuspenseQuery(channelsOptions)

  if (data.length === 0) {
    return <div>No channels found.</div>
  }

  return (
    <>
      <div>Hello "/channels"!</div>
      <ul>
        {data.map((channel) => (
          <li key={channel.id}>
            <span>{channel.tvgName}</span>
            {" - "} {channel.name} <span> - </span>
            <Link
              to="/edit/$id"
              params={{ id: channel.id.toString() }}
              className="text-blue-600"
            >
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
