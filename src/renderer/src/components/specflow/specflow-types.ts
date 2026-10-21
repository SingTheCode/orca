export type SpecflowTabId = 'specs' | 'wbs' | 'erd' | 'code-graph'

export type SpecflowTabProps = {
  projectId: string
  repoId: string
  /** Active worktree or folder path for the repo; null when none is open. */
  workspacePath: string | null
  worktreeId: string | null
}

/** Subset of `GET /projects` rows the page uses. */
export type SpecflowProjectSummary = { id: string; name: string; description: string }
