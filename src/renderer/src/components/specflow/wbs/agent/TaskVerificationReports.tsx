import { useEffect, useState } from 'react'
import { ChevronRight, LoaderCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { translate } from '@/i18n/i18n'
import { specflowRequest } from '../../specflow-client'
import type { SpecflowTask } from '../specflow-task-types'
import {
  normalizeVerificationReports,
  type SpecflowVerificationReport,
  type VerificationReportView
} from './verification-report-model'

function ReportRow({ report }: { report: VerificationReportView }): React.JSX.Element {
  const time = new Date(report.createdAt)
  return (
    <li className="space-y-1.5 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{report.type}</Badge>
        <Badge variant={report.passed ? 'secondary' : 'destructive'}>
          {report.passed
            ? translate('specflow.agent.reports.pass', 'PASS')
            : translate('specflow.agent.reports.fail', 'FAIL')}
        </Badge>
        {report.commitHash ? (
          <span className="truncate font-mono text-2xs text-muted-foreground">
            {report.commitHash.slice(0, 12)}
          </span>
        ) : null}
        <span className="ml-auto shrink-0 text-2xs text-muted-foreground">
          {Number.isNaN(time.getTime()) ? report.createdAt : time.toLocaleString()}
        </span>
      </div>
      {report.summary ? <p className="text-sm whitespace-pre-wrap">{report.summary}</p> : null}
      {report.details.length > 0 ? (
        <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {report.details.map((detail) => (
            <div key={detail.key} className="flex gap-1">
              <dt>{detail.key}</dt>
              <dd className="font-mono text-foreground">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {report.rawLog ? (
        <Collapsible>
          <CollapsibleTrigger>
            <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronRight className="size-3 transition-transform in-data-[state=open]:rotate-90" />
              {translate('specflow.agent.reports.rawLog', 'Raw log')}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="scrollbar-sleek mt-1.5 max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-2xs whitespace-pre-wrap">
              {report.rawLog}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </li>
  )
}

/** Verification reports submitted for the task, newest first. */
export function TaskVerificationReports({ task }: { task: SpecflowTask }): React.JSX.Element {
  const [reports, setReports] = useState<VerificationReportView[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Why: the WBS list refetches on every task SSE event (including `result_submitted`) and hands
  // the sheet a fresh task object, so keying on the object reloads reports when an agent reports.
  useEffect(() => {
    let cancelled = false
    specflowRequest<SpecflowVerificationReport[] | null>('GET', `/tasks/${task.id}/reports`)
      .then((list) => {
        if (!cancelled) {
          setReports(normalizeVerificationReports(list))
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [task])

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>
  }
  if (reports === null) {
    return <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
  }
  if (reports.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {translate(
          'specflow.agent.reports.empty',
          'No verification reports yet. Agents submit them with submit_task_result.'
        )}
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {reports.map((report) => (
        <ReportRow key={report.id} report={report} />
      ))}
    </ul>
  )
}
