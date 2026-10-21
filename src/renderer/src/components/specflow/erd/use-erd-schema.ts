import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { specflowRequest } from '../specflow-client'
import { parseErdContent, type ErdDocument } from './erd-schema'

export type ErdNamingViolation = { table: string; column?: string; reason: string }

/** Shape shared by GET/PUT `/schemas` and POST `/schemas/generate`. */
type SchemaDesignResponse = {
  content: string
  naming_violations?: ErdNamingViolation[] | null
}

export type ErdSchemaState = {
  doc: ErdDocument
  dirty: boolean
  loading: boolean
  saving: boolean
  generating: boolean
  error: string | null
  namingViolations: ErdNamingViolation[]
  setDoc: (update: (doc: ErdDocument) => ErdDocument) => void
  reload: () => Promise<void>
  save: () => Promise<boolean>
  generate: () => Promise<void>
}

export function useErdSchema(projectId: string): ErdSchemaState {
  const [doc, setDocState] = useState<ErdDocument>({})
  // Serialized form of the last server copy; dirty = current doc differs from it.
  const [savedSerialized, setSavedSerialized] = useState('{}')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [namingViolations, setNamingViolations] = useState<ErdNamingViolation[]>([])
  // Why: a slow response for an older request (or project) must not overwrite newer state.
  const requestIdRef = useRef(0)
  const schemaPath = `/projects/${encodeURIComponent(projectId)}/schemas`

  const applyResponse = useCallback((response: SchemaDesignResponse) => {
    const parsed = parseErdContent(response.content)
    setDocState(parsed)
    setSavedSerialized(JSON.stringify(parsed))
    setNamingViolations(response.naming_violations ?? [])
  }, [])

  const run = useCallback(
    async (
      method: 'GET' | 'PUT' | 'POST',
      path: string,
      body: unknown,
      setBusy: (busy: boolean) => void
    ): Promise<boolean> => {
      const requestId = ++requestIdRef.current
      setBusy(true)
      setError(null)
      try {
        const response = await specflowRequest<SchemaDesignResponse>(method, path, body)
        if (requestId === requestIdRef.current) {
          applyResponse(response)
        }
        return true
      } catch (requestError) {
        if (requestId === requestIdRef.current) {
          setError(requestError instanceof Error ? requestError.message : String(requestError))
        }
        return false
      } finally {
        setBusy(false)
      }
    },
    [applyResponse]
  )

  const reload = useCallback(async () => {
    await run('GET', schemaPath, undefined, setLoading)
  }, [run, schemaPath])

  const save = useCallback(
    () => run('PUT', schemaPath, { content: JSON.stringify(doc) }, setSaving),
    [doc, run, schemaPath]
  )

  const generate = useCallback(async () => {
    await run('POST', `${schemaPath}/generate`, undefined, setGenerating)
  }, [run, schemaPath])

  useEffect(() => {
    setDocState({})
    setSavedSerialized('{}')
    setNamingViolations([])
    void reload()
  }, [reload])

  const dirty = useMemo(() => JSON.stringify(doc) !== savedSerialized, [doc, savedSerialized])

  return {
    doc,
    dirty,
    loading,
    saving,
    generating,
    error,
    namingViolations,
    setDoc: setDocState,
    reload,
    save,
    generate
  }
}
