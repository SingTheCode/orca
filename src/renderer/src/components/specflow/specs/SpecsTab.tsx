import { useState } from 'react'
import { LoaderCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import { specflowRequest } from '../specflow-client'
import type { SpecflowTabProps } from '../specflow-types'
import { GrillMeButton } from './GrillMeButton'
import { SpecDocumentPanel } from './SpecDocumentPanel'
import { SpecHistoryPanel } from './SpecHistoryPanel'
import { SpecRefineForm } from './SpecRefineForm'
import {
  latestSpecVersions,
  SPECFLOW_SPEC_TYPES,
  type SpecflowSpec,
  type SpecflowSpecType,
  type SpecflowSpecUpdateResult
} from './specflow-spec-model'
import { useSpecflowSpecs } from './use-specflow-specs'

type SpecsMode = 'document' | 'history'
type RefineResponse = { specs: SpecflowSpec[] }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function SpecsTab(props: SpecflowTabProps): React.JSX.Element {
  const state = useSpecflowSpecs(props.projectId)
  const [activeType, setActiveType] = useState<SpecflowSpecType>('PRD')
  const [mode, setMode] = useState<SpecsMode>('document')
  const [saving, setSaving] = useState(false)
  const [refining, setRefining] = useState(false)
  const busy = saving || refining

  const afterOwnChange = async (): Promise<void> => {
    const latest = await state.reload()
    if (latest) {
      state.rebaseGrillWait(latest)
    }
  }

  const save = async (spec: SpecflowSpec, content: string): Promise<boolean> => {
    setSaving(true)
    try {
      const result = await specflowRequest<SpecflowSpecUpdateResult>(
        'PUT',
        `/specs/${encodeURIComponent(spec.id)}`,
        { content }
      )
      const report = result.report
      toast.success(
        translate('specflow.specs.saved', 'Saved {{type}} v{{version}}.', {
          type: result.spec.type,
          version: result.spec.version
        }),
        {
          description: translate(
            'specflow.specs.savedReport',
            'WBS: {{added}} added, {{updated}} updated, {{deleted}} deleted.',
            {
              added: report.tasks_added_count,
              updated: report.tasks_updated_count,
              deleted: report.tasks_deleted_count
            }
          )
        }
      )
      await afterOwnChange()
      return true
    } catch (error) {
      toast.error(errorMessage(error))
      return false
    } finally {
      setSaving(false)
    }
  }

  const refine = async (additionalAnswer: string): Promise<boolean> => {
    setRefining(true)
    try {
      const result = await specflowRequest<RefineResponse>(
        'POST',
        `/projects/${encodeURIComponent(props.projectId)}/specs/refine`,
        { additional_answer: additionalAnswer }
      )
      toast.success(
        translate('specflow.specs.refined', 'Specs refined: {{count}} new versions.', {
          count: result.specs.length
        })
      )
      await afterOwnChange()
      return true
    } catch (error) {
      toast.error(errorMessage(error))
      return false
    } finally {
      setRefining(false)
    }
  }

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <GrillMeButton
        projectId={props.projectId}
        worktreeId={props.worktreeId}
        onLaunched={() => state.startGrillWait(latestSpecVersions(state.specs ?? []))}
      />
      {state.grillPending ? (
        <span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" />
          {translate(
            'specflow.specs.grillWaiting',
            'Waiting for grill-me decisions. New versions appear here automatically.'
          )}
        </span>
      ) : null}
      <Button
        size="icon-sm"
        variant="ghost"
        className="ml-auto"
        disabled={state.loading}
        onClick={() => void state.reload()}
        aria-label={translate('specflow.specs.reload', 'Reload specs')}
      >
        <RefreshCw />
      </Button>
    </div>
  )

  if (state.specs === null) {
    return (
      <div className="space-y-4 py-4">
        {header}
        {state.error ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : (
          <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>
    )
  }

  if (state.specs.length === 0) {
    return (
      <div className="space-y-4 py-4">
        {header}
        <div className="space-y-1 rounded-md border border-dashed border-border p-6">
          <p className="text-sm font-medium">
            {translate('specflow.specs.emptyTitle', 'No specs yet')}
          </p>
          <p className="text-xs text-muted-foreground">
            {translate(
              'specflow.specs.emptyDescription',
              'Plan with grill-me starts omp in this workspace and interviews you about the project. When you confirm the result, omp sends the decisions to SpecFlow, which writes the PRD, TRD, and open questions here.'
            )}
          </p>
        </div>
      </div>
    )
  }

  const activeSpec = state.specs.find((spec) => spec.type === activeType)

  return (
    <div className="flex min-h-0 flex-col gap-4 py-4">
      {header}
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={activeType}
          onValueChange={(value) => {
            const type = SPECFLOW_SPEC_TYPES.find((candidate) => candidate === value)
            if (type) {
              setActiveType(type)
            }
          }}
        >
          <TabsList>
            {SPECFLOW_SPEC_TYPES.map((type) => (
              <TabsTrigger key={type} value={type}>
                {type}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={mode}
          onValueChange={(value) => {
            if (value === 'document' || value === 'history') {
              setMode(value)
            }
          }}
          className="ml-auto"
        >
          <ToggleGroupItem value="document">
            {translate('specflow.specs.modeDocument', 'Document')}
          </ToggleGroupItem>
          <ToggleGroupItem value="history">
            {translate('specflow.specs.modeHistory', 'History')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {!activeSpec ? (
        <p className="text-sm text-muted-foreground">
          {translate('specflow.specs.typeMissing', 'No {{type}} version yet.', {
            type: activeType
          })}
        </p>
      ) : mode === 'history' ? (
        <SpecHistoryPanel
          projectId={props.projectId}
          type={activeType}
          latestSpecId={activeSpec.id}
        />
      ) : (
        <SpecDocumentPanel
          // Why key: switching type or receiving a new version must drop an unsaved draft of the old one.
          key={activeSpec.id}
          spec={activeSpec}
          saving={saving}
          locked={refining}
          onSave={(content) => save(activeSpec, content)}
        />
      )}
      {mode === 'document' ? (
        <SpecRefineForm refining={refining} locked={busy && !refining} onRefine={refine} />
      ) : null}
    </div>
  )
}
