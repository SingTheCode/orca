import { useCallback, useEffect, useRef, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { SpecflowRequestError, specflowRequest } from '../specflow-client'
import {
  nextImportStep,
  type CodeGraphSnapshot,
  type SpecflowImportProject
} from './code-graph-model'

const POLL_INTERVAL_MS = 2_000

export type CodeGraphAnalysisState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'importing'; progress: number; stage: string }
  | { phase: 'analyzing' }
  | { phase: 'ready'; snapshot: CodeGraphSnapshot }
  | { phase: 'failed'; error: string }

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Drives upload → server import → code analysis for the repo's code-graph project. */
export function useCodeGraphAnalysis(repoId: string, graphProjectId: string | undefined) {
  const [state, setState] = useState<CodeGraphAnalysisState>({ phase: 'idle' })
  // Why: each run bumps the generation so a superseded poll loop stops writing state.
  const generation = useRef(0)

  const track = useCallback(
    async (projectId: string, options: { startFresh: boolean }): Promise<void> => {
      const run = ++generation.current
      const live = (): boolean => generation.current === run
      const sleep = (): Promise<void> => {
        const { promise, resolve } = Promise.withResolvers<void>()
        setTimeout(resolve, POLL_INTERVAL_MS)
        return promise
      }
      try {
        for (;;) {
          const project = await specflowRequest<SpecflowImportProject>(
            'GET',
            `/projects/${projectId}`
          )
          if (!live()) {
            return
          }
          const step = nextImportStep(project)
          if (step.kind === 'failed') {
            setState({ phase: 'failed', error: step.error })
            return
          }
          if (step.kind === 'analyze') {
            break
          }
          setState({ phase: 'importing', progress: step.progress, stage: step.stage })
          await sleep()
          if (!live()) {
            return
          }
        }

        let snapshot: CodeGraphSnapshot | null = null
        if (!options.startFresh) {
          snapshot = await specflowRequest<CodeGraphSnapshot>(
            'GET',
            `/projects/${projectId}/code-analysis`
          ).catch((error: unknown) => {
            if (error instanceof SpecflowRequestError && error.status === 404) {
              return null
            }
            throw error
          })
        }
        if (!snapshot) {
          snapshot = await specflowRequest<CodeGraphSnapshot>(
            'POST',
            `/projects/${projectId}/code-analysis?target=uploaded${options.startFresh ? '&full=true' : ''}`
          )
        }
        while (snapshot.status === 'RUNNING') {
          if (!live()) {
            return
          }
          setState({ phase: 'analyzing' })
          await sleep()
          if (!live()) {
            return
          }
          snapshot = await specflowRequest<CodeGraphSnapshot>(
            'GET',
            `/projects/${projectId}/code-analysis`
          )
        }
        if (!live()) {
          return
        }
        setState(
          snapshot.status === 'READY'
            ? { phase: 'ready', snapshot }
            : {
                phase: 'failed',
                error:
                  snapshot.error_message ||
                  translate('specflow.codeGraph.analysisFailed', 'Code analysis failed.')
              }
        )
      } catch (error) {
        if (live()) {
          setState({ phase: 'failed', error: errorText(error) })
        }
      }
    },
    []
  )

  useEffect(() => {
    // Why bump on cleanup: unmount or project switch must stop the running poll loop.
    const counter = generation
    if (graphProjectId) {
      void track(graphProjectId, { startFresh: false })
    } else {
      counter.current++
      setState({ phase: 'idle' })
    }
    return () => {
      counter.current++
    }
  }, [graphProjectId, track])

  const upload = useCallback(
    async (name: string, workspacePath: string): Promise<void> => {
      const run = ++generation.current
      setState({ phase: 'uploading' })
      const result = await window.api.specflow.uploadWorkspaceSource({
        projectId: graphProjectId,
        name,
        workspacePath
      })
      if (generation.current !== run) {
        return
      }
      if (!result.ok) {
        setState({ phase: 'failed', error: result.error })
        return
      }
      const { settings, updateSettings } = useAppStore.getState()
      // Why: the upload always creates a new import project, so the mapping is replaced.
      await updateSettings({
        specflowCodeGraphProjectByRepo: {
          ...settings?.specflowCodeGraphProjectByRepo,
          [repoId]: result.data.projectId
        }
      })
      // The settings change re-runs the effect, which tracks the new project.
    },
    [graphProjectId, repoId]
  )

  const reanalyze = useCallback(() => {
    if (graphProjectId) {
      void track(graphProjectId, { startFresh: true })
    }
  }, [graphProjectId, track])

  return { state, upload, reanalyze }
}
