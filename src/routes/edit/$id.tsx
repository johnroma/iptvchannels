import { useQueryClient } from "@tanstack/react-query"
import {
  createFileRoute,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router"
import { type Channel } from "~/db/schema"
import { ChannelForm } from "~/components/ChannelForm"
import { getStreamById } from "~/server/shared"

export const Route = createFileRoute("/edit/$id")({
  component: PageEditChannel,
  loader: async ({ params }): Promise<Channel> => {
    const id = params.id
    const channelData = await getStreamById({ data: { id, table: "channels" } })
    if (!channelData) {
      throw notFound()
    }
    return channelData as Channel
  },
})

function PageEditChannel() {
  const channel = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  return (
    <ChannelForm
      mode="edit"
      channel={channel}
      onChannelSave={async (updated) => {
        await queryClient.invalidateQueries({ queryKey: ["channels"] })
        await router.invalidate()

        // Go back if we came from within the app, otherwise navigate to detail view
        if (
          document.referrer &&
          document.referrer.startsWith(globalThis.location.origin)
        ) {
          router.history.back()
        } else {
          navigate({ to: "/channels/$id", params: { id: updated.id } })
        }
      }}
    />
  )
}
