import { useState } from 'react'
import { LoaderCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { specflowRequest } from '../specflow-client'
import { proposalToTaskCreate } from './specflow-task-model'
import type {
  SpecflowBatchCreateResponse,
  SpecflowChatMessage,
  SpecflowTaskChatResponse,
  SpecflowTaskProposal
} from './specflow-task-types'

type Proposal = SpecflowTaskProposal & { key: string; selected: boolean }
type ChatEntry = SpecflowChatMessage & { key: string }

function TaskChatBody(props: { projectId: string; onCreated: () => void }): React.JSX.Element {
  const projectPath = `/projects/${encodeURIComponent(props.projectId)}`
  const [history, setHistory] = useState<ChatEntry[]>([])
  const [message, setMessage] = useState('')
  const [taskCount, setTaskCount] = useState('3')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [busy, setBusy] = useState<'chat' | 'create' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = async (): Promise<void> => {
    const text = message.trim()
    if (!text || busy) {
      return
    }
    setBusy('chat')
    setError(null)
    try {
      const count = Number.parseInt(taskCount, 10)
      const response = await specflowRequest<SpecflowTaskChatResponse>(
        'POST',
        `${projectPath}/tasks/chat`,
        {
          message: text,
          history: history.map(({ role, content }) => ({ role, content })),
          reference_docs: ['PRD', 'TRD'],
          task_count: Number.isFinite(count) && count > 0 ? count : 3
        }
      )
      setHistory([
        ...history,
        { key: createBrowserUuid(), role: 'user', content: text },
        { key: createBrowserUuid(), role: 'assistant', content: response.reply }
      ])
      setProposals(
        (response.tasks ?? []).map((task) => ({
          ...task,
          key: createBrowserUuid(),
          selected: true
        }))
      )
      setMessage('')
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : String(chatError))
    } finally {
      setBusy(null)
    }
  }

  const create = async (): Promise<void> => {
    const selected = proposals.filter((proposal) => proposal.selected)
    setBusy('create')
    setError(null)
    try {
      const result = await specflowRequest<SpecflowBatchCreateResponse>(
        'POST',
        `${projectPath}/tasks/batch`,
        selected.map((proposal) => proposalToTaskCreate(proposal))
      )
      const { created, merged, reopened } = result.dedup_summary
      toast.success(
        translate(
          'specflow.wbs.chat.createdSummary',
          '{{created}} created, {{merged}} merged, {{reopened}} reopened',
          { created, merged, reopened }
        )
      )
      props.onCreated()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="scrollbar-sleek max-h-[50vh] space-y-3 overflow-y-auto">
        {history.map((entry) => (
          <div
            key={entry.key}
            data-role={entry.role}
            className="rounded-md px-3 py-2 text-sm whitespace-pre-wrap data-[role=assistant]:mr-8 data-[role=assistant]:border data-[role=assistant]:border-border data-[role=user]:ml-8 data-[role=user]:bg-accent"
          >
            {entry.content}
          </div>
        ))}
        {proposals.length > 0 ? (
          <ul className="space-y-2 rounded-md border border-border p-3">
            {proposals.map((proposal) => (
              <li key={proposal.key} className="flex items-start gap-2">
                <Checkbox
                  className="mt-0.5"
                  checked={proposal.selected}
                  aria-label={proposal.title}
                  onCheckedChange={(checked) =>
                    setProposals((current) =>
                      current.map((item) =>
                        item.key === proposal.key ? { ...item, selected: checked === true } : item
                      )
                    )
                  }
                />
                <span className="min-w-0 space-y-0.5">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">
                      {proposal.priority || 'P1'}
                    </span>
                    {proposal.title}
                  </span>
                  <span className="line-clamp-3 block text-xs text-muted-foreground">
                    {proposal.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="specflow-task-chat">
              {translate('specflow.wbs.chat.messageLabel', 'Message')}
            </Label>
            <Textarea
              id="specflow-task-chat"
              autoFocus
              rows={3}
              value={message}
              placeholder={translate(
                'specflow.wbs.chat.placeholder',
                'Describe the work to add, e.g. "Add password reset by email".'
              )}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  void send()
                }
              }}
            />
          </div>
          <div className="w-20 space-y-1">
            <Label htmlFor="specflow-task-count">
              {translate('specflow.wbs.chat.count', 'Tasks')}
            </Label>
            <Input
              id="specflow-task-count"
              type="number"
              min={1}
              max={20}
              value={taskCount}
              onChange={(event) => setTaskCount(event.target.value)}
            />
          </div>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          disabled={busy !== null || !message.trim()}
          onClick={() => void send()}
        >
          {busy === 'chat' ? <LoaderCircle className="animate-spin" /> : <Send />}
          {busy === 'chat'
            ? translate('specflow.wbs.chat.thinking', 'Waiting for reply…')
            : translate('specflow.wbs.chat.send', 'Send')}
        </Button>
        <Button
          disabled={busy !== null || !proposals.some((proposal) => proposal.selected)}
          onClick={() => void create()}
        >
          {busy === 'create' ? <LoaderCircle className="animate-spin" /> : null}
          {translate('specflow.wbs.chat.createSelected', 'Create selected tasks')}
        </Button>
      </DialogFooter>
    </>
  )
}

export function TaskChatDialog(props: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{translate('specflow.wbs.chat.title', 'Add tasks with AI')}</DialogTitle>
          <DialogDescription>
            {translate(
              'specflow.wbs.chat.description',
              'Chat about the work using the PRD and TRD, then pick which proposed tasks to create.'
            )}
          </DialogDescription>
        </DialogHeader>
        {props.open ? (
          <TaskChatBody projectId={props.projectId} onCreated={() => props.onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
