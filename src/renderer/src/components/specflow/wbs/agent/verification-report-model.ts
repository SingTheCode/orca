// Mirrors SpecFlow `models.VerificationReport` as served by `GET /tasks/:id/reports`.
// `error_summary` is a jsonb column mapped to a Go string, so it normally arrives as JSON text;
// older writers stored `{}` or ad-hoc objects (SonarQube metrics, `{source}`), and null is possible.
export type SpecflowVerificationReport = {
  id: string
  task_id: string
  verification_type: string // 'UNIT' | 'E2E' | 'SONARQUBE'; kept open because the column is free text
  status: string // 'PASS' | 'FAIL'
  raw_log: string | null
  error_summary: unknown
  created_at: string
}

export type VerificationReportDetail = { key: string; value: string }

export type VerificationReportView = {
  id: string
  type: string
  passed: boolean
  createdAt: string
  /** Agent-written summary (`summary` key) or the lines of an array summary. */
  summary: string | null
  commitHash: string | null
  /** Remaining summary keys (e.g. SonarQube metrics), in server order. */
  details: VerificationReportDetail[]
  rawLog: string
}

function parseSummaryValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value ?? null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return parsed
  } catch {
    // Why: a non-JSON string is still readable text, so show it rather than drop it.
    return trimmed
  }
}

function displayValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

function normalizeSummary(
  raw: unknown
): Pick<VerificationReportView, 'summary' | 'commitHash' | 'details'> {
  const parsed = parseSummaryValue(raw)
  if (parsed === null) {
    return { summary: null, commitHash: null, details: [] }
  }
  if (Array.isArray(parsed)) {
    const lines = parsed
      .filter((item) => item !== null && item !== '')
      .map((item) => displayValue(item))
    return { summary: lines.length ? lines.join('\n') : null, commitHash: null, details: [] }
  }
  if (typeof parsed !== 'object') {
    return { summary: displayValue(parsed), commitHash: null, details: [] }
  }
  const entries = Object.entries(parsed)
  const details = entries
    .filter(
      ([key, value]) => key !== 'summary' && key !== 'commit_hash' && value !== null && value !== ''
    )
    .map(([key, value]) => ({ key, value: displayValue(value) }))
  const { summary, commit_hash: commitHash } = Object.fromEntries(entries)
  return {
    summary: typeof summary === 'string' && summary.trim() ? summary.trim() : null,
    commitHash: typeof commitHash === 'string' && commitHash.trim() ? commitHash.trim() : null,
    details
  }
}

// Why: unparseable times sort last instead of poisoning the comparator with NaN.
const UNKNOWN_TIME = Number.NEGATIVE_INFINITY

/** Normalizes server reports and orders them newest first (unparseable times last). */
export function normalizeVerificationReports(
  reports: readonly SpecflowVerificationReport[] | null
): VerificationReportView[] {
  return (reports ?? [])
    .map((report) => {
      const time = Date.parse(report.created_at)
      return {
        time: Number.isNaN(time) ? UNKNOWN_TIME : time,
        view: {
          id: report.id,
          type: report.verification_type.trim().toUpperCase() || 'UNIT',
          passed: report.status.trim().toUpperCase() === 'PASS',
          createdAt: report.created_at,
          rawLog: report.raw_log ?? '',
          ...normalizeSummary(report.error_summary)
        }
      }
    })
    .sort((a, b) => b.time - a.time)
    .map((entry) => entry.view)
}
