import { notFound } from 'next/navigation'
import { PROJECTS_ENABLED } from '@/lib/flags'

// Single choke point for the whole /projects subtree. Until the projects are
// released, every /projects/* route 404s — no half-finished pages are reachable,
// even by direct URL. Flip PROJECTS_ENABLED in src/lib/flags.ts to turn them on.
export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  if (!PROJECTS_ENABLED) notFound()
  return <>{children}</>
}
