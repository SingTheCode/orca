import { Suspense, useEffect, useMemo, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { lazyWithRetry } from '@/lib/lazy-with-retry'
import { translate } from '@/i18n/i18n'
import { specflowRequest } from '../specflow-client'
import { specHistoryForType, type SpecflowSpec, type SpecflowSpecType } from './specflow-spec-model'

const DiffViewer = lazyWithRetry(() => import('@/components/editor/DiffViewer'))

export function SpecHistoryPanel(props: {
  projectId: string
  type: SpecflowSpecType
  /** Changes whenever a new version lands, so the list refetches. */
  latestSpecId: string
}): React.JSX.Element {
  const [history, setHistory] = useState<SpecflowSpec[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [baseId, setBaseId] = useState('')
  const [compareId, setCompareId] = useState('')

  useEffect(() => {
    let cancelled = false
    setError(null)
    specflowRequest<SpecflowSpec[]>(
      'GET',
      `/projects/${encodeURIComponent(props.projectId)}/specs/history`
    )
      .then((list) => {
        if (!cancelled) {
          setHistory(list)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError))
        }
      })
    return () => {
      cancelled = true
    }
  }, [props.projectId, props.latestSpecId])

  const versions = useMemo(
    () => (history ? specHistoryForType(history, props.type) : []),
    [history, props.type]
  )

  // Default to comparing the previous version with the latest whenever the list or type changes.
  useEffect(() => {
    setCompareId(versions[0]?.id ?? '')
    setBaseId(versions[1]?.id ?? versions[0]?.id ?? '')
  }, [versions])

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>
  }
  if (!history) {
    return <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
  }
  if (versions.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          'specflow.specs.historyTooShort',
          'Only one {{type}} version exists. Save or refine to create another one to compare.',
          { type: props.type }
        )}
      </p>
    )
  }

  const base = versions.find((spec) => spec.id === baseId)
  const compare = versions.find((spec) => spec.id === compareId)
  const versionSelect = (
    label: string,
    value: string,
    onChange: (id: string) => void
  ): React.JSX.Element => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {versions.map((spec) => (
            <SelectItem key={spec.id} value={spec.id}>
              {translate('specflow.specs.versionOption', 'v{{version}} · {{date}}', {
                version: spec.version,
                date: new Date(spec.created_at).toLocaleString()
              })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        {versionSelect(translate('specflow.specs.compareBase', 'Base'), baseId, setBaseId)}
        {versionSelect(
          translate('specflow.specs.compareTarget', 'Compare'),
          compareId,
          setCompareId
        )}
      </div>
      {base && compare ? (
        <div className="h-[60vh] min-h-80 overflow-hidden rounded-md border border-border">
          <Suspense fallback={<LoaderCircle className="m-4 size-4 animate-spin" />}>
            <DiffViewer
              modelKey={`specflow-spec-diff:${base.id}:${compare.id}`}
              originalContent={base.content}
              modifiedContent={compare.content}
              language="markdown"
              filePath={`${props.type}.md`}
              relativePath={`${props.type}.md`}
              sideBySide
            />
          </Suspense>
        </div>
      ) : null}
    </div>
  )
}
