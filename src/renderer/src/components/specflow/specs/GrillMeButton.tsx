import { useState } from 'react'
import { LoaderCircle, MessagesSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { specflowRequest } from '../specflow-client'
import { launchOmpWithSpecflow } from '../specflow-omp-launch'
import { buildGrillPrompt } from './specflow-spec-model'

type ProjectDetail = { name: string; description: string }

export function GrillMeButton(props: {
  projectId: string
  worktreeId: string | null
  /** Called after omp opens; the tab then waits for new spec versions. */
  onLaunched: () => void
}): React.JSX.Element {
  const [starting, setStarting] = useState(false)

  const launch = async (worktreeId: string): Promise<void> => {
    setStarting(true)
    try {
      const [project, extension] = await Promise.all([
        specflowRequest<ProjectDetail>('GET', `/projects/${encodeURIComponent(props.projectId)}`),
        window.api.specflow.ensureMcpKey({ projectId: props.projectId })
      ])
      if (!extension.ok) {
        toast.error(extension.error)
        return
      }
      const launched = launchOmpWithSpecflow({
        worktreeId,
        extensionDir: extension.data.extensionDir,
        planOverlayPath: extension.data.planOverlayPath,
        prompt: buildGrillPrompt(project)
      })
      if (launched) {
        props.onLaunched()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setStarting(false)
    }
  }

  const worktreeId = props.worktreeId
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        disabled={starting || !worktreeId}
        onClick={() => worktreeId && void launch(worktreeId)}
      >
        {starting ? <LoaderCircle className="size-3.5 animate-spin" /> : <MessagesSquare />}
        {translate('specflow.specs.grillButton', 'Plan with grill-me')}
      </Button>
      {worktreeId ? null : (
        <span className="text-xs text-muted-foreground">
          {translate(
            'specflow.specs.grillNoWorktree',
            'Open a workspace of this repository to start omp there.'
          )}
        </span>
      )}
    </div>
  )
}
