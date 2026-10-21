import { z } from 'zod'
import type {
  SpecflowConnectArgs,
  SpecflowRequestArgs,
  SpecflowResult,
  SpecflowStatus,
  SpecflowUser
} from '../../shared/specflow-types'
import { normalizeSpecflowServerUrl } from '../../shared/specflow-settings'
import {
  deleteSpecflowCredentials,
  readSpecflowCredentials,
  saveSpecflowCredentials,
  type SpecflowCredentials
} from './specflow-credentials'

// Why 600 s: PRD/WBS generation runs LLM calls that routinely take 1–2 minutes.
export const SPECFLOW_DEFAULT_TIMEOUT_MS = 600_000
const AUTH_TIMEOUT_MS = 30_000

const LoginResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  user: z.object({
    id: z.coerce.string(),
    email: z.string(),
    name: z.string().nullish()
  })
})
const RefreshResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1)
})

type Session = { credentials: SpecflowCredentials; accessToken: string; refreshToken: string }
type HttpResponse = { status: number; body: unknown }

// Tokens stay in memory only; the stored password re-mints them after a restart.
let session: Session | null = null
let renewal: Promise<SpecflowResult<Session>> | null = null

function apiUrl(serverUrl: string, path: string): string {
  return `${serverUrl}/api/v1${path}`
}

async function sendJson(
  method: string,
  url: string,
  body: unknown,
  accessToken: string | null,
  timeoutMs: number
): Promise<HttpResponse> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  })
  const text = await response.text()
  let parsed: unknown = null
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }
  return { status: response.status, body: parsed }
}

function errorFromBody(response: HttpResponse): SpecflowResult<never> {
  const body = response.body
  const message =
    typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
      ? body.error
      : typeof body === 'string' && body.length > 0 && body.length < 300
        ? body
        : `SpecFlow request failed with HTTP ${response.status}`
  return { ok: false, status: response.status, error: message }
}

function networkError(error: unknown): SpecflowResult<never> {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return { ok: false, status: null, error: 'SpecFlow request timed out.' }
  }
  const message = error instanceof Error ? error.message : String(error)
  return { ok: false, status: null, error: `Could not reach SpecFlow server: ${message}` }
}

async function login(
  credentials: SpecflowCredentials
): Promise<SpecflowResult<{ session: Session; user: SpecflowUser }>> {
  let response: HttpResponse
  try {
    response = await sendJson(
      'POST',
      apiUrl(credentials.serverUrl, '/auth/login'),
      { email: credentials.email, password: credentials.password },
      null,
      AUTH_TIMEOUT_MS
    )
  } catch (error) {
    return networkError(error)
  }
  if (response.status < 200 || response.status >= 300) {
    return errorFromBody(response)
  }
  const parsed = LoginResponseSchema.safeParse(response.body)
  if (!parsed.success) {
    return { ok: false, status: response.status, error: 'Unexpected SpecFlow login response.' }
  }
  const { access_token, refresh_token, user } = parsed.data
  return {
    ok: true,
    data: {
      session: { credentials, accessToken: access_token, refreshToken: refresh_token },
      user: { id: user.id, email: user.email, name: user.name ?? '' }
    }
  }
}

async function refresh(current: Session): Promise<Session | null> {
  try {
    const response = await sendJson(
      'POST',
      apiUrl(current.credentials.serverUrl, '/auth/refresh'),
      { refresh_token: current.refreshToken },
      null,
      AUTH_TIMEOUT_MS
    )
    const parsed = RefreshResponseSchema.safeParse(response.body)
    if (response.status !== 200 || !parsed.success) {
      return null
    }
    return {
      credentials: current.credentials,
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token
    }
  } catch {
    return null
  }
}

function loadCredentials(): SpecflowResult<SpecflowCredentials> {
  try {
    const credentials = readSpecflowCredentials()
    return credentials
      ? { ok: true, data: credentials }
      : { ok: false, status: null, error: 'SpecFlow is not connected.' }
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/** Refreshes once when a stale session exists, else logs in with the stored password. */
async function renewSession(stale: Session | null): Promise<SpecflowResult<Session>> {
  if (stale) {
    const refreshed = await refresh(stale)
    if (refreshed) {
      return { ok: true, data: refreshed }
    }
  }
  const credentials = stale ? { ok: true as const, data: stale.credentials } : loadCredentials()
  if (!credentials.ok) {
    return credentials
  }
  const result = await login(credentials.data)
  return result.ok ? { ok: true, data: result.data.session } : result
}

// Why single-flight: parallel tab loads all 401 at token expiry; one refresh must serve them all.
function renewSessionOnce(stale: Session | null): Promise<SpecflowResult<Session>> {
  if (!renewal) {
    renewal = renewSession(stale)
      .then((result) => {
        session = result.ok ? result.data : null
        return result
      })
      .finally(() => {
        renewal = null
      })
  }
  return renewal
}

export async function connectSpecflow(
  args: SpecflowConnectArgs
): Promise<SpecflowResult<{ user: SpecflowUser }>> {
  const serverUrl = normalizeSpecflowServerUrl(args.serverUrl)
  if (!serverUrl) {
    return { ok: false, status: null, error: 'SpecFlow server URL must be an http(s) URL.' }
  }
  const credentials = { serverUrl, email: args.email.trim(), password: args.password }
  const result = await login(credentials)
  if (!result.ok) {
    return result
  }
  try {
    saveSpecflowCredentials(credentials)
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
  session = result.data.session
  return { ok: true, data: { user: result.data.user } }
}

export function disconnectSpecflow(): SpecflowResult<null> {
  session = null
  deleteSpecflowCredentials()
  return { ok: true, data: null }
}

export function getSpecflowStatus(): SpecflowResult<SpecflowStatus> {
  let credentials: SpecflowCredentials | null = session?.credentials ?? null
  if (!credentials) {
    try {
      credentials = readSpecflowCredentials()
    } catch (error) {
      return {
        ok: false,
        status: null,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
  return {
    ok: true,
    data: credentials
      ? { connected: true, serverUrl: credentials.serverUrl, email: credentials.email }
      : { connected: false, serverUrl: null, email: null }
  }
}

/** Authenticated JSON call; on 401 renews the session (refresh, else re-login) and retries once. */
export async function specflowRequest<T>(args: SpecflowRequestArgs): Promise<SpecflowResult<T>> {
  let current = session
  if (!current) {
    const renewed = await renewSessionOnce(null)
    if (!renewed.ok) {
      return renewed
    }
    current = renewed.data
  }
  const timeoutMs = args.timeoutMs ?? SPECFLOW_DEFAULT_TIMEOUT_MS
  const send = (active: Session): Promise<HttpResponse> =>
    sendJson(
      args.method,
      apiUrl(active.credentials.serverUrl, args.path),
      args.body,
      active.accessToken,
      timeoutMs
    )
  try {
    let response = await send(current)
    if (response.status === 401) {
      // Why compare: another request may already have renewed while this one was in flight.
      const renewed =
        session && session.accessToken !== current.accessToken
          ? { ok: true as const, data: session }
          : await renewSessionOnce(current)
      if (!renewed.ok) {
        return renewed
      }
      response = await send(renewed.data)
    }
    if (response.status < 200 || response.status >= 300) {
      return errorFromBody(response)
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: generic JSON passthrough; callers own the response shape they request.
    return { ok: true, data: response.body as T }
  } catch (error) {
    return networkError(error)
  }
}

/** Server URL of the connected account, or null when disconnected. */
export function getConnectedSpecflowServerUrl(): string | null {
  const status = getSpecflowStatus()
  return status.ok ? status.data.serverUrl : null
}

/**
 * Access token for transports that cannot go through `specflowRequest` (SSE `?token=`).
 * Pass the token that just got a 401 as `stale` to force a renewal.
 */
export async function getSpecflowAccessToken(
  stale?: string
): Promise<SpecflowResult<{ serverUrl: string; accessToken: string }>> {
  let current = session
  if (!current || (stale !== undefined && current.accessToken === stale)) {
    const renewed = await renewSessionOnce(current)
    if (!renewed.ok) {
      return renewed
    }
    current = renewed.data
  }
  return {
    ok: true,
    data: { serverUrl: current.credentials.serverUrl, accessToken: current.accessToken }
  }
}

export function _resetSpecflowSessionForTests(): void {
  session = null
  renewal = null
}
