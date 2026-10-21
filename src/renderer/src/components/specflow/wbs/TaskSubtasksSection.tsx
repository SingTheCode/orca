import { useState } from 'react'
import { LoaderCircle, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { specflowRequest } from '../specflow-client'
import { appendSubtaskProposals, parseSubtasks } from './specflow-task-model'
import type { SpecflowSubtask, SpecflowSubtaskProposal, SpecflowTask } from './specflow-task-types'

type Proposal = SpecflowSubtaskProposal & { key: string; selected: boolean }

export function TaskSubtasksSection(props: {
  projectId: string
  task: SpecflowTask
  onSaved: () => void
}): React.JSX.Element {
  const subtasks = parseSubtasks(props.task.subtasks)
  const [message, setMessage] = useState('')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (next: SpecflowSubtask[]): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      await specflowRequest('PUT', `/tasks/${encodeURIComponent(props.task.id)}`, {
        subtasks: JSON.stringify(next)
      })
      props.onSaved()
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
      return false
    } finally {
      setSaving(false)
    }
  }

  const generate = async (): Promise<void> => {
    setGenerating(true)
    setError(null)
    try {
      const result = await specflowRequest<{ subtasks: SpecflowSubtaskProposal[] | null }>(
        'POST',
        `/projects/${encodeURIComponent(props.projectId)}/tasks/${encodeURIComponent(props.task.id)}/subtasks/ai-generate`,
        { message: message.trim() }
      )
      setProposals(
        (result.subtasks ?? []).map((proposal) => ({
          ...proposal,
          key: createBrowserUuid(),
          selected: true
        }))
      )
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : String(generateError))
    } finally {
      setGenerating(false)
    }
  }

  const addSelected = async (): Promise<void> => {
    const selected = proposals.filter((proposal) => proposal.selected)
    if (await save(appendSubtaskProposals(subtasks, selected))) {
      setProposals([])
      setMessage('')
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {translate('specflow.wbs.subtasks.title', 'Subtasks')}
      </h3>
      {subtasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {translate('specflow.wbs.subtasks.empty', 'No subtasks yet.')}
        </p>
      ) : (
        <ul className="space-y-1">
          {subtasks.map((subtask) => (
            <li key={subtask.id} className="flex items-center gap-2">
              <Checkbox
                checked={subtask.checked}
                disabled={saving}
                aria-label={subtask.name}
                onCheckedChange={(checked) =>
                  void save(
                    subtasks.map((item) =>
                      item.id === subtask.id ? { ...item, checked: checked === true } : item
                    )
                  )
                }
              />
              <span className="min-w-0 flex-1 truncate text-sm" title={subtask.prompt}>
                {subtask.name}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={saving}
                aria-label={translate('specflow.wbs.subtasks.remove', 'Remove subtask')}
                onClick={() => void save(subtasks.filter((item) => item.id !== subtask.id))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <Label htmlFor="specflow-subtask-message">
          {translate('specflow.wbs.subtasks.aiLabel', 'Generate subtasks with AI')}
        </Label>
        <Textarea
          id="specflow-subtask-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={translate(
            'specflow.wbs.subtasks.aiPlaceholder',
            'Optional: describe the flow or constraints to break down.'
          )}
          rows={2}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={generating || saving}
          onClick={() => void generate()}
        >
          {generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {generating
            ? translate('specflow.wbs.subtasks.generating', 'Generating…')
            : translate('specflow.wbs.subtasks.generate', 'Generate')}
        </Button>
      </div>

      {proposals.length > 0 ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <ul className="space-y-2">
            {proposals.map((proposal) => (
              <li key={proposal.key} className="flex items-start gap-2">
                <Checkbox
                  className="mt-0.5"
                  checked={proposal.selected}
                  aria-label={proposal.name}
                  onCheckedChange={(checked) =>
                    setProposals((current) =>
                      current.map((item) =>
                        item.key === proposal.key ? { ...item, selected: checked === true } : item
                      )
                    )
                  }
                />
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm">{proposal.name}</span>
                  {proposal.done_condition ? (
                    <span className="block text-xs text-muted-foreground">
                      {proposal.done_condition}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setProposals([])}>
              {translate('specflow.wbs.discard', 'Discard')}
            </Button>
            <Button
              size="sm"
              disabled={saving || !proposals.some((proposal) => proposal.selected)}
              onClick={() => void addSelected()}
            >
              {translate('specflow.wbs.subtasks.addSelected', 'Add selected')}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </section>
  )
}
