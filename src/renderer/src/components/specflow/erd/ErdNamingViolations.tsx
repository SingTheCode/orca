import { TriangleAlert } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { ErdNamingViolation } from './use-erd-schema'

export function ErdNamingViolations({
  violations
}: {
  violations: ErdNamingViolation[]
}): React.JSX.Element | null {
  if (violations.length === 0) {
    return null
  }
  return (
    <div className="space-y-1 rounded-md border border-border bg-muted px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5 font-medium">
        <TriangleAlert className="size-3.5 text-muted-foreground" />
        {translate('specflow.erd.namingViolations', '{{count}} naming issues', {
          count: violations.length
        })}
      </div>
      <ul className="space-y-0.5 text-muted-foreground">
        {violations.map((violation) => {
          const target = violation.column
            ? `${violation.table}.${violation.column}`
            : violation.table
          return (
            <li key={`${target}:${violation.reason}`}>
              <span className="font-mono text-foreground">{target}</span> — {violation.reason}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
