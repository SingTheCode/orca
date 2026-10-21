import { useCallback, useMemo, useState } from 'react'
import {
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './erd-canvas.css'
import { Code2, LoaderCircle, Plus, Save, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { SpecflowTabProps } from '../specflow-types'
import { ErdDdlDialog } from './ErdDdlDialog'
import { ErdGenerateDialog } from './ErdGenerateDialog'
import { ErdNamingViolations } from './ErdNamingViolations'
import { ErdTableNode, type ErdTableFlowNode } from './ErdTableNode'
import { ErdTablePanel } from './ErdTablePanel'
import {
  addColumn,
  connectColumns,
  deleteColumn,
  deleteEdge,
  updateColumn
} from './erd-column-edits'
import { addTable, deleteTable, moveTable, renameTable, updateTableDescription } from './erd-edits'
import { ERD_NODE_TYPE, erdTablePosition, uniqueErdName, type ErdDocument } from './erd-schema'
import { useErdSchema } from './use-erd-schema'

const NODE_TYPES = { [ERD_NODE_TYPE]: ErdTableNode }

function buildFlowNodes(
  doc: ErdDocument,
  previous: ErdTableFlowNode[],
  selectedTable: string | null
): ErdTableFlowNode[] {
  return (doc.tables ?? []).map((table) => {
    const prior = previous.find((node) => node.id === table.name)
    return {
      id: table.name,
      type: ERD_NODE_TYPE,
      position: erdTablePosition(doc, table.name),
      data: { table },
      // Why keep `measured`: without it React Flow hides the node until it re-measures.
      measured: prior?.measured,
      selected: table.name === selectedTable,
      deletable: false
    }
  })
}

export default function ErdTab({ projectId }: SpecflowTabProps): React.JSX.Element {
  const erd = useErdSchema(projectId)
  const { doc, setDoc } = erd
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [ddlOpen, setDdlOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  // Local node state lets React Flow drag smoothly; it is rebuilt whenever the document changes.
  const [flow, setFlow] = useState<{
    doc: ErdDocument
    selected: string | null
    nodes: ErdTableFlowNode[]
  }>({ doc, selected: selectedTable, nodes: buildFlowNodes(doc, [], selectedTable) })
  if (flow.doc !== doc || flow.selected !== selectedTable) {
    setFlow({
      doc,
      selected: selectedTable,
      nodes: buildFlowNodes(doc, flow.nodes, selectedTable)
    })
  }

  const edges = useMemo<Edge[]>(
    () =>
      (doc.edges ?? []).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        type: edge.type ?? 'smoothstep',
        label: edge.label,
        selected: edge.id === selectedEdge
      })),
    [doc.edges, selectedEdge]
  )

  const onNodesChange = useCallback((changes: NodeChange<ErdTableFlowNode>[]) => {
    setFlow((current) => ({ ...current, nodes: applyNodeChanges(changes, current.nodes) }))
    for (const change of changes) {
      if (change.type === 'select') {
        setSelectedTable((current) =>
          change.selected ? change.id : current === change.id ? null : current
        )
      }
    }
  }, [])

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'select') {
          setSelectedEdge((current) =>
            change.selected ? change.id : current === change.id ? null : current
          )
        } else if (change.type === 'remove') {
          setDoc((current) => deleteEdge(current, change.id))
        }
      }
    },
    [setDoc]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.sourceHandle || !connection.targetHandle) {
        return
      }
      const { source, sourceHandle, target, targetHandle } = connection
      setDoc((current) => connectColumns(current, source, sourceHandle, target, targetHandle))
    },
    [setDoc]
  )

  const table = selectedTable
    ? (doc.tables ?? []).find((candidate) => candidate.name === selectedTable)
    : undefined
  const busy = erd.loading || erd.saving || erd.generating
  const hasTables = (doc.tables?.length ?? 0) > 0

  const runGenerate = async (): Promise<void> => {
    setGenerateOpen(false)
    setSelectedTable(null)
    await erd.generate()
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!erd.dirty || busy}
          onClick={() => void erd.save()}
          className="w-24"
        >
          {erd.saving ? <LoaderCircle className="animate-spin" /> : <Save />}
          {translate('specflow.erd.save', 'Save')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            const name = uniqueErdName(
              'new_table',
              (doc.tables ?? []).map((candidate) => candidate.name)
            )
            setDoc((current) => addTable(current, name, erdTablePosition(current, name)))
            setSelectedTable(name)
          }}
        >
          <Plus />
          {translate('specflow.erd.addTable', 'Add table')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => (hasTables || erd.dirty ? setGenerateOpen(true) : void runGenerate())}
        >
          {erd.generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {erd.generating
            ? translate('specflow.erd.generating', 'Generating from specs… (about a minute)')
            : translate('specflow.erd.generate', 'Generate with AI')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasTables || erd.dirty || busy}
          onClick={() => setDdlOpen(true)}
        >
          <Code2 />
          {translate('specflow.erd.viewDdl', 'View DDL')}
        </Button>
        {erd.dirty ? (
          <span className="text-xs text-muted-foreground">
            {translate('specflow.erd.unsaved', 'Unsaved changes')}
          </span>
        ) : null}
        {erd.error ? <span className="text-xs text-destructive">{erd.error}</span> : null}
      </div>

      <ErdNamingViolations violations={erd.namingViolations} />

      <div className="specflow-erd-canvas flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        {erd.loading && !hasTables ? (
          <div className="flex flex-1 items-center justify-center">
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : !hasTables && !erd.generating ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {translate(
                'specflow.erd.empty',
                'No schema yet. Generate one from the specs and tasks, or add a table.'
              )}
            </p>
            <Button size="sm" onClick={() => void runGenerate()}>
              <Sparkles />
              {translate('specflow.erd.generate', 'Generate with AI')}
            </Button>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <ReactFlow<ErdTableFlowNode>
              nodes={flow.nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDragStop={(_event, node) =>
                setDoc((current) => moveTable(current, node.id, node.position))
              }
              onPaneClick={() => setSelectedTable(null)}
              fitView
              minZoom={0.1}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
        )}
        {table ? (
          <ErdTablePanel
            doc={doc}
            table={table}
            onClose={() => setSelectedTable(null)}
            onRename={(name) => {
              setDoc((current) => renameTable(current, table.name, name))
              setSelectedTable(name)
            }}
            onDescription={(description) =>
              setDoc((current) => updateTableDescription(current, table.name, description))
            }
            onDeleteTable={() => {
              setDoc((current) => deleteTable(current, table.name))
              setSelectedTable(null)
            }}
            onAddColumn={() => {
              const name = uniqueErdName(
                'new_column',
                (table.columns ?? []).map((column) => column.name)
              )
              setDoc((current) =>
                addColumn(current, table.name, {
                  name,
                  type: 'VARCHAR(255)',
                  pk: false,
                  fk: false,
                  nullable: true,
                  index: false,
                  fk_target: '',
                  description: ''
                })
              )
            }}
            onUpdateColumn={(index, column) =>
              setDoc((current) => updateColumn(current, table.name, index, column))
            }
            onDeleteColumn={(index) =>
              setDoc((current) => deleteColumn(current, table.name, index))
            }
          />
        ) : null}
      </div>

      <ErdDdlDialog projectId={projectId} open={ddlOpen} onOpenChange={setDdlOpen} />
      <ErdGenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onConfirm={() => void runGenerate()}
      />
    </div>
  )
}
