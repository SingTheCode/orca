import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { specflowRequest } from '../specflow-client'
import { nodeLocation, type CodeGraphNode } from './code-graph-model'
import { CodeGraphNodeList } from './CodeGraphNodeRow'

type NodeRelations = {
  node: CodeGraphNode
  children: CodeGraphNode[]
  callers: CodeGraphNode[]
  callees: CodeGraphNode[]
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: NodeRelations }

async function loadRelations(projectId: string, nodeId: string): Promise<NodeRelations> {
  const base = `/projects/${projectId}/code-graph/nodes/${nodeId}`
  const [node, children, callers, callees] = await Promise.all([
    specflowRequest<CodeGraphNode>('GET', base),
    specflowRequest<{ children: CodeGraphNode[] | null }>('GET', `${base}/children`),
    specflowRequest<{ callers: CodeGraphNode[] | null }>('GET', `${base}/callers`),
    specflowRequest<{ callees: CodeGraphNode[] | null }>('GET', `${base}/callees`)
  ])
  return {
    node,
    children: children.children ?? [],
    callers: callers.callers ?? [],
    callees: callees.callees ?? []
  }
}

export function CodeGraphNodeDetail({
  projectId,
  nodeId,
  canGoBack,
  canOpen,
  onBack,
  onSelect,
  onOpen
}: {
  projectId: string
  nodeId: string
  canGoBack: boolean
  canOpen: boolean
  onBack: () => void
  onSelect: (node: CodeGraphNode) => void
  onOpen: (node: CodeGraphNode) => void
}): React.JSX.Element {
  const [state, setState] = useState<DetailState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    loadRelations(projectId, nodeId)
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ready', data })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectId, nodeId])

  if (state.status === 'loading') {
    return <LoaderCircle className="m-3 size-4 animate-spin text-muted-foreground" />
  }
  if (state.status === 'error') {
    return <p className="p-3 text-xs text-destructive">{state.error}</p>
  }
  const { node, children, callers, callees } = state.data
  const openable = canOpen && node.path.length > 0 && node.kind !== 'DIR'
  const sections: [string, CodeGraphNode[]][] = [
    [translate('specflow.codeGraph.callers', 'Callers'), callers],
    [translate('specflow.codeGraph.callees', 'Callees'), callees],
    [translate('specflow.codeGraph.children', 'Contains'), children]
  ]

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-start gap-2">
        {canGoBack ? (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onBack}
            aria-label={translate('specflow.codeGraph.back', 'Back')}
          >
            <ArrowLeft />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {node.kind}
            {node.language ? ` · ${node.language}` : ''}
          </p>
          <p className="truncate text-sm font-medium">{node.qualified_name || node.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{nodeLocation(node)}</p>
        </div>
        {openable ? (
          <Button variant="outline" size="xs" onClick={() => onOpen(node)}>
            <ExternalLink />
            {translate('specflow.codeGraph.openInEditor', 'Open in editor')}
          </Button>
        ) : null}
      </div>
      {node.signature ? (
        <pre className="scrollbar-sleek overflow-x-auto rounded-md border bg-muted/40 p-2 font-mono text-xs">
          {node.signature}
        </pre>
      ) : null}
      {sections.map(([title, nodes]) => (
        <section key={title} className="flex flex-col gap-1">
          <h3 className="px-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title} ({nodes.length})
          </h3>
          <CodeGraphNodeList
            nodes={nodes}
            selectedId={null}
            empty={translate('specflow.codeGraph.none', 'None')}
            onSelect={onSelect}
          />
        </section>
      ))}
    </div>
  )
}
