import { useState } from 'react'
import { Bot, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { useActiveWorktree } from '@/store/selectors'
import { launchOmpWithSpecflow } from '../../specflow-omp-launch'

/** Starts omp with the SpecFlow MCP extension in the active worktree to implement one task. */
export function RunTaskWithOmpButton(props: {
  projectId: string
  taskId: string
}): React.JSX.Element {
  const activeWorktree = useActiveWorktree()
  // Why: same rule as SpecflowPage — only a worktree of the repo bound to this project may run it.
  const worktreeId = useAppStore((s) =>
    activeWorktree && s.settings?.specflowProjectByRepo?.[activeWorktree.repoId] === props.projectId
      ? activeWorktree.id
      : null
  )
  const [starting, setStarting] = useState(false)

  const launch = async (targetWorktreeId: string): Promise<void> => {
    setStarting(true)
    try {
      const extension = await window.api.specflow.ensureMcpKey({ projectId: props.projectId })
      if (!extension.ok) {
        toast.error(extension.error)
        return
      }
      // Why: no plan overlay — the agent implements the task instead of starting in plan mode.
      launchOmpWithSpecflow({
        worktreeId: targetWorktreeId,
        extensionDir: extension.data.extensionDir,
        planOverlayPath: null,
        prompt: `Call the SpecFlow MCP tool get_task_prompt for task ${props.taskId}. Implement the task in this workspace, run the relevant verification, then call submit_task_result with the result (status DONE only if verification passed).`
      })
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {worktreeId ? null : (
        <span className="text-xs text-muted-foreground">
          {translate(
            'specflow.agent.noWorktree',
            'Open a workspace of this repository to run the task there.'
          )}
        </span>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={starting || !worktreeId}
        onClick={() => worktreeId && void launch(worktreeId)}
      >
        {starting ? <LoaderCircle className="size-3.5 animate-spin" /> : <Bot />}
        {translate('specflow.agent.runWithOmp', 'Run with omp')}
      </Button>
    </div>
  )
}
