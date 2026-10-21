import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { KeyRound, Link2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { ErdTable } from './erd-schema'

export type ErdTableFlowNode = Node<{ table: ErdTable }, 'customTableNode'>

// Every column exposes a target handle (left) and a source handle (right), keyed by column name,
// matching the server edges' `sourceHandle` (FK column) / `targetHandle` (referenced column).
function ErdTableNodeView({ data, selected }: NodeProps<ErdTableFlowNode>): React.JSX.Element {
  const { table } = data
  return (
    <div
      className={cn(
        'min-w-56 overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs',
        selected ? 'border-ring ring-1 ring-ring' : 'border-border'
      )}
    >
      <div className="border-b border-border bg-muted px-3 py-2">
        <div className="truncate font-mono text-sm font-semibold">{table.name}</div>
        {table.description ? (
          <div className="line-clamp-2 max-w-64 text-2xs text-muted-foreground">
            {table.description}
          </div>
        ) : null}
      </div>
      <div className="py-1">
        {(table.columns ?? []).map((column) => (
          <div
            key={column.name}
            className="relative flex items-center justify-between gap-3 px-3 py-1 text-xs"
          >
            <Handle type="target" position={Position.Left} id={column.name} />
            <div className="flex min-w-0 items-center gap-1.5 font-mono">
              {column.pk ? (
                <KeyRound
                  className="size-3 shrink-0 text-foreground"
                  aria-label={translate('specflow.erd.primaryKey', 'Primary key')}
                />
              ) : column.fk ? (
                <Link2
                  className="size-3 shrink-0 text-muted-foreground"
                  aria-label={translate('specflow.erd.foreignKey', 'Foreign key')}
                />
              ) : (
                <span className="size-3 shrink-0" />
              )}
              <span className={cn('truncate', column.pk && 'font-semibold')}>{column.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 font-mono text-muted-foreground">
              <span>{column.type}</span>
              {column.fk && column.fk_target ? (
                <span className="text-3xs" title={column.fk_target}>
                  FK
                </span>
              ) : null}
              <span className="w-2 text-3xs">{column.nullable ? '?' : ''}</span>
            </div>
            <Handle type="source" position={Position.Right} id={column.name} />
          </div>
        ))}
      </div>
    </div>
  )
}

export const ErdTableNode = memo(ErdTableNodeView)
