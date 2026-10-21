import { useState } from 'react'
import { LoaderCircle, RefreshCw, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { useRepoById } from '@/store/selectors'
import type { SpecflowTabProps } from '../specflow-types'
import { parseSnapshotLanguages, type CodeGraphNode } from './code-graph-model'
import { openCodeGraphNodeInEditor } from './code-graph-open-node'
import {
  CodeGraphEntryPointList,
  CodeGraphExplain,
  CodeGraphKeyFileList,
  CodeGraphOverviewList,
  CodeGraphSearch
} from './CodeGraphLists'
import { CodeGraphNodeDetail } from './CodeGraphNodeDetail'
import { useCodeGraphAnalysis, type CodeGraphAnalysisState } from './use-code-graph-analysis'

type BrowseView = 'overview' | 'entry-points' | 'key-files' | 'search' | 'explain'

const BROWSE_VIEWS: readonly { id: BrowseView; label: () => string }[] = [
  { id: 'overview', label: () => translate('specflow.codeGraph.viewOverview', 'Overview') },
  {
    id: 'entry-points',
    label: () => translate('specflow.codeGraph.viewEntryPoints', 'Entry points')
  },
  { id: 'key-files', label: () => translate('specflow.codeGraph.viewKeyFiles', 'Key files') },
  { id: 'search', label: () => translate('specflow.codeGraph.viewSearch', 'Search') },
  { id: 'explain', label: () => translate('specflow.codeGraph.viewExplain', 'Explain') }
]

function statusLine(state: CodeGraphAnalysisState): string | null {
  switch (state.phase) {
    case 'uploading':
      return translate('specflow.codeGraph.uploading', 'Packaging and uploading workspace source…')
    case 'importing':
      return (
        state.stage || translate('specflow.codeGraph.importing', 'Server is importing the source…')
      )
    case 'analyzing':
      return translate('specflow.codeGraph.analyzing', 'Building the code graph…')
    case 'idle':
    case 'ready':
    case 'failed':
      return null
  }
}

export default function CodeGraphTab({
  repoId,
  workspacePath,
  worktreeId
}: SpecflowTabProps): React.JSX.Element {
  const repo = useRepoById(repoId)
  const graphProjectId = useAppStore((s) => s.settings?.specflowCodeGraphProjectByRepo?.[repoId])
  const { state, upload, reanalyze } = useCodeGraphAnalysis(repoId, graphProjectId)
  const [view, setView] = useState<BrowseView>('overview')
  // Why keyed by snapshot: re-analysis issues new node ids, so an old trail must not leak in.
  const [trail, setTrail] = useState<{ snapshotId: string; ids: string[] }>({
    snapshotId: '',
    ids: []
  })

  const busy =
    state.phase === 'uploading' || state.phase === 'importing' || state.phase === 'analyzing'
  const snapshotId = state.phase === 'ready' ? state.snapshot.id : ''
  const trailIds = trail.snapshotId === snapshotId ? trail.ids : []
  const selectedId = trailIds.at(-1) ?? null
  const selectNode = (node: CodeGraphNode): void =>
    setTrail({ snapshotId, ids: [...trailIds, node.id] })
  const openNode = (node: CodeGraphNode): void => {
    if (
      !worktreeId ||
      !workspacePath ||
      !openCodeGraphNodeInEditor(node, worktreeId, workspacePath)
    ) {
      toast.error(
        translate('specflow.codeGraph.openFailed', 'This file is not in the active worktree.')
      )
    }
  }
  const startUpload = (): void => {
    if (workspacePath) {
      void upload(`${repo?.displayName ?? 'workspace'} (Orca code graph)`, workspacePath)
    }
  }
  const status = statusLine(state)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={startUpload} disabled={busy || !workspacePath}>
          <Upload />
          {graphProjectId
            ? translate('specflow.codeGraph.reupload', 'Re-upload workspace')
            : translate('specflow.codeGraph.upload', 'Upload workspace')}
        </Button>
        {graphProjectId ? (
          <Button variant="outline" size="sm" onClick={reanalyze} disabled={busy}>
            <RefreshCw />
            {translate('specflow.codeGraph.reanalyze', 'Re-analyze')}
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {translate(
            'specflow.codeGraph.languages',
            'Supports Go and JavaScript/TypeScript. Skips .git, node_modules, build output, hidden files, and files over 1 MB; zip limit 20 MB.'
          )}
        </span>
      </div>

      {status ? (
        <div className="flex flex-col gap-1.5 rounded-md border p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            <span className="truncate">{status}</span>
          </div>
          {state.phase === 'importing' ? <Progress value={state.progress} /> : null}
        </div>
      ) : null}
      {state.phase === 'failed' ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state.phase === 'idle' && !graphProjectId ? (
        <p className="text-sm text-muted-foreground">
          {workspacePath
            ? translate(
                'specflow.codeGraph.empty',
                'Upload the active workspace to build a code graph of its packages, functions, routes, and calls.'
              )
            : translate('specflow.codeGraph.noWorkspace', 'Open a worktree to upload its source.')}
        </p>
      ) : null}

      {state.phase === 'ready' ? (
        <>
          <p className="text-xs text-muted-foreground">
            {translate(
              'specflow.codeGraph.snapshotSummary',
              '{{nodes}} nodes · {{edges}} edges · {{languages}}',
              {
                nodes: state.snapshot.node_count,
                edges: state.snapshot.edge_count,
                languages: parseSnapshotLanguages(state.snapshot.languages).join(', ') || '—'
              }
            )}
          </p>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="flex min-h-0 flex-col rounded-md border">
              <Tabs
                value={view}
                onValueChange={(value) => {
                  const next = BROWSE_VIEWS.find((candidate) => candidate.id === value)
                  if (next) {
                    setView(next.id)
                  }
                }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <TabsList variant="line" className="mx-2 mt-1">
                  {BROWSE_VIEWS.map((entry) => (
                    <TabsTrigger key={entry.id} value={entry.id}>
                      {entry.label()}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto p-1">
                  {graphProjectId ? (
                    <>
                      <TabsContent value="overview">
                        <CodeGraphOverviewList
                          projectId={graphProjectId}
                          snapshotId={state.snapshot.id}
                          selectedId={selectedId}
                          onSelect={selectNode}
                        />
                      </TabsContent>
                      <TabsContent value="entry-points">
                        <CodeGraphEntryPointList
                          projectId={graphProjectId}
                          snapshotId={state.snapshot.id}
                          selectedId={selectedId}
                          onSelect={selectNode}
                        />
                      </TabsContent>
                      <TabsContent value="key-files">
                        <CodeGraphKeyFileList
                          projectId={graphProjectId}
                          snapshotId={state.snapshot.id}
                          selectedId={selectedId}
                          onSelect={selectNode}
                        />
                      </TabsContent>
                      <TabsContent value="search">
                        <CodeGraphSearch
                          projectId={graphProjectId}
                          snapshotId={state.snapshot.id}
                          selectedId={selectedId}
                          onSelect={selectNode}
                        />
                      </TabsContent>
                      <TabsContent value="explain">
                        <CodeGraphExplain
                          key={`${graphProjectId}:${state.snapshot.id}`}
                          projectId={graphProjectId}
                        />
                      </TabsContent>
                    </>
                  ) : null}
                </div>
              </Tabs>
            </div>
            <div className="scrollbar-sleek min-h-0 overflow-auto rounded-md border">
              {graphProjectId && selectedId ? (
                <CodeGraphNodeDetail
                  projectId={graphProjectId}
                  nodeId={selectedId}
                  canGoBack={trailIds.length > 1}
                  canOpen={Boolean(worktreeId && workspacePath)}
                  onBack={() => setTrail({ snapshotId, ids: trailIds.slice(0, -1) })}
                  onSelect={selectNode}
                  onOpen={openNode}
                />
              ) : (
                <p className="p-3 text-xs text-muted-foreground">
                  {translate(
                    'specflow.codeGraph.selectNode',
                    'Select a node to see its callers, callees, and contents.'
                  )}
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
