import { useEffect, useState } from 'react'
import { LoaderCircle, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { MarkdownPreviewBody } from '../../editor/MarkdownPreviewBody'
import { specflowRequest } from '../specflow-client'
import {
  sortedKindCounts,
  type CodeGraphEntryPoints,
  type CodeGraphKeyFile,
  type CodeGraphNode,
  type CodeGraphOverview
} from './code-graph-model'
import { CodeGraphNodeList, CodeGraphNodeRow } from './CodeGraphNodeRow'

type Loaded<T> =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: T }

const NO_MARKDOWN_COMPONENTS = {}

function useGraphQuery<T>(path: string, snapshotId: string): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    specflowRequest<T>('GET', path)
      .then((data) => !cancelled && setState({ status: 'ready', data }))
      .catch(
        (error: unknown) =>
          !cancelled &&
          setState({
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          })
      )
    return () => {
      cancelled = true
    }
    // Why snapshotId: a re-analysis produces new node ids behind the same path.
  }, [path, snapshotId])
  return state
}

function LoadState({ state }: { state: Loaded<unknown> }): React.JSX.Element | null {
  if (state.status === 'loading') {
    return <LoaderCircle className="m-2 size-4 animate-spin text-muted-foreground" />
  }
  if (state.status === 'error') {
    return <p className="p-2 text-xs text-destructive">{state.error}</p>
  }
  return null
}

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h3 className="px-2 pt-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  )
}

type ListProps = {
  projectId: string
  snapshotId: string
  selectedId: string | null
  onSelect: (node: CodeGraphNode) => void
}

export function CodeGraphOverviewList({
  projectId,
  snapshotId,
  selectedId,
  onSelect
}: ListProps): React.JSX.Element {
  const state = useGraphQuery<CodeGraphOverview>(
    `/projects/${projectId}/code-graph/overview`,
    snapshotId
  )
  if (state.status !== 'ready') {
    return <LoadState state={state} />
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
        {sortedKindCounts(state.data.counts).map(([kind, count]) => (
          <div key={kind} className="rounded-md border px-2 py-1.5">
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              {kind}
            </p>
            <p className="text-sm tabular-nums">{count}</p>
          </div>
        ))}
      </div>
      <SectionTitle>{translate('specflow.codeGraph.roots', 'Top-level')}</SectionTitle>
      <CodeGraphNodeList
        nodes={state.data.roots ?? []}
        selectedId={selectedId}
        empty={translate('specflow.codeGraph.none', 'None')}
        onSelect={onSelect}
      />
    </div>
  )
}

export function CodeGraphEntryPointList({
  projectId,
  snapshotId,
  selectedId,
  onSelect
}: ListProps): React.JSX.Element {
  const state = useGraphQuery<CodeGraphEntryPoints>(
    `/projects/${projectId}/code-graph/entry-points`,
    snapshotId
  )
  if (state.status !== 'ready') {
    return <LoadState state={state} />
  }
  const routes = state.data.routes ?? []
  return (
    <div className="flex flex-col gap-1">
      <SectionTitle>
        {translate('specflow.codeGraph.routes', 'Routes')} ({routes.length})
      </SectionTitle>
      {routes.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          {translate('specflow.codeGraph.none', 'None')}
        </p>
      ) : (
        routes.map(({ route, handler }) => (
          <CodeGraphNodeRow
            key={route.id}
            node={route}
            selected={route.id === selectedId}
            trailing={handler ? `→ ${handler.name}` : undefined}
            onSelect={onSelect}
          />
        ))
      )}
      <SectionTitle>
        {translate('specflow.codeGraph.mainFunctions', 'Main functions')} (
        {(state.data.main_functions ?? []).length})
      </SectionTitle>
      <CodeGraphNodeList
        nodes={state.data.main_functions ?? []}
        selectedId={selectedId}
        empty={translate('specflow.codeGraph.none', 'None')}
        onSelect={onSelect}
      />
    </div>
  )
}

export function CodeGraphKeyFileList({
  projectId,
  snapshotId,
  selectedId,
  onSelect
}: ListProps): React.JSX.Element {
  const state = useGraphQuery<{ key_files: CodeGraphKeyFile[] | null }>(
    `/projects/${projectId}/code-graph/key-files?limit=20`,
    snapshotId
  )
  if (state.status !== 'ready') {
    return <LoadState state={state} />
  }
  const files = state.data.key_files ?? []
  if (files.length === 0) {
    return (
      <p className="p-2 text-xs text-muted-foreground">
        {translate('specflow.codeGraph.none', 'None')}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-0.5">
      {files.map((entry) => (
        <CodeGraphNodeRow
          key={entry.file.id}
          node={entry.file}
          selected={entry.file.id === selectedId}
          trailing={translate(
            'specflow.codeGraph.keyFileStats',
            'fan-in {{fanIn}} · {{defines}} defs',
            {
              fanIn: entry.fan_in,
              defines: entry.defines
            }
          )}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export function CodeGraphSearch({
  projectId,
  snapshotId,
  selectedId,
  onSelect
}: ListProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [state, setState] = useState<Loaded<CodeGraphNode[]> | null>(null)

  useEffect(() => {
    if (!submitted) {
      setState(null)
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    specflowRequest<{ results: CodeGraphNode[] | null }>(
      'GET',
      `/projects/${projectId}/code-graph/search?q=${encodeURIComponent(submitted)}&limit=50`
    )
      .then((data) => !cancelled && setState({ status: 'ready', data: data.results ?? [] }))
      .catch(
        (error: unknown) =>
          !cancelled &&
          setState({
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          })
      )
    return () => {
      cancelled = true
    }
  }, [projectId, snapshotId, submitted])

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex items-center gap-2 p-2"
        onSubmit={(event) => {
          event.preventDefault()
          setSubmitted(query.trim())
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={translate(
            'specflow.codeGraph.searchPlaceholder',
            'Function, type, or file name'
          )}
          className="h-8"
          autoFocus
        />
        <Button
          type="submit"
          variant="outline"
          size="icon-sm"
          aria-label={translate('specflow.codeGraph.search', 'Search')}
        >
          <Search />
        </Button>
      </form>
      {state === null ? null : state.status === 'ready' ? (
        <CodeGraphNodeList
          nodes={state.data}
          selectedId={selectedId}
          empty={translate('specflow.codeGraph.noResults', 'No matching symbols.')}
          onSelect={onSelect}
        />
      ) : (
        <LoadState state={state} />
      )}
    </div>
  )
}

/** Callers key this by project + snapshot so a new graph starts without a stale summary. */
export function CodeGraphExplain({ projectId }: { projectId: string }): React.JSX.Element {
  const [state, setState] = useState<Loaded<string> | null>(null)

  const explain = (): void => {
    setState({ status: 'loading' })
    // Why no body: ExplainCodeGraph reads only the project and user from the request.
    specflowRequest<{ summary: string }>('POST', `/projects/${projectId}/code-graph/explain`)
      .then((data) => setState({ status: 'ready', data: data.summary }))
      .catch((error: unknown) =>
        setState({ status: 'error', error: error instanceof Error ? error.message : String(error) })
      )
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={explain} disabled={state?.status === 'loading'}>
          {state?.status === 'loading' ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {state?.status === 'loading'
            ? translate('specflow.codeGraph.explaining', 'Explaining…')
            : translate('specflow.codeGraph.explain', 'Explain architecture')}
        </Button>
        <span className="text-xs text-muted-foreground">
          {translate(
            'specflow.codeGraph.explainHint',
            'Summarizes the graph with the SpecFlow server model; takes up to a minute.'
          )}
        </span>
      </div>
      {state?.status === 'error' ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state?.status === 'ready' ? (
        <div className="markdown-body rounded-md border p-3">
          <MarkdownPreviewBody content={state.data} components={NO_MARKDOWN_COMPONENTS} />
        </div>
      ) : null}
    </div>
  )
}
