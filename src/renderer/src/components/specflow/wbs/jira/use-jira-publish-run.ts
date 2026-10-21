import { useRef, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { jiraCreateIssue, type RuntimeJiraSettings } from '@/runtime/runtime-jira-client'
import { specflowRequest } from '../../specflow-client'
import type { SpecflowTask } from '../specflow-task-types'
import { buildJiraIssuePayload, type JiraPublishTarget } from './jira-publish-payload'

export type JiraPublishOutcome =
  | { state: 'queued' }
  | { state: 'running' }
  | { state: 'created'; key: string; url: string }
  // Jira issue exists but SpecFlow did not record it; the key is kept so the user can link it by hand.
  | { state: 'link-failed'; key: string; url: string; error: string }
  | { state: 'failed'; error: string }

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useJiraPublishRun(source: RuntimeJiraSettings): {
  outcomes: ReadonlyMap<string, JiraPublishOutcome>
  running: boolean
  run: (tasks: readonly SpecflowTask[], target: JiraPublishTarget) => Promise<void>
  reset: () => void
} {
  const [outcomes, setOutcomes] = useState<ReadonlyMap<string, JiraPublishOutcome>>(new Map())
  const [running, setRunning] = useState(false)
  const runningRef = useRef(false)

  const setOutcome = (taskId: string, outcome: JiraPublishOutcome): void =>
    setOutcomes((current) => new Map(current).set(taskId, outcome))

  const run = async (tasks: readonly SpecflowTask[], target: JiraPublishTarget): Promise<void> => {
    if (runningRef.current) {
      return
    }
    runningRef.current = true
    setRunning(true)
    setOutcomes(new Map(tasks.map((task) => [task.id, { state: 'queued' }])))
    const labels = {
      subtasks: translate('specflow.jira.description.subtasks', 'Subtasks'),
      doneWhen: translate('specflow.jira.description.doneWhen', 'done when'),
      priority: translate('specflow.jira.description.priority', 'Priority'),
      start: translate('specflow.jira.description.start', 'Start'),
      end: translate('specflow.jira.description.end', 'End')
    }
    try {
      // Sequential on purpose: Jira rate-limits bursts and per-row progress stays readable.
      for (const task of tasks) {
        setOutcome(task.id, { state: 'running' })
        let created: { id: string; key: string; url: string }
        try {
          const result = await jiraCreateIssue(source, buildJiraIssuePayload(task, target, labels))
          if (!result.ok) {
            setOutcome(task.id, { state: 'failed', error: result.error })
            continue
          }
          created = result
        } catch (createError) {
          setOutcome(task.id, { state: 'failed', error: errorText(createError) })
          continue
        }
        try {
          // The server publishes a task `updated` event, so the WBS list refreshes over SSE.
          await specflowRequest('PUT', `/tasks/${encodeURIComponent(task.id)}/jira-link`, {
            jira_ticket_key: created.key,
            jira_issue_id: created.id,
            jira_url: created.url
          })
          setOutcome(task.id, { state: 'created', key: created.key, url: created.url })
        } catch (linkError) {
          setOutcome(task.id, {
            state: 'link-failed',
            key: created.key,
            url: created.url,
            error: errorText(linkError)
          })
        }
      }
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }

  return { outcomes, running, run, reset: () => setOutcomes(new Map()) }
}
