import { CircleAlert, CircleCheck, CircleX, ExternalLink, LoaderCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { translate } from '@/i18n/i18n'
import type { SpecflowTask } from '../specflow-task-types'
import { isLinkedToJira } from './jira-publish-payload'
import type { JiraPublishOutcome } from './use-jira-publish-run'

export function JiraIssueLink(props: { issueKey: string; url: string }): React.JSX.Element {
  return (
    <Button variant="link" size="xs" onClick={() => void window.api.shell.openUrl(props.url)}>
      {props.issueKey}
      <ExternalLink className="size-3" />
    </Button>
  )
}

function OutcomeCell(props: { outcome: JiraPublishOutcome | undefined }): React.JSX.Element | null {
  const { outcome } = props
  switch (outcome?.state) {
    case undefined:
      return null
    case 'queued':
      return (
        <span className="text-xs text-muted-foreground">
          {translate('specflow.jira.queued', 'Queued')}
        </span>
      )
    case 'running':
      return <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
    case 'created':
      return (
        <span className="flex items-center gap-1">
          <CircleCheck className="size-3.5 text-muted-foreground" />
          <JiraIssueLink issueKey={outcome.key} url={outcome.url} />
        </span>
      )
    case 'link-failed':
      return (
        <span className="flex min-w-0 items-center gap-1 text-xs text-destructive">
          <CircleAlert className="size-3.5 shrink-0" />
          <JiraIssueLink issueKey={outcome.key} url={outcome.url} />
          <span className="truncate" title={outcome.error}>
            {translate('specflow.jira.linkFailed', 'Created, but not linked in SpecFlow')}
          </span>
        </span>
      )
    case 'failed':
      return (
        <span className="flex min-w-0 items-center gap-1 text-xs text-destructive">
          <CircleX className="size-3.5 shrink-0" />
          <span className="truncate" title={outcome.error}>
            {outcome.error}
          </span>
        </span>
      )
  }
}

export function JiraPublishTaskList(props: {
  tasks: readonly SpecflowTask[]
  selectedIds: ReadonlySet<string>
  outcomes: ReadonlyMap<string, JiraPublishOutcome>
  locked: boolean
  onToggle: (taskId: string, selected: boolean) => void
}): React.JSX.Element {
  return (
    <ul className="scrollbar-sleek max-h-[40vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
      {props.tasks.map((task) => {
        const linked = isLinkedToJira(task)
        const outcome = props.outcomes.get(task.id)
        return (
          <li
            key={task.id}
            className="grid grid-cols-[1rem_2.5rem_minmax(0,1fr)_minmax(0,12rem)] items-center gap-3 px-3 py-2"
          >
            <Checkbox
              checked={!linked && props.selectedIds.has(task.id)}
              disabled={linked || props.locked}
              aria-label={task.title}
              onCheckedChange={(checked) => props.onToggle(task.id, checked === true)}
            />
            <Badge variant="outline">{task.priority}</Badge>
            <span className="truncate text-sm">{task.title}</span>
            <span className="flex min-w-0 justify-end">
              {outcome ? (
                <OutcomeCell outcome={outcome} />
              ) : linked ? (
                task.jira_url ? (
                  <JiraIssueLink issueKey={task.jira_ticket_key} url={task.jira_url} />
                ) : (
                  <Badge variant="secondary">{task.jira_ticket_key}</Badge>
                )
              ) : null}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
