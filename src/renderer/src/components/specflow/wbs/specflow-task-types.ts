// Shapes mirror the SpecFlow Go models (`backend/models` Task, `controllers/task_controller.go` inputs).
// The server also embeds a zero-valued `project` object in every task; it is never read here.

export type SpecflowTaskPriority =
  | 'P0' // highest
  | 'P1'
  | 'P2'

export type SpecflowTaskStatus = 'TODO' | 'IN_PROGRESS' | 'TESTING' | 'SONAR_SCAN' | 'DONE'

export type SpecflowTask = {
  id: string
  project_id: string
  title: string
  description: string
  priority: SpecflowTaskPriority
  status: SpecflowTaskStatus
  /** Prerequisite task ids; null when the column is empty. */
  dependencies: string[] | null
  jira_ticket_key: string
  jira_issue_id: string
  jira_url: string
  jira_synced_at: string | null
  jira_sync_error: string
  /** RFC 3339 midnight UTC (`2026-10-21T00:00:00Z`); the date part is the value. */
  start_date: string | null
  end_date: string | null
  urgency: number
  importance: number
  complexity: number
  /** JSON-encoded `SpecflowSubtask[]`, or '' when none were saved. */
  subtasks: string
  created_at: string
  updated_at: string
}

/** One entry of the `subtasks` JSON string, as written by the SpecFlow web client. */
export type SpecflowSubtask = {
  id: number
  name: string
  prompt: string
  done_condition: string
  checked: boolean
}

export type SpecflowSubtaskProposal = { name: string; prompt: string; done_condition: string }

/** `PUT /tasks/:id` body; dates are `YYYY-MM-DD` or '' to clear. Empty strings leave text fields unchanged. */
export type SpecflowTaskUpdate = {
  title?: string
  description?: string
  priority?: SpecflowTaskPriority
  start_date?: string
  end_date?: string
  subtasks?: string
}

export type SpecflowTaskProposal = {
  title: string
  description: string
  priority: string
  urgency: number
  importance: number
}

export type SpecflowChatMessage = { role: 'user' | 'assistant'; content: string }

export type SpecflowTaskChatResponse = {
  reply: string
  tasks: SpecflowTaskProposal[] | null
  dialog_state: string
}

/** `POST /projects/:id/tasks/batch` item (`CreateTaskInput`). */
export type SpecflowTaskCreate = {
  title: string
  description: string
  priority: SpecflowTaskPriority
  status: 'TODO'
  urgency: number
  importance: number
}

export type SpecflowBatchCreateResponse = {
  tasks: SpecflowTask[]
  dedup_summary: { created: number; merged: number; reopened: number }
}
