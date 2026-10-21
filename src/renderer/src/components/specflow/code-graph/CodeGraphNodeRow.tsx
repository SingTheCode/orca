import { Badge } from '@/components/ui/badge'
import { nodeLocation, type CodeGraphNode } from './code-graph-model'

export function CodeGraphNodeRow({
  node,
  selected,
  trailing,
  onSelect
}: {
  node: CodeGraphNode
  selected: boolean
  trailing?: string
  onSelect: (node: CodeGraphNode) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-current={selected ? 'true' : undefined}
      onClick={() => onSelect(node)}
      className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[current=true]:bg-accent"
    >
      <Badge variant="outline" className="shrink-0">
        <span className="font-mono text-3xs">{node.kind}</span>
      </Badge>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{node.name || node.path}</span>
        <span className="block truncate font-mono text-2xs text-muted-foreground">
          {nodeLocation(node)}
        </span>
      </span>
      {trailing ? (
        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">{trailing}</span>
      ) : null}
    </button>
  )
}

export function CodeGraphNodeList({
  nodes,
  selectedId,
  empty,
  onSelect
}: {
  nodes: CodeGraphNode[]
  selectedId: string | null
  empty: string
  onSelect: (node: CodeGraphNode) => void
}): React.JSX.Element {
  if (nodes.length === 0) {
    return <p className="px-2 py-1.5 text-xs text-muted-foreground">{empty}</p>
  }
  return (
    <div className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <CodeGraphNodeRow
          key={node.id}
          node={node}
          selected={node.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
