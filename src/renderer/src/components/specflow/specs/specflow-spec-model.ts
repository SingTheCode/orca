export type SpecflowSpecType = 'PRD' | 'TRD' | 'QUESTIONS'

export const SPECFLOW_SPEC_TYPES: readonly SpecflowSpecType[] = ['PRD', 'TRD', 'QUESTIONS']

/** One stored version; `GET /projects/:id/specs` returns the latest per type, `/history` all of them. */
export type SpecflowSpec = {
  id: string
  type: string
  version: number
  content: string
  created_at: string
}

export type SpecflowSpecVersions = Partial<Record<SpecflowSpecType, number>>

/** `PUT /specs/:id` result; `report` summarizes the follow-up LLM refinement of specs and WBS. */
export type SpecflowSpecUpdateResult = {
  spec: SpecflowSpec
  report: {
    specs_refined: string[] | null
    tasks_updated_count: number
    tasks_deleted_count: number
    tasks_added_count: number
    tasks_refined_count: number
  }
}

function isSpecType(value: string): value is SpecflowSpecType {
  return SPECFLOW_SPEC_TYPES.some((type) => type === value)
}

export function latestSpecVersions(specs: readonly SpecflowSpec[]): SpecflowSpecVersions {
  const versions: SpecflowSpecVersions = {}
  for (const spec of specs) {
    if (isSpecType(spec.type) && spec.version > (versions[spec.type] ?? 0)) {
      versions[spec.type] = spec.version
    }
  }
  return versions
}

/** True once any spec type has a version above the baseline (a type that did not exist counts). */
export function hasNewerSpecVersion(
  baseline: SpecflowSpecVersions,
  specs: readonly SpecflowSpec[]
): boolean {
  const latest = latestSpecVersions(specs)
  return SPECFLOW_SPEC_TYPES.some((type) => (latest[type] ?? 0) > (baseline[type] ?? 0))
}

/** History versions of one type, newest first. */
export function specHistoryForType(
  history: readonly SpecflowSpec[],
  type: SpecflowSpecType
): SpecflowSpec[] {
  return history.filter((spec) => spec.type === type).sort((a, b) => b.version - a.version)
}

export function buildGrillPrompt(project: { name: string; description: string }): string {
  const description = project.description.trim()
  return [
    '/skill:grill-me',
    '',
    `Project: ${project.name.trim()}`,
    ...(description ? [`Description: ${description}`] : []),
    '',
    'When we reach a shared understanding and I confirm it, call the SpecFlow MCP tool submit_grill_decisions right away with a one-paragraph summary and every decision as {question, answer}.',
    // Why: plan mode otherwise turns the submission into a plan proposal and stops at Plan Review.
    'Do this directly in plan mode: the MCP call is allowed here. Do not write or propose a plan for the submission.'
  ].join('\n')
}
