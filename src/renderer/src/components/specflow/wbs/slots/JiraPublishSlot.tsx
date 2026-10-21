import { CloudUpload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import { isLinkedToJira } from '../jira/jira-publish-payload'
import { useOpenJiraPublish } from '../jira/jira-publish-context'
import { JiraIssueLink } from '../jira/JiraPublishTaskList'
import type { SpecflowTask } from '../specflow-task-types'

export type JiraPublishSlotProps = { projectId: string; task: SpecflowTask }

export function JiraPublishSlot({ task }: JiraPublishSlotProps): React.JSX.Element | null {
  const openPublish = useOpenJiraPublish()
  const linked = isLinkedToJira(task)
  if (!linked && !openPublish) {
    return null
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{translate('specflow.jira.slotLabel', 'Jira')}</Label>
      {linked ? (
        task.jira_url ? (
          <JiraIssueLink issueKey={task.jira_ticket_key} url={task.jira_url} />
        ) : (
          <Badge variant="secondary">{task.jira_ticket_key}</Badge>
        )
      ) : (
        <Button variant="outline" size="sm" onClick={() => openPublish?.([task.id])}>
          <CloudUpload />
          {translate('specflow.jira.publishThisTask', 'Publish this task')}
        </Button>
      )}
    </div>
  )
}
