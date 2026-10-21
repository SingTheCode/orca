// Shapes returned by SpecFlow's code graph API (backend/controllers/code_graph_controller.go).

export type CodeGraphNode = {
  id: string
  kind: string
  name: string
  qualified_name: string
  language: string
  /** Workspace-relative path; empty for synthetic nodes. */
  path: string
  start_line: number
  end_line: number
  parent_id: string | null
  signature: string
}

export type CodeGraphSnapshot = {
  id: string
  status: 'RUNNING' | 'READY' | 'FAILED'
  /** JSON-encoded string array, e.g. `["go","typescript"]`. */
  languages: string
  node_count: number
  edge_count: number
  error_message: string
}

export type CodeGraphOverview = { roots: CodeGraphNode[]; counts: Record<string, number> }

export type CodeGraphEntryPoints = {
  routes: { route: CodeGraphNode; handler: CodeGraphNode | null }[]
  main_functions: CodeGraphNode[]
}

export type CodeGraphKeyFile = {
  file: CodeGraphNode
  defines: number
  routes: number
  fan_in: number
  lines: number
  score: number
}

/** Subset of `GET /projects/:id` the import poll reads. */
export type SpecflowImportProject = {
  status: string
  import_progress: number
  import_stage: string
  import_error: string
}

// Why 30: runSourceImportPipeline sets 30 right after the zip is extracted; the remaining stages
// are LLM spec generation that the code graph does not need.
export const IMPORT_EXTRACTED_PROGRESS = 30

export type ImportStep =
  | { kind: 'wait'; progress: number; stage: string }
  | { kind: 'analyze' }
  | { kind: 'failed'; error: string }

/** Decides whether the uploaded source is ready for code analysis. */
export function nextImportStep(project: SpecflowImportProject): ImportStep {
  const extracted = project.import_progress >= IMPORT_EXTRACTED_PROGRESS
  if (project.status === 'READY' || extracted) {
    return { kind: 'analyze' }
  }
  if (project.status === 'FAILED') {
    return { kind: 'failed', error: project.import_error || 'Source import failed.' }
  }
  return { kind: 'wait', progress: project.import_progress, stage: project.import_stage }
}

export function parseSnapshotLanguages(raw: string | null | undefined): string[] {
  if (!raw) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : []
  } catch {
    return []
  }
}

/** Non-zero kind counts, largest first. */
export function sortedKindCounts(counts: Record<string, number>): [string, number][] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export function nodeLocation(node: CodeGraphNode): string {
  if (!node.path) {
    return ''
  }
  return node.start_line > 0 ? `${node.path}:${node.start_line}` : node.path
}
