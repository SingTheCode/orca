import type { JiraCreateField, JiraCreateIssueArgs } from '../../../../../../shared/jira-types'
import { buildJiraTextMatchJql } from '../../../../../../shared/jira-search-input-jql'
import { parseSubtasks, taskDatePart } from '../specflow-task-model'
import type { SpecflowTask } from '../specflow-task-types'

/** Jira rejects summaries longer than 255 characters (Java string length, i.e. UTF-16 units). */
export const JIRA_SUMMARY_MAX_LENGTH = 255

const ELLIPSIS = '…'
// Jira Software's legacy epic field (Server/DC and older Cloud company-managed projects).
const EPIC_LINK_SCHEMA = 'com.pyxis.greenhopper.jira:gh-epic-link'

/** How the chosen issue type attaches to an epic: the `parent` field, or the legacy Epic Link. */
export type JiraEpicField = { kind: 'parent' } | { kind: 'epic-link'; fieldKey: string }

export type JiraPublishTarget = {
  siteId: string
  projectId: string
  issueTypeId: string
  epic: { key: string; field: JiraEpicField } | null
}

/** Section labels written into the Jira description, localized by the caller. */
export type JiraDescriptionLabels = {
  subtasks: string
  doneWhen: string
  priority: string
  start: string
  end: string
}

/** Single-line summary within Jira's limit; never splits a surrogate pair. */
export function jiraSummaryFromTitle(title: string): string {
  const normalized = title.replace(/\s+/g, ' ').trim()
  if (normalized.length <= JIRA_SUMMARY_MAX_LENGTH) {
    return normalized
  }
  let summary = ''
  for (const char of normalized) {
    if (summary.length + char.length > JIRA_SUMMARY_MAX_LENGTH - ELLIPSIS.length) {
      break
    }
    summary += char
  }
  return `${summary.trimEnd()}${ELLIPSIS}`
}

// Plain lines only: the host turns each line into an ADF paragraph (Cloud) or sends it as
// wiki text (Server/DC), and a `- ` prefix reads as a bullet in both.
export function buildJiraDescription(task: SpecflowTask, labels: JiraDescriptionLabels): string {
  const sections: string[] = []
  const body = task.description.trim()
  if (body) {
    sections.push(body)
  }
  const subtasks = parseSubtasks(task.subtasks)
  if (subtasks.length > 0) {
    const lines = subtasks.map((subtask) => {
      const doneCondition = subtask.done_condition.trim()
      return doneCondition
        ? `- ${subtask.name.trim()} (${labels.doneWhen}: ${doneCondition})`
        : `- ${subtask.name.trim()}`
    })
    sections.push([`${labels.subtasks}:`, ...lines].join('\n'))
  }
  const meta = [`${labels.priority}: ${task.priority}`]
  const start = taskDatePart(task.start_date)
  const end = taskDatePart(task.end_date)
  if (start) {
    meta.push(`${labels.start}: ${start}`)
  }
  if (end) {
    meta.push(`${labels.end}: ${end}`)
  }
  sections.push(meta.join(' · '))
  return sections.join('\n\n')
}

/** Prefers `parent` (current Jira) and falls back to the legacy Epic Link field; null when neither is on the create screen. */
export function resolveEpicField(fields: readonly JiraCreateField[]): JiraEpicField | null {
  if (fields.some((field) => field.key === 'parent')) {
    return { kind: 'parent' }
  }
  const epicLink = fields.find((field) => field.schema?.custom === EPIC_LINK_SCHEMA)
  return epicLink ? { kind: 'epic-link', fieldKey: epicLink.key } : null
}

export function buildJiraIssuePayload(
  task: SpecflowTask,
  target: JiraPublishTarget,
  labels: JiraDescriptionLabels
): JiraCreateIssueArgs {
  const { epic } = target
  return {
    siteId: target.siteId,
    projectId: target.projectId,
    issueTypeId: target.issueTypeId,
    title: jiraSummaryFromTitle(task.title),
    description: buildJiraDescription(task, labels),
    customFields: epic
      ? epic.field.kind === 'parent'
        ? { parent: { key: epic.key } }
        : { [epic.field.fieldKey]: epic.key }
      : undefined
  }
}

export function isLinkedToJira(task: SpecflowTask): boolean {
  return task.jira_ticket_key.trim() !== ''
}

/** Selected tasks in list order; linked tasks never publish twice. */
export function tasksToPublish(
  tasks: readonly SpecflowTask[],
  selectedIds: ReadonlySet<string>
): SpecflowTask[] {
  return tasks.filter((task) => selectedIds.has(task.id) && !isLinkedToJira(task))
}

/** Preselected ids when given (the detail sheet's single task), otherwise every unlinked task. */
export function initialPublishSelection(
  tasks: readonly SpecflowTask[],
  preselectedIds?: readonly string[]
): Set<string> {
  const wanted = preselectedIds ? new Set(preselectedIds) : null
  return new Set(
    tasks
      .filter((task) => !isLinkedToJira(task) && (wanted === null || wanted.has(task.id)))
      .map((task) => task.id)
  )
}

/** Epics of one project, optionally narrowed by free text, most recently updated first. */
export function buildEpicSearchJql(projectKey: string, query: string): string {
  const clauses = [`project = "${projectKey.replace(/["\\]/g, '\\$&')}"`, 'issuetype = Epic']
  const text = buildJiraTextMatchJql(query)
  if (text) {
    clauses.push(text)
  }
  return `${clauses.join(' AND ')} ORDER BY updated DESC`
}
