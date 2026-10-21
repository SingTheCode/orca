import { randomUUID } from 'node:crypto'
import { BrowserWindow, type WebContents } from 'electron'
import type { SpecflowResult, SpecflowTaskEvent } from '../../shared/specflow-types'
import { getSpecflowAccessToken } from './specflow-http-client'
import { createSseFrameParser } from './specflow-sse-parser'

const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000
// Why: the server pings every 25 s; a silent socket past this is a dead proxy connection.
const IDLE_TIMEOUT_MS = 60_000

type Subscription = { projectId: string; controller: AbortController }

const subscriptions = new Map<string, Subscription>()

function broadcast(payload: SpecflowTaskEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('specflow:taskEvent', payload)
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>()
  const timer = setTimeout(resolve, ms)
  signal.addEventListener('abort', () => {
    clearTimeout(timer)
    resolve()
  })
  return promise
}

type StreamOutcome =
  | { kind: 'ended' }
  | { kind: 'unauthorized' }
  | { kind: 'fatal'; status: number }

async function streamOnce(
  subscriptionId: string,
  url: string,
  signal: AbortSignal,
  onOpen: () => void
): Promise<StreamOutcome> {
  const attempt = new AbortController()
  const abortAttempt = (): void => attempt.abort()
  signal.addEventListener('abort', abortAttempt)
  let idleTimer: NodeJS.Timeout | undefined
  const armIdle = (): void => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(abortAttempt, IDLE_TIMEOUT_MS)
  }
  try {
    armIdle()
    const response = await fetch(url, {
      headers: { Accept: 'text/event-stream' },
      signal: attempt.signal
    })
    if (response.status === 401) {
      return { kind: 'unauthorized' }
    }
    // Why: 403/404 mean the project is gone or not ours; retrying cannot fix that.
    if (response.status >= 400 && response.status < 500) {
      return { kind: 'fatal', status: response.status }
    }
    if (!response.ok || !response.body) {
      return { kind: 'ended' }
    }
    onOpen()
    const parse = createSseFrameParser()
    const decoder = new TextDecoder()
    const reader = response.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        return { kind: 'ended' }
      }
      armIdle()
      for (const frame of parse(decoder.decode(value, { stream: true }))) {
        if (frame.event === 'ping') {
          continue
        }
        let data: unknown = frame.data
        try {
          data = JSON.parse(frame.data)
        } catch {
          // Non-JSON payloads are forwarded as the raw string.
        }
        broadcast({ subscriptionId, event: frame.event, data })
      }
    }
  } catch {
    return { kind: 'ended' }
  } finally {
    clearTimeout(idleTimer)
    signal.removeEventListener('abort', abortAttempt)
  }
}

async function runSubscription(subscriptionId: string, sub: Subscription): Promise<void> {
  const { signal } = sub.controller
  let backoff = INITIAL_BACKOFF_MS
  let staleToken: string | undefined
  let connectedBefore = false
  while (!signal.aborted) {
    const token = await getSpecflowAccessToken(staleToken)
    staleToken = undefined
    if (signal.aborted) {
      return
    }
    if (token.ok) {
      const url = `${token.data.serverUrl}/api/v1/projects/${encodeURIComponent(sub.projectId)}/tasks/events?token=${encodeURIComponent(token.data.accessToken)}`
      const outcome = await streamOnce(subscriptionId, url, signal, () => {
        backoff = INITIAL_BACKOFF_MS
        // Why: changes made while disconnected were never pushed; tell the renderer to refetch.
        if (connectedBefore) {
          broadcast({ subscriptionId, event: 'reconnected', data: null })
        }
        connectedBefore = true
      })
      if (outcome.kind === 'fatal') {
        broadcast({ subscriptionId, event: 'closed', data: { status: outcome.status } })
        subscriptions.delete(subscriptionId)
        return
      }
      if (outcome.kind === 'unauthorized') {
        staleToken = token.data.accessToken
      }
    }
    await sleep(backoff, signal)
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  }
}

export function subscribeSpecflowTaskEvents(
  projectId: string,
  owner: WebContents
): SpecflowResult<{ subscriptionId: string }> {
  const subscriptionId = randomUUID()
  const sub: Subscription = { projectId, controller: new AbortController() }
  subscriptions.set(subscriptionId, sub)
  owner.once('destroyed', () => unsubscribeSpecflowTaskEvents(subscriptionId))
  void runSubscription(subscriptionId, sub)
  return { ok: true, data: { subscriptionId } }
}

export function unsubscribeSpecflowTaskEvents(subscriptionId: string): SpecflowResult<null> {
  subscriptions.get(subscriptionId)?.controller.abort()
  subscriptions.delete(subscriptionId)
  return { ok: true, data: null }
}
