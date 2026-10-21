import { z } from 'zod'
import type {
  SpecflowSubtask,
  SpecflowSubtaskProposal,
  SpecflowTask,
  SpecflowTaskCreate,
  SpecflowTaskPriority,
  SpecflowTaskProposal,
  SpecflowTaskStatus
} from './specflow-task-types'

export const TASK_PRIORITIES: readonly SpecflowTaskPriority[] = ['P0', 'P1', 'P2']

export const TASK_STATUSES: readonly SpecflowTaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'TESTING',
  'SONAR_SCAN',
  'DONE'
]

// Mirrors `backend/services/task_status.go` allowedTransitions; the server re-checks every change.
const NEXT_STATUSES: Record<SpecflowTaskStatus, readonly SpecflowTaskStatus[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['TODO', 'TESTING', 'SONAR_SCAN', 'DONE'],
  TESTING: ['IN_PROGRESS', 'SONAR_SCAN', 'DONE'],
  SONAR_SCAN: ['IN_PROGRESS', 'TESTING', 'DONE'],
  DONE: ['IN_PROGRESS']
}

/** Statuses reachable from `from` in one step, in pipeline order. */
export function allowedNextStatuses(from: SpecflowTaskStatus): SpecflowTaskStatus[] {
  return TASK_STATUSES.filter((status) => NEXT_STATUSES[from]?.includes(status))
}

export type TaskGroupBy = 'priority' | 'status'

export type TaskGroup = { key: string; tasks: SpecflowTask[] }

function compareByStartThenTitle(a: SpecflowTask, b: SpecflowTask): number {
  const aStart = a.start_date ?? '\uffff'
  const bStart = b.start_date ?? '\uffff'
  return aStart === bStart ? a.title.localeCompare(b.title) : aStart < bStart ? -1 : 1
}

/** Groups in canonical order (P0→P2 or TODO→DONE), unknown values last; empty groups dropped. */
export function groupTasks(tasks: readonly SpecflowTask[], groupBy: TaskGroupBy): TaskGroup[] {
  const order: readonly string[] = groupBy === 'priority' ? TASK_PRIORITIES : TASK_STATUSES
  const buckets = new Map<string, SpecflowTask[]>()
  for (const key of order) {
    buckets.set(key, [])
  }
  for (const task of tasks) {
    const key = groupBy === 'priority' ? task.priority : task.status
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(task)
    } else {
      buckets.set(key, [task])
    }
  }
  return [...buckets]
    .filter(([, bucketTasks]) => bucketTasks.length > 0)
    .map(([key, bucketTasks]) => ({ key, tasks: bucketTasks.sort(compareByStartThenTitle) }))
}

/** `YYYY-MM-DD` from the server's RFC 3339 date, '' when absent. */
export function taskDatePart(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

// Lenient: the web client and MCP agents both write this column; keep whatever is usable.
const SubtaskEntrySchema = z.object({
  id: z.number().optional().catch(undefined),
  name: z.string(),
  prompt: z.string().optional().catch(undefined),
  done_condition: z.string().optional().catch(undefined),
  checked: z.boolean().optional().catch(undefined)
})

/** Parses the stored `subtasks` JSON; malformed or foreign data yields an empty list. */
export function parseSubtasks(raw: string): SpecflowSubtask[] {
  if (!raw.trim()) {
    return []
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) {
    return []
  }
  const subtasks: SpecflowSubtask[] = []
  for (const [index, item] of parsed.entries()) {
    const entry = SubtaskEntrySchema.safeParse(item)
    if (!entry.success) {
      continue
    }
    subtasks.push({
      id: entry.data.id ?? index,
      name: entry.data.name,
      prompt: entry.data.prompt ?? '',
      done_condition: entry.data.done_condition ?? '',
      checked: entry.data.checked === true
    })
  }
  return subtasks
}

/** Appends AI proposals as unchecked subtasks with ids unique within the list. */
export function appendSubtaskProposals(
  existing: readonly SpecflowSubtask[],
  proposals: readonly SpecflowSubtaskProposal[]
): SpecflowSubtask[] {
  const base = existing.reduce((max, subtask) => Math.max(max, subtask.id), 0) + 1
  return [
    ...existing,
    ...proposals.map((proposal, index) => ({
      id: base + index,
      name: proposal.name,
      prompt: proposal.prompt,
      done_condition: proposal.done_condition,
      checked: false
    }))
  ]
}

function clampScore(value: number): number {
  return Number.isFinite(value) && value >= 1 ? Math.min(Math.round(value), 10) : 5
}

/** Chat proposal → batch-create item; unknown priorities fall back to P1 like the web client. */
export function proposalToTaskCreate(proposal: SpecflowTaskProposal): SpecflowTaskCreate {
  const priority = TASK_PRIORITIES.find((candidate) => candidate === proposal.priority) ?? 'P1'
  return {
    title: proposal.title,
    description: proposal.description,
    priority,
    status: 'TODO',
    urgency: clampScore(proposal.urgency),
    importance: clampScore(proposal.importance)
  }
}
