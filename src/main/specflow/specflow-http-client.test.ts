import { mkdtempSync, rmSync } from 'node:fs'
import type * as NodeOs from 'node:os'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSecretStore } from '../../shared/secret-store'
import {
  _resetSpecflowSessionForTests,
  connectSpecflow,
  specflowRequest
} from './specflow-http-client'

const homeState = vi.hoisted(() => ({ dir: '' }))
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOs>()
  return { ...actual, homedir: () => homeState.dir }
})

type Call = { url: string; method: string; auth: string | null; body: unknown }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status })
}

const SERVER = 'http://specflow.test'
const LOGIN_BODY = (token: string) => ({
  access_token: `access-${token}`,
  refresh_token: `refresh-${token}`,
  user: { id: 'u1', email: 'a@b.c', name: 'A' }
})

let calls: Call[] = []

function installFetch(handler: (call: Call) => Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const call = {
        url,
        method: init.method ?? 'GET',
        auth: new Headers(init.headers).get('Authorization'),
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined
      }
      calls.push(call)
      return handler(call)
    })
  )
}

describe('specflow http client auth renewal', () => {
  beforeEach(() => {
    homeState.dir = mkdtempSync(join(tmpdir(), 'specflow-http-'))
    setSecretStore({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(value),
      decryptString: (value) => value.toString('utf8'),
      describeProtectionGap: () => null
    })
    _resetSpecflowSessionForTests()
    calls = []
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    rmSync(homeState.dir, { recursive: true, force: true })
  })

  it('refreshes on 401 and retries with the new access token', async () => {
    installFetch((call) => {
      if (call.url.endsWith('/auth/login')) {
        return jsonResponse(200, LOGIN_BODY('1'))
      }
      if (call.url.endsWith('/auth/refresh')) {
        return jsonResponse(200, { access_token: 'access-2', refresh_token: 'refresh-2' })
      }
      return call.auth === 'Bearer access-2'
        ? jsonResponse(200, [{ id: 'p1' }])
        : jsonResponse(401, { error: 'expired' })
    })
    expect((await connectSpecflow({ serverUrl: SERVER, email: 'a@b.c', password: 'pw' })).ok).toBe(
      true
    )

    const result = await specflowRequest<{ id: string }[]>({ method: 'GET', path: '/projects' })

    expect(result).toEqual({ ok: true, data: [{ id: 'p1' }] })
    expect(calls.map((call) => call.url.replace(`${SERVER}/api/v1`, ''))).toEqual([
      '/auth/login',
      '/projects',
      '/auth/refresh',
      '/projects'
    ])
    expect(calls[2]?.body).toEqual({ refresh_token: 'refresh-1' })
  })

  it('re-logs in with the stored password when refresh fails, then retries', async () => {
    let logins = 0
    installFetch((call) => {
      if (call.url.endsWith('/auth/login')) {
        logins += 1
        return jsonResponse(200, LOGIN_BODY(String(logins)))
      }
      if (call.url.endsWith('/auth/refresh')) {
        return jsonResponse(401, { error: 'refresh expired' })
      }
      return call.auth === 'Bearer access-2'
        ? jsonResponse(200, { ok: 1 })
        : jsonResponse(401, { error: 'expired' })
    })
    await connectSpecflow({ serverUrl: SERVER, email: 'a@b.c', password: 'pw' })
    // Fresh process: tokens are memory-only, so the next login reads the stored credential file.
    _resetSpecflowSessionForTests()
    const first = await specflowRequest({ method: 'GET', path: '/projects' })
    expect(first).toEqual({ ok: true, data: { ok: 1 } })
    expect(logins).toBe(2)

    // Stale token on an existing session: refresh fails, re-login mints access-3, retry succeeds once.
    installFetch((call) => {
      if (call.url.endsWith('/auth/login')) {
        return jsonResponse(200, LOGIN_BODY('3'))
      }
      if (call.url.endsWith('/auth/refresh')) {
        return jsonResponse(401, { error: 'refresh expired' })
      }
      return call.auth === 'Bearer access-3'
        ? jsonResponse(200, { ok: 2 })
        : jsonResponse(401, { error: 'expired' })
    })
    calls = []
    const second = await specflowRequest({ method: 'POST', path: '/projects', body: { name: 'x' } })

    expect(second).toEqual({ ok: true, data: { ok: 2 } })
    expect(calls.map((call) => call.url.replace(`${SERVER}/api/v1`, ''))).toEqual([
      '/projects',
      '/auth/refresh',
      '/auth/login',
      '/projects'
    ])
    expect(calls[2]?.body).toEqual({ email: 'a@b.c', password: 'pw' })
  })
})
