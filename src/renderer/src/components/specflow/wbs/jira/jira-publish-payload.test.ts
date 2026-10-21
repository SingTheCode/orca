import { describe, expect, it } from 'vitest'
import type { JiraCreateField } from '../../../../../../shared/jira-types'
import type { SpecflowTask } from '../specflow-task-types'
import {
  buildEpicSearchJql,
  buildJiraDescription,
  buildJiraIssuePayload,
  initialPublishSelection,
  JIRA_SUMMARY_MAX_LENGTH,
  jiraSummaryFromTitle,
  resolveEpicField,
  tasksToPublish
} from './jira-publish-payload'

const LABELS = {
  subtasks: 'Subtasks',
  doneWhen: 'done when',
  priority: 'Priority',
  start: 'Start',
  end: 'End'
}

function task(overrides: Partial<SpecflowTask>): SpecflowTask {
  return {
    id: 'id',
    project_id: 'p',
    title: 'T',
    description: '',
    priority: 'P1',
    status: 'TODO',
    dependencies: null,
    jira_ticket_key: '',
    jira_issue_id: '',
    jira_url: '',
    jira_synced_at: null,
    jira_sync_error: '',
    start_date: null,
    end_date: null,
    urgency: 5,
    importance: 5,
    complexity: 5,
    subtasks: '',
    created_at: '',
    updated_at: '',
    ...overrides
  }
}

function field(key: string, custom?: string): JiraCreateField {
  return { key, name: key, required: false, schema: custom ? { custom } : {} }
}

describe('jiraSummaryFromTitle', () => {
  it('collapses whitespace and keeps short titles', () => {
    expect(jiraSummaryFromTitle('  Login\n  form ')).toBe('Login form')
  })

  it('truncates to 255 UTF-16 units with an ellipsis', () => {
    const summary = jiraSummaryFromTitle('a'.repeat(400))
    expect(summary).toHaveLength(JIRA_SUMMARY_MAX_LENGTH)
    expect(summary.endsWith('…')).toBe(true)
  })

  it('never splits a surrogate pair', () => {
    const summary = jiraSummaryFromTitle('😀'.repeat(200))
    expect(summary.length).toBeLessThanOrEqual(JIRA_SUMMARY_MAX_LENGTH)
    expect(summary).toBe(`${'😀'.repeat(127)}…`)
  })
})

describe('buildJiraDescription', () => {
  it('joins description, subtask list, and a priority/date line', () => {
    const description = buildJiraDescription(
      task({
        description: ' Build the login form. ',
        priority: 'P0',
        start_date: '2026-10-21T00:00:00Z',
        end_date: '2026-10-24T00:00:00Z',
        subtasks: JSON.stringify([
          { id: 1, name: 'Markup', prompt: '', done_condition: 'renders', checked: false },
          { id: 2, name: 'Validation', prompt: '', done_condition: '', checked: true }
        ])
      }),
      LABELS
    )
    expect(description).toBe(
      [
        'Build the login form.',
        'Subtasks:\n- Markup (done when: renders)\n- Validation',
        'Priority: P0 · Start: 2026-10-21 · End: 2026-10-24'
      ].join('\n\n')
    )
  })

  it('keeps only the meta line for a bare task', () => {
    expect(buildJiraDescription(task({ subtasks: 'not json' }), LABELS)).toBe('Priority: P1')
  })
})

describe('resolveEpicField', () => {
  it('prefers parent over the legacy Epic Link', () => {
    const fields = [
      field('customfield_10014', 'com.pyxis.greenhopper.jira:gh-epic-link'),
      field('parent')
    ]
    expect(resolveEpicField(fields)).toEqual({ kind: 'parent' })
  })

  it('falls back to the Epic Link custom field', () => {
    const fields = [
      field('summary'),
      field('customfield_10014', 'com.pyxis.greenhopper.jira:gh-epic-link')
    ]
    expect(resolveEpicField(fields)).toEqual({ kind: 'epic-link', fieldKey: 'customfield_10014' })
  })

  it('returns null when neither field is on the create screen', () => {
    expect(resolveEpicField([field('summary')])).toBeNull()
  })
})

describe('buildJiraIssuePayload', () => {
  const base = { siteId: 's', projectId: '100', issueTypeId: '10001' }

  it('omits custom fields without an epic', () => {
    const payload = buildJiraIssuePayload(task({ title: 'A' }), { ...base, epic: null }, LABELS)
    expect(payload).toEqual({
      ...base,
      title: 'A',
      description: 'Priority: P1',
      customFields: undefined
    })
  })

  it('shapes the parent field as an object', () => {
    const payload = buildJiraIssuePayload(
      task({}),
      { ...base, epic: { key: 'ABC-1', field: { kind: 'parent' } } },
      LABELS
    )
    expect(payload.customFields).toEqual({ parent: { key: 'ABC-1' } })
  })

  it('shapes the Epic Link field as a bare key', () => {
    const payload = buildJiraIssuePayload(
      task({}),
      {
        ...base,
        epic: { key: 'ABC-1', field: { kind: 'epic-link', fieldKey: 'customfield_10014' } }
      },
      LABELS
    )
    expect(payload.customFields).toEqual({ customfield_10014: 'ABC-1' })
  })
})

describe('selection', () => {
  const tasks = [
    task({ id: 'a' }),
    task({ id: 'b', jira_ticket_key: 'ORCA-1' }),
    task({ id: 'c' }),
    task({ id: 'd', jira_ticket_key: '  ' })
  ]

  it('preselects every unlinked task by default', () => {
    expect([...initialPublishSelection(tasks)]).toEqual(['a', 'c', 'd'])
  })

  it('narrows to the preselected task and still drops linked ones', () => {
    expect([...initialPublishSelection(tasks, ['c', 'b'])]).toEqual(['c'])
  })

  it('publishes selected unlinked tasks in list order', () => {
    expect(tasksToPublish(tasks, new Set(['c', 'b', 'a'])).map((item) => item.id)).toEqual([
      'a',
      'c'
    ])
  })
})

describe('buildEpicSearchJql', () => {
  it('scopes to project epics and escapes quotes', () => {
    expect(buildEpicSearchJql('AB"C', '')).toBe(
      'project = "AB\\"C" AND issuetype = Epic ORDER BY updated DESC'
    )
  })

  it('adds a text clause for a query', () => {
    expect(buildEpicSearchJql('ABC', 'login')).toBe(
      'project = "ABC" AND issuetype = Epic AND text ~ "login*" ORDER BY updated DESC'
    )
  })
})
