/** Every `window.api.specflow` call resolves to this; handlers never throw across IPC. */
export type SpecflowResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | null; error: string }

export type SpecflowHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type SpecflowRequestArgs = {
  method: SpecflowHttpMethod
  /** Joined to `{serverUrl}/api/v1`; must start with `/`. */
  path: string
  body?: unknown
  timeoutMs?: number
}

export type SpecflowConnectArgs = { serverUrl: string; email: string; password: string }

export type SpecflowStatus = { connected: boolean; serverUrl: string | null; email: string | null }

export type SpecflowUser = { id: string; email: string; name: string }

export type SpecflowTaskEvent = { subscriptionId: string; event: string; data: unknown }

export type SpecflowUploadWorkspaceSourceArgs = {
  projectId?: string
  name: string
  workspacePath: string
}

export type SpecflowMcpExtension = { extensionDir: string; planOverlayPath: string }
