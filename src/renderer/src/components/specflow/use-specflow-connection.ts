import { useCallback, useEffect, useState } from 'react'
import type { SpecflowStatus } from '../../../../shared/specflow-types'

export type SpecflowConnectionState =
  | { state: 'checking' }
  | { state: 'ready'; status: SpecflowStatus }
  | { state: 'error'; error: string }

export function useSpecflowConnection(): {
  connection: SpecflowConnectionState
  refresh: () => Promise<void>
} {
  const [connection, setConnection] = useState<SpecflowConnectionState>({ state: 'checking' })

  const refresh = useCallback(async () => {
    const result = await window.api.specflow.status()
    setConnection(
      result.ok ? { state: 'ready', status: result.data } : { state: 'error', error: result.error }
    )
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { connection, refresh }
}
