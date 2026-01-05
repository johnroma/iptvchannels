import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/edit/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/edit/channel/"!</div>
}
