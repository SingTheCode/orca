import { describe, expect, it } from 'vitest'
import {
  allowedNextStatuses,
  appendSubtaskProposals,
  groupTasks,
  parseSubtasks,
  proposalToTaskCreate
} from './specflow-task-model'
import type { SpecflowTask } from './specflow-task-types'

function task(overrides: Partial<SpecflowTask>): SpecflowTask {
  return {
    id: 'id',
    project_id: 'p',
    title: 'T',
    description: '',
    priority: 'P1',
    status: 'TODO',
    dependencies: [],
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

describe('allowedNextStatuses', () => {
  it('mirrors the server transition table', () => {
    expect(allowedNextStatuses('TODO')).toEqual(['IN_PROGRESS'])
    expect(allowedNextStatuses('IN_PROGRESS')).toEqual(['TODO', 'TESTING', 'SONAR_SCAN', 'DONE'])
    expect(allowedNextStatuses('DONE')).toEqual(['IN_PROGRESS'])
  })
})

describe('groupTasks', () => {
  it('orders groups canonically, drops empty ones, sorts by start date then title', () => {
    const groups = groupTasks(
      [
        task({ id: 'a', priority: 'P2', title: 'b' }),
        task({ id: 'b', priority: 'P0', title: 'z', start_date: '2026-10-22T00:00:00Z' }),
        task({ id: 'c', priority: 'P0', title: 'y', start_date: '2026-10-21T00:00:00Z' }),
        task({ id: 'd', priority: 'P2', title: 'a' })
      ],
      'priority'
    )
    expect(groups.map((group) => [group.key, group.tasks.map((t) => t.id)])).toEqual([
      ['P0', ['c', 'b']],
      ['P2', ['d', 'a']]
    ])
  })
})

describe('subtasks', () => {
  it('parses the web client format and tolerates junk', () => {
    expect(parseSubtasks('')).toEqual([])
    expect(parseSubtasks('not json')).toEqual([])
    expect(parseSubtasks('{"a":1}')).toEqual([])
    expect(
      parseSubtasks(
        '[{"id":7,"name":"n","prompt":"p","done_condition":"d","checked":true},{"x":1}]'
      )
    ).toEqual([{ id: 7, name: 'n', prompt: 'p', done_condition: 'd', checked: true }])
  })

  it('appends proposals unchecked with unique ids', () => {
    const existing = [{ id: 5000, name: 'a', prompt: '', done_condition: '', checked: true }]
    const next = appendSubtaskProposals(existing, [
      { name: 'b', prompt: 'pb', done_condition: 'db' },
      { name: 'c', prompt: 'pc', done_condition: 'dc' }
    ])
    expect(next.map((subtask) => [subtask.id, subtask.name, subtask.checked])).toEqual([
      [5000, 'a', true],
      [5001, 'b', false],
      [5002, 'c', false]
    ])
  })
})

describe('proposalToTaskCreate', () => {
  it('normalizes priority and scores', () => {
    expect(
      proposalToTaskCreate({
        title: 't',
        description: 'd',
        priority: 'urgent',
        urgency: 0,
        importance: 14
      })
    ).toEqual({
      title: 't',
      description: 'd',
      priority: 'P1',
      status: 'TODO',
      urgency: 5,
      importance: 10
    })
  })
})
