import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import type * as NodeOs from 'node:os'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSecretStore } from '../../shared/secret-store'
import { _resetSpecflowSessionForTests, connectSpecflow } from './specflow-http-client'
import { ensureSpecflowMcpExtension } from './specflow-mcp-extension'

const homeState = vi.hoisted(() => ({ dir: '' }))
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOs>()
  return { ...actual, homedir: () => homeState.dir }
})

const SERVER = 'http://specflow.test'
const PROJECT_ID = '0123456789abcdef-project'

describe('ensureSpecflowMcpExtension', () => {
  let mcpKeyCalls = 0

  beforeEach(async () => {
    homeState.dir = mkdtempSync(join(tmpdir(), 'specflow-mcp-'))
    setSecretStore({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(value),
      decryptString: (value) => value.toString('utf8'),
      describeProtectionGap: () => null
    })
    _resetSpecflowSessionForTests()
    mcpKeyCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith('/auth/login')) {
          return new Response(
            JSON.stringify({
              access_token: 'access',
              refresh_token: 'refresh',
              user: { id: 'u1', email: 'a@b.c', name: 'A' }
            }),
            { status: 200 }
          )
        }
        if (url === `${SERVER}/api/v1/projects/${PROJECT_ID}/mcp-keys`) {
          mcpKeyCalls += 1
          expect(init.method).toBe('POST')
          expect(JSON.parse(String(init.body))).toEqual({ title: 'orca-omp' })
          return new Response(JSON.stringify({ id: 'k1', key: `sf_mcp_test${mcpKeyCalls}` }), {
            status: 201
          })
        }
        return new Response('{}', { status: 404 })
      })
    )
    await connectSpecflow({ serverUrl: SERVER, email: 'a@b.c', password: 'pw' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    rmSync(homeState.dir, { recursive: true, force: true })
  })

  it('writes the omp extension package with an owner-only .mcp.json', async () => {
    const result = await ensureSpecflowMcpExtension(PROJECT_ID, '/opt/specflow/mcp/index.js')

    const extensionDir = join(homeState.dir, '.orca', 'specflow-mcp', PROJECT_ID)
    expect(result).toEqual({
      ok: true,
      data: { extensionDir, planOverlayPath: join(extensionDir, 'plan.yml') }
    })
    expect(JSON.parse(readFileSync(join(extensionDir, 'package.json'), 'utf-8'))).toEqual({
      name: 'orca-specflow-01234567',
      version: '0.0.0',
      omp: { extensions: ['./ext.ts'] }
    })
    expect(readFileSync(join(extensionDir, 'ext.ts'), 'utf-8')).toBe(
      'export default function () {}\n'
    )
    expect(readFileSync(join(extensionDir, 'plan.yml'), 'utf-8')).toBe(
      'plan:\n  defaultOnStartup: true\n'
    )
    const mcpJsonPath = join(extensionDir, '.mcp.json')
    expect(JSON.parse(readFileSync(mcpJsonPath, 'utf-8'))).toEqual({
      mcpServers: {
        specflow: {
          type: 'stdio',
          command: 'node',
          args: ['/opt/specflow/mcp/index.js', '--api-key=sf_mcp_test1', `--backend-url=${SERVER}`]
        }
      }
    })
    if (process.platform !== 'win32') {
      expect(statSync(mcpJsonPath).mode & 0o777).toBe(0o600)
    }
  })

  it('reuses the cached key on the second call', async () => {
    await ensureSpecflowMcpExtension(PROJECT_ID, '/opt/specflow/mcp/index.js')
    const second = await ensureSpecflowMcpExtension(PROJECT_ID, '/opt/specflow/mcp/index.js')

    expect(second.ok).toBe(true)
    expect(mcpKeyCalls).toBe(1)
    const mcpJson = readFileSync(
      join(homeState.dir, '.orca', 'specflow-mcp', PROJECT_ID, '.mcp.json'),
      'utf-8'
    )
    expect(mcpJson).toContain('--api-key=sf_mcp_test1')
  })
})
