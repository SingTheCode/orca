import { useMemo, useState } from 'react'
import { LoaderCircle, MessageSquarePlus, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import { specflowRequest } from '../specflow-client'
import type { SpecflowTabProps } from '../specflow-types'
import { JiraPublishButton, JiraPublishProvider } from './jira/jira-publish-context'
import { groupTasks, type TaskGroupBy } from './specflow-task-model'
import { TaskChatDialog } from './TaskChatDialog'
import { TaskDetailSheet } from './TaskDetailSheet'
import { useSpecflowTasks } from './use-specflow-tasks'
import { WbsTaskList } from './WbsTaskList'

export default function WbsTab({ projectId }: SpecflowTabProps): React.JSX.Element {
  const { tasks, loading, error, reload } = useSpecflowTasks(projectId)
  const [groupBy, setGroupBy] = useState<TaskGroupBy>('priority')
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const groups = useMemo(() => groupTasks(tasks ?? [], groupBy), [tasks, groupBy])
  const titleById = useMemo(
    () => new Map((tasks ?? []).map((task) => [task.id, task.title])),
    [tasks]
  )
  const openTask = tasks?.find((task) => task.id === openTaskId) ?? null
  const hasTasks = (tasks?.length ?? 0) > 0

  const generate = async (): Promise<void> => {
    setConfirmGenerate(false)
    setGenerating(true)
    setGenerateError(null)
    try {
      // Takes ~1 min (one LLM call over PRD+TRD); main's default timeout is 600 s.
      await specflowRequest('POST', `/projects/${encodeURIComponent(projectId)}/wbs`)
    } catch (generationError) {
      setGenerateError(
        generationError instanceof Error ? generationError.message : String(generationError)
      )
    } finally {
      setGenerating(false)
    }
    await reload()
  }

  return (
    <JiraPublishProvider tasks={tasks ?? []}>
      <div className="space-y-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={generating}
            onClick={() => (hasTasks ? setConfirmGenerate(true) : void generate())}
          >
            {generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {generating
              ? translate('specflow.wbs.generating', 'Generating WBS from PRD and TRD…')
              : hasTasks
                ? translate('specflow.wbs.regenerate', 'Regenerate WBS')
                : translate('specflow.wbs.generate', 'Generate WBS')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={generating}
            onClick={() => setChatOpen(true)}
          >
            <MessageSquarePlus />
            {translate('specflow.wbs.addWithAi', 'Add tasks with AI')}
          </Button>
          <JiraPublishButton disabled={generating || !hasTasks} />
          <div className="ml-auto flex items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={groupBy}
              onValueChange={(value) => {
                if (value === 'priority' || value === 'status') {
                  setGroupBy(value)
                }
              }}
            >
              <ToggleGroupItem value="priority">
                {translate('specflow.wbs.groupByPriority', 'Priority')}
              </ToggleGroupItem>
              <ToggleGroupItem value="status">
                {translate('specflow.wbs.groupByStatus', 'Status')}
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={loading}
              aria-label={translate('specflow.wbs.refresh', 'Refresh')}
              onClick={() => void reload()}
            >
              {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            </Button>
          </div>
        </div>

        {generateError ? <p className="text-xs text-destructive">{generateError}</p> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {tasks === null ? (
          loading ? (
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          ) : null
        ) : hasTasks ? (
          <WbsTaskList
            groups={groups}
            groupBy={groupBy}
            titleById={titleById}
            onOpen={setOpenTaskId}
          />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {translate(
              'specflow.wbs.empty',
              'No tasks yet. Generate a WBS from the PRD and TRD, or add tasks with AI.'
            )}
          </p>
        )}

        <TaskDetailSheet
          projectId={projectId}
          task={openTask}
          onClose={() => setOpenTaskId(null)}
          onChanged={() => void reload()}
        />
        <TaskChatDialog
          projectId={projectId}
          open={chatOpen}
          onOpenChange={(open) => {
            setChatOpen(open)
            if (!open) {
              void reload()
            }
          }}
        />
        <Dialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
          <DialogContent size="compact">
            <DialogHeader>
              <DialogTitle>
                {translate('specflow.wbs.regenerateTitle', 'Regenerate WBS?')}
              </DialogTitle>
              <DialogDescription>
                {translate(
                  'specflow.wbs.regenerateWarning',
                  'All {{count}} existing tasks in this project are deleted and replaced, including subtasks, status, and Jira links.',
                  { count: tasks?.length ?? 0 }
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmGenerate(false)}>
                {translate('specflow.wbs.cancel', 'Cancel')}
              </Button>
              <Button variant="destructive" onClick={() => void generate()}>
                {translate('specflow.wbs.regenerateConfirm', 'Replace tasks')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </JiraPublishProvider>
  )
}
