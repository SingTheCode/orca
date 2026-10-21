import { ipcMain } from 'electron'
import { z } from 'zod'
import type { Store } from '../persistence'
import type { SpecflowResult } from '../../shared/specflow-types'
import {
  connectSpecflow,
  disconnectSpecflow,
  getSpecflowStatus,
  specflowRequest
} from '../specflow/specflow-http-client'
import {
  defaultSpecflowMcpEntryPath,
  ensureSpecflowMcpExtension,
  isSpecflowProjectId
} from '../specflow/specflow-mcp-extension'

const ConnectArgsSchema = z.object({
  serverUrl: z.string().min(1),
  email: z.string().trim().min(1),
  password: z.string().min(1)
})

const RequestArgsSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  // Why: reject absolute URLs and `..` so the renderer cannot point the bearer token elsewhere.
  path: z
    .string()
    .regex(/^\/[^\s]*$/)
    .refine((path) => !path.startsWith('//') && !path.split(/[/?#]/).includes('..')),
  body: z.unknown().optional(),
  timeoutMs: z.number().int().positive().max(3_600_000).optional()
})

const EnsureMcpKeyArgsSchema = z.object({ projectId: z.string() })

const NOT_IMPLEMENTED: SpecflowResult<never> = {
  ok: false,
  status: null,
  error: 'not implemented'
}

function invalidArgs(error: z.ZodError): SpecflowResult<never> {
  return { ok: false, status: null, error: `Invalid arguments: ${error.issues[0]?.message ?? ''}` }
}

/** Registers every `specflow:*` IPC handler on the main process. */
export function registerSpecflowHandlers(store: Store): void {
  ipcMain.handle('specflow:status', () => getSpecflowStatus())

  ipcMain.handle('specflow:connect', (_event, args: unknown) => {
    const parsed = ConnectArgsSchema.safeParse(args)
    return parsed.success ? connectSpecflow(parsed.data) : invalidArgs(parsed.error)
  })

  ipcMain.handle('specflow:disconnect', () => disconnectSpecflow())

  ipcMain.handle('specflow:request', (_event, args: unknown) => {
    const parsed = RequestArgsSchema.safeParse(args)
    return parsed.success ? specflowRequest(parsed.data) : invalidArgs(parsed.error)
  })

  ipcMain.handle('specflow:ensureMcpKey', (_event, args: unknown) => {
    const parsed = EnsureMcpKeyArgsSchema.safeParse(args)
    if (!parsed.success || !isSpecflowProjectId(parsed.data.projectId)) {
      return { ok: false, status: null, error: 'Invalid arguments: projectId' }
    }
    const projectId = parsed.data.projectId
    const configuredEntry = store.getSettings().specflowMcpEntryPath?.trim()
    return ensureSpecflowMcpExtension(projectId, configuredEntry || defaultSpecflowMcpEntryPath())
  })

  ipcMain.handle('specflow:subscribeTaskEvents', () => NOT_IMPLEMENTED)
  ipcMain.handle('specflow:unsubscribeTaskEvents', () => NOT_IMPLEMENTED)
  ipcMain.handle('specflow:uploadWorkspaceSource', () => NOT_IMPLEMENTED)
}
