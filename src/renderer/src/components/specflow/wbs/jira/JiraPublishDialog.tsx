import { useState } from 'react'
import { CloudUpload, LoaderCircle, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { JIRA_INTEGRATION_SECTION_ID } from '../../../settings/task-provider-integration-section-ids'
import type { SpecflowTask } from '../specflow-task-types'
import { initialPublishSelection, resolveEpicField, tasksToPublish } from './jira-publish-payload'
import { JiraEpicPicker, type JiraEpicChoice } from './JiraEpicPicker'
import { JiraPublishTaskList } from './JiraPublishTaskList'
import { useJiraPublishRun } from './use-jira-publish-run'
import { useJiraPublishTarget } from './use-jira-publish-target'

function PickerField(props: {
  label: string
  value: string | null
  options: readonly { id: string; label: string }[] | null
  disabled: boolean
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Label>{props.label}</Label>
      <Select
        value={props.value ?? ''}
        disabled={props.disabled || !props.options}
        onValueChange={props.onChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={props.options ? undefined : '…'} />
        </SelectTrigger>
        <SelectContent>
          {(props.options ?? []).map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function JiraNotConnected(props: { error: string | null }): React.JSX.Element {
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  return (
    <div className="space-y-3 py-4 text-center">
      <p className="text-sm text-muted-foreground">
        {props.error ??
          translate('specflow.jira.notConnected', 'Connect Jira in Settings to publish tasks.')}
      </p>
      <Button
        size="sm"
        onClick={() => {
          openSettingsPage()
          openSettingsTarget({
            pane: 'integrations',
            repoId: null,
            sectionId: JIRA_INTEGRATION_SECTION_ID
          })
        }}
      >
        <Settings />
        {translate('specflow.jira.openSettings', 'Open Jira settings')}
      </Button>
    </div>
  )
}

function JiraPublishBody(props: {
  tasks: readonly SpecflowTask[]
  preselectedTaskIds: readonly string[] | undefined
  onClose: () => void
}): React.JSX.Element {
  const target = useJiraPublishTarget(true)
  const publish = useJiraPublishRun(target.source)
  const [selectedIds, setSelectedIds] = useState(() =>
    initialPublishSelection(props.tasks, props.preselectedTaskIds)
  )
  const [epic, setEpic] = useState<JiraEpicChoice | null>(null)
  const finished = !publish.running && publish.outcomes.size > 0

  if (target.connection === 'checking') {
    return <LoaderCircle className="mx-auto size-4 animate-spin text-muted-foreground" />
  }
  if (target.connection !== 'connected') {
    return <JiraNotConnected error={target.connectionError} />
  }

  const project = target.projects?.find((candidate) => candidate.id === target.projectId) ?? null
  const epicField = target.createFields ? resolveEpicField(target.createFields) : null
  const toPublish = tasksToPublish(props.tasks, selectedIds)
  const epicUnsupported = epic !== null && target.createFields !== null && epicField === null
  const ready =
    target.siteId !== null &&
    project !== null &&
    target.issueTypeId !== null &&
    target.createFields !== null &&
    !epicUnsupported &&
    toPublish.length > 0
  const counts = { created: 0, failed: 0 }
  for (const outcome of publish.outcomes.values()) {
    if (outcome.state === 'created') {
      counts.created += 1
    } else if (outcome.state === 'failed' || outcome.state === 'link-failed') {
      counts.failed += 1
    }
  }

  const start = (): void => {
    if (!ready || target.siteId === null || target.issueTypeId === null) {
      return
    }
    void publish.run(toPublish, {
      siteId: target.siteId,
      projectId: project.id,
      issueTypeId: target.issueTypeId,
      epic: epic && epicField ? { key: epic.key, field: epicField } : null
    })
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {target.sites.length > 1 ? (
          <PickerField
            label={translate('specflow.jira.site', 'Site')}
            value={target.siteId}
            options={target.sites.map((site) => ({
              id: site.id,
              label: site.displayName || site.siteUrl
            }))}
            disabled={publish.running}
            onChange={(siteId) => {
              target.setSiteId(siteId)
              setEpic(null)
            }}
          />
        ) : null}
        <PickerField
          label={translate('specflow.jira.project', 'Project')}
          value={target.projectId}
          options={
            target.projects?.map((candidate) => ({
              id: candidate.id,
              label: `${candidate.key} · ${candidate.name}`
            })) ?? null
          }
          disabled={publish.running}
          onChange={(projectId) => {
            target.setProjectId(projectId)
            setEpic(null)
          }}
        />
        <PickerField
          label={translate('specflow.jira.issueType', 'Issue type')}
          value={target.issueTypeId}
          options={
            project
              ? (target.issueTypes?.map((type) => ({ id: type.id, label: type.name })) ?? null)
              : []
          }
          disabled={publish.running || !project}
          onChange={target.setIssueTypeId}
        />
        <div className="space-y-2">
          <Label>{translate('specflow.jira.epic', 'Epic (optional)')}</Label>
          <JiraEpicPicker
            key={project?.id ?? 'none'}
            source={target.source}
            siteId={target.siteId}
            projectKey={project?.key ?? ''}
            value={epic}
            disabled={publish.running || !project}
            onChange={setEpic}
          />
        </div>
      </div>
      {epicUnsupported ? (
        <p className="text-xs text-destructive">
          {translate(
            'specflow.jira.epicUnsupported',
            'This issue type has no parent or Epic Link field. Clear the epic or pick another issue type.'
          )}
        </p>
      ) : null}
      {target.loadError ? <p className="text-xs text-destructive">{target.loadError}</p> : null}

      <JiraPublishTaskList
        tasks={props.tasks}
        selectedIds={selectedIds}
        outcomes={publish.outcomes}
        locked={publish.running || finished}
        onToggle={(taskId, selected) =>
          setSelectedIds((current) => {
            const next = new Set(current)
            if (selected) {
              next.add(taskId)
            } else {
              next.delete(taskId)
            }
            return next
          })
        }
      />

      <DialogFooter className="items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">
          {finished
            ? translate('specflow.jira.summary', '{{created}} created, {{failed}} failed', counts)
            : translate('specflow.jira.selectedCount', '{{count}} selected', {
                count: toPublish.length
              })}
        </span>
        <div className="flex gap-2">
          {finished ? (
            <>
              <Button variant="ghost" onClick={publish.reset}>
                {translate('specflow.jira.publishMore', 'Publish more')}
              </Button>
              <Button onClick={props.onClose}>{translate('specflow.jira.done', 'Done')}</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" disabled={publish.running} onClick={props.onClose}>
                {translate('specflow.jira.cancel', 'Cancel')}
              </Button>
              <Button disabled={!ready || publish.running} onClick={start}>
                {publish.running ? <LoaderCircle className="animate-spin" /> : <CloudUpload />}
                {publish.running
                  ? translate('specflow.jira.publishing', 'Publishing…')
                  : translate('specflow.jira.publishCount', 'Publish {{count}}', {
                      count: toPublish.length
                    })}
              </Button>
            </>
          )}
        </div>
      </DialogFooter>
    </>
  )
}

export function JiraPublishDialog(props: {
  open: boolean
  tasks: readonly SpecflowTask[]
  preselectedTaskIds: readonly string[] | undefined
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {translate('specflow.jira.dialogTitle', 'Publish tasks to Jira')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'specflow.jira.dialogDescription',
              'Creates one Jira issue per selected task and records the issue key in SpecFlow. Linked tasks are skipped.'
            )}
          </DialogDescription>
        </DialogHeader>
        {props.open ? (
          <JiraPublishBody
            tasks={props.tasks}
            preselectedTaskIds={props.preselectedTaskIds}
            onClose={() => props.onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
