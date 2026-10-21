import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { specflowRequest } from '../specflow-client'
import {
  hasNewerSpecVersion,
  latestSpecVersions,
  type SpecflowSpec,
  type SpecflowSpecVersions
} from './specflow-spec-model'

const GRILL_POLL_INTERVAL_MS = 5000

// Why module scope: launching grill-me switches to the terminal view and unmounts this tab;
// polling resumes from the same baseline when the user comes back to the Specs tab.
const pendingGrillBaselines = new Map<string, SpecflowSpecVersions>()

export type SpecflowSpecsState = {
  specs: SpecflowSpec[] | null
  loading: boolean
  error: string | null
  grillPending: boolean
  reload: () => Promise<SpecflowSpec[] | null>
  /** Marks a grill session as started; polling stops once any spec version passes `baseline`. */
  startGrillWait: (baseline: SpecflowSpecVersions) => void
  /** After the user's own save/refine, newer versions must not read as grill output. */
  rebaseGrillWait: (specs: readonly SpecflowSpec[]) => void
}

export function useSpecflowSpecs(projectId: string): SpecflowSpecsState {
  const [specs, setSpecs] = useState<SpecflowSpec[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [grillPending, setGrillPending] = useState(() => pendingGrillBaselines.has(projectId))
  // Why: a slow response for an older request must not overwrite a newer list.
  const requestIdRef = useRef(0)

  const reload = useCallback(async (): Promise<SpecflowSpec[] | null> => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const list = await specflowRequest<SpecflowSpec[]>(
        'GET',
        `/projects/${encodeURIComponent(projectId)}/specs`
      )
      if (requestId !== requestIdRef.current) {
        return null
      }
      setSpecs(list)
      setError(null)
      const baseline = pendingGrillBaselines.get(projectId)
      if (baseline && hasNewerSpecVersion(baseline, list)) {
        pendingGrillBaselines.delete(projectId)
        setGrillPending(false)
        toast.success(
          translate('specflow.specs.grillDone', 'New PRD/TRD versions arrived from grill-me.')
        )
      }
      return list
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      }
      return null
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [projectId])

  useEffect(() => {
    setSpecs(null)
    setGrillPending(pendingGrillBaselines.has(projectId))
    void reload()
  }, [projectId, reload])

  useEffect(() => {
    if (!grillPending) {
      return
    }
    const timer = window.setInterval(() => void reload(), GRILL_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [grillPending, reload])

  const startGrillWait = useCallback(
    (baseline: SpecflowSpecVersions) => {
      pendingGrillBaselines.set(projectId, baseline)
      setGrillPending(true)
    },
    [projectId]
  )

  const rebaseGrillWait = useCallback(
    (latest: readonly SpecflowSpec[]) => {
      if (pendingGrillBaselines.has(projectId)) {
        pendingGrillBaselines.set(projectId, latestSpecVersions(latest))
      }
    },
    [projectId]
  )

  return { specs, loading, error, grillPending, reload, startGrillWait, rebaseGrillWait }
}
