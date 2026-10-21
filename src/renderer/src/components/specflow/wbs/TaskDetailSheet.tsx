import { useState } from 'react'
import { LoaderCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { specflowRequest } from '../specflow-client'
import { JiraPublishSlot } from './slots/JiraPublishSlot'
import { TaskReportsSlot } from './slots/TaskReportsSlot'
import { taskStatusLabel } from './specflow-task-labels'
import { allowedNextStatuses, TASK_PRIORITIES, taskDatePart } from './specflow-task-model'
import type { SpecflowTask, SpecflowTaskPriority, SpecflowTaskUpdate } from './specflow-task-types'
import { TaskSubtasksSection } from './TaskSubtasksSection'

type Draft = {
  title: string
  description: string
  priority: SpecflowTaskPriority
  startDate: string
  endDate: string
}

function draftFromTask(task: SpecflowTask): Draft {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    startDate: taskDatePart(task.start_date),
    endDate: taskDatePart(task.end_date)
  }
}

function TaskDetailBody(props: {
  projectId: string
  task: SpecflowTask
  onChanged: () => void
  onDeleted: () => void
}): React.JSX.Element {
  const { task } = props
  const taskPath = `/tasks/${encodeURIComponent(task.id)}`
  const [draft, setDraft] = useState<Draft>(() => draftFromTask(task))
  const [saved, setSaved] = useState<Draft>(() => draftFromTask(task))
  const [savedStamp, setSavedStamp] = useState(task.updated_at)
  const [busy, setBusy] = useState<'save' | 'status' | 'delete' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty =
    draft.title !== saved.title ||
    draft.description !== saved.description ||
    draft.priority !== saved.priority ||
    draft.startDate !== saved.startDate ||
    draft.endDate !== saved.endDate
  // Why: live refresh replaces `task`; adopt the server copy but keep unsaved edits intact.
  if (task.updated_at !== savedStamp) {
    const next = draftFromTask(task)
    setSavedStamp(task.updated_at)
    setSaved(next)
    if (!dirty) {
      setDraft(next)
    }
  }
  const titleMissing = draft.title.trim().length === 0

  const run = async (kind: 'save' | 'status' | 'delete', action: () => Promise<void>) => {
    setBusy(kind)
    setError(null)
    try {
      await action()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError))
    } finally {
      setBusy(null)
    }
  }

  const save = () =>
    run('save', async () => {
      const body: SpecflowTaskUpdate = {
        title: draft.title.trim(),
        description: draft.description,
        priority: draft.priority,
        start_date: draft.startDate,
        end_date: draft.endDate
      }
      await specflowRequest('PUT', taskPath, body)
      props.onChanged()
    })

  return (
    <div className="scrollbar-sleek flex-1 space-y-5 overflow-y-auto px-4 pb-6">
      <div className="space-y-2">
        <Label htmlFor="specflow-task-title">
          {translate('specflow.wbs.field.title', 'Title')}
        </Label>
        <Input
          id="specflow-task-title"
          value={draft.title}
          aria-invalid={titleMissing}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="specflow-task-description">
          {translate('specflow.wbs.field.description', 'Description')}
        </Label>
        <Textarea
          id="specflow-task-description"
          value={draft.description}
          rows={6}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>{translate('specflow.wbs.field.priority', 'Priority')}</Label>
          <Select
            value={draft.priority}
            onValueChange={(value) => {
              const priority = TASK_PRIORITIES.find((candidate) => candidate === value)
              if (priority) {
                setDraft({ ...draft, priority })
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="specflow-task-start">
            {translate('specflow.wbs.field.start', 'Start')}
          </Label>
          <Input
            id="specflow-task-start"
            type="date"
            value={draft.startDate}
            onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="specflow-task-end">{translate('specflow.wbs.field.end', 'End')}</Label>
          <Input
            id="specflow-task-end"
            type="date"
            value={draft.endDate}
            onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!dirty || busy !== null}
          onClick={() => setDraft(saved)}
        >
          {translate('specflow.wbs.revert', 'Revert')}
        </Button>
        <Button
          size="sm"
          disabled={!dirty || titleMissing || busy !== null}
          onClick={() => void save()}
        >
          {busy === 'save' ? <LoaderCircle className="animate-spin" /> : null}
          {translate('specflow.wbs.save', 'Save')}
        </Button>
      </div>

      <div className="space-y-2">
        <Label>{translate('specflow.wbs.field.status', 'Status')}</Label>
        <Select
          value={task.status}
          disabled={busy !== null}
          onValueChange={(status) =>
            void run('status', async () => {
              await specflowRequest('PATCH', `${taskPath}/status`, { status })
              props.onChanged()
            })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue>{taskStatusLabel(task.status)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={task.status}>{taskStatusLabel(task.status)}</SelectItem>
            {allowedNextStatuses(task.status).map((status) => (
              <SelectItem key={status} value={status}>
                {taskStatusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Separator />
      <TaskSubtasksSection projectId={props.projectId} task={task} onSaved={props.onChanged} />
      <Separator />
      <JiraPublishSlot projectId={props.projectId} task={task} />
      <TaskReportsSlot projectId={props.projectId} task={task} />
      <Separator />

      <div className="flex items-center justify-end gap-2">
        {confirmDelete ? (
          <>
            <span className="mr-auto text-xs text-muted-foreground">
              {translate('specflow.wbs.deleteConfirm', 'Delete this task permanently?')}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              {translate('specflow.wbs.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                void run('delete', async () => {
                  await specflowRequest('DELETE', taskPath)
                  props.onDeleted()
                })
              }
            >
              {busy === 'delete' ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              {translate('specflow.wbs.delete', 'Delete')}
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 />
            {translate('specflow.wbs.deleteTask', 'Delete task')}
          </Button>
        )}
      </div>
    </div>
  )
}

export function TaskDetailSheet(props: {
  projectId: string
  task: SpecflowTask | null
  onClose: () => void
  onChanged: () => void
}): React.JSX.Element {
  return (
    <Sheet open={props.task !== null} onOpenChange={(open) => !open && props.onClose()}>
      <SheetContent className="sm:max-w-[560px]">
        <SheetHeader className="mr-6">
          <SheetTitle>
            {props.task?.title ?? translate('specflow.wbs.taskTitle', 'Task')}
          </SheetTitle>
          <SheetDescription>{props.task?.jira_ticket_key || props.task?.id}</SheetDescription>
        </SheetHeader>
        {props.task ? (
          <TaskDetailBody
            key={props.task.id}
            projectId={props.projectId}
            task={props.task}
            onChanged={props.onChanged}
            onDeleted={() => {
              props.onChanged()
              props.onClose()
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
