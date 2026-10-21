import { useCallback, useEffect, useRef, useState } from 'react'
import { specflowRequest } from '../specflow-client'
import type { SpecflowTask } from './specflow-task-types'

const EVENT_REFETCH_DEBOUNCE_MS = 300

export type SpecflowTasksState = {
  tasks: SpecflowTask[] | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

/** Loads a project's tasks and refetches on SpecFlow task events (SSE via main). */
export function useSpecflowTasks(projectId: string): SpecflowTasksState {
  const [tasks, setTasks] = useState<SpecflowTask[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Why: a slow response for an older request must not overwrite a newer list.
  const requestIdRef = useRef(0)

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const list = await specflowRequest<SpecflowTask[]>(
        'GET',
        `/projects/${encodeURIComponent(projectId)}/tasks`
      )
      if (requestId === requestIdRef.current) {
        setTasks(list)
        setError(null)
      }
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [projectId])

  useEffect(() => {
    setTasks(null)
    void reload()
  }, [reload])

  useEffect(() => {
    let disposed = false
    let subscriptionId: string | null = null
    let timer: number | undefined
    const removeListener = window.api.specflow.onTaskEvent((event) => {
      if (event.subscriptionId !== subscriptionId) {
        return
      }
      clearTimeout(timer)
      timer = window.setTimeout(() => void reload(), EVENT_REFETCH_DEBOUNCE_MS)
    })
    void window.api.specflow.subscribeTaskEvents({ projectId }).then((result) => {
      if (!result.ok) {
        return
      }
      if (disposed) {
        void window.api.specflow.unsubscribeTaskEvents({
          subscriptionId: result.data.subscriptionId
        })
      } else {
        subscriptionId = result.data.subscriptionId
      }
    })
    return () => {
      disposed = true
      clearTimeout(timer)
      removeListener()
      if (subscriptionId) {
        void window.api.specflow.unsubscribeTaskEvents({ subscriptionId })
      }
    }
  }, [projectId, reload])

  return { tasks, loading, error, reload }
}
