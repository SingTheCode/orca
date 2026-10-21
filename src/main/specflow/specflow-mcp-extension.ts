import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { writeSecureFile } from '../../shared/secure-file'
import type { SpecflowMcpExtension, SpecflowResult } from '../../shared/specflow-types'
import { getConnectedSpecflowServerUrl, specflowRequest } from './specflow-http-client'

const PLAN_OVERLAY = 'plan:\n  defaultOnStartup: true\n'
const EXTENSION_SOURCE = 'export default function () {}\n'
const API_KEY_ARG = '--api-key='
const BACKEND_URL_ARG = '--backend-url='

const McpKeyResponseSchema = z.object({ key: z.string().min(1) })
const McpConfigSchema = z.object({
  mcpServers: z.object({ specflow: z.object({ args: z.array(z.string()) }) })
})

/** projectId becomes a directory name, so only server-style ids are accepted. */
export function isSpecflowProjectId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(value)
}

export function defaultSpecflowMcpEntryPath(): string {
  return join(homedir(), 'dev', 'spec_flow', 'mcp', 'index.js')
}

function readCachedConfig(
  mcpJsonPath: string
): { apiKey: string; serverUrl: string; entry: string } | null {
  if (!existsSync(mcpJsonPath)) {
    return null
  }
  try {
    const parsed = McpConfigSchema.safeParse(JSON.parse(readFileSync(mcpJsonPath, 'utf-8')))
    if (!parsed.success) {
      return null
    }
    const args = parsed.data.mcpServers.specflow.args
    const apiKey = args.find((arg) => arg.startsWith(API_KEY_ARG))?.slice(API_KEY_ARG.length)
    const serverUrl = args
      .find((arg) => arg.startsWith(BACKEND_URL_ARG))
      ?.slice(BACKEND_URL_ARG.length)
    return apiKey && serverUrl ? { apiKey, serverUrl, entry: args[0] ?? '' } : null
  } catch {
    return null
  }
}

async function writeExtension(
  projectId: string,
  mcpEntryPath: string
): Promise<SpecflowResult<SpecflowMcpExtension>> {
  const serverUrl = getConnectedSpecflowServerUrl()
  if (!serverUrl) {
    return { ok: false, status: null, error: 'SpecFlow is not connected.' }
  }
  const extensionDir = join(homedir(), '.orca', 'specflow-mcp', projectId)
  const mcpJsonPath = join(extensionDir, '.mcp.json')
  const planOverlayPath = join(extensionDir, 'plan.yml')
  const cached = readCachedConfig(mcpJsonPath)

  // Why: a key belongs to one server, so a changed server URL mints a fresh key there.
  let apiKey = cached?.serverUrl === serverUrl ? cached.apiKey : null
  if (!apiKey) {
    const created = await specflowRequest<unknown>({
      method: 'POST',
      path: `/projects/${projectId}/mcp-keys`,
      body: { title: 'orca-omp' }
    })
    if (!created.ok) {
      return created
    }
    const parsed = McpKeyResponseSchema.safeParse(created.data)
    if (!parsed.success) {
      return { ok: false, status: null, error: 'Unexpected SpecFlow MCP key response.' }
    }
    apiKey = parsed.data.key
  }

  mkdirSync(extensionDir, { recursive: true, mode: 0o700 })
  const packageJson = {
    name: `orca-specflow-${projectId.slice(0, 8)}`,
    version: '0.0.0',
    omp: { extensions: ['./ext.ts'] }
  }
  writeFileSync(join(extensionDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`)
  writeFileSync(join(extensionDir, 'ext.ts'), EXTENSION_SOURCE)
  writeFileSync(planOverlayPath, PLAN_OVERLAY)
  if (!cached || cached.apiKey !== apiKey || cached.entry !== mcpEntryPath) {
    const mcpConfig = {
      mcpServers: {
        specflow: {
          type: 'stdio',
          command: 'node',
          args: [mcpEntryPath, `${API_KEY_ARG}${apiKey}`, `${BACKEND_URL_ARG}${serverUrl}`]
        }
      }
    }
    writeSecureFile(mcpJsonPath, `${JSON.stringify(mcpConfig, null, 2)}\n`)
  }
  return { ok: true, data: { extensionDir, planOverlayPath } }
}

const inFlight = new Map<string, Promise<SpecflowResult<SpecflowMcpExtension>>>()

/** Writes (once per project and server) an omp extension package that attaches the SpecFlow MCP server. */
export function ensureSpecflowMcpExtension(
  projectId: string,
  mcpEntryPath: string
): Promise<SpecflowResult<SpecflowMcpExtension>> {
  // Why single-flight: two quick launches would otherwise mint two keys for one project.
  const pending = inFlight.get(projectId)
  if (pending) {
    return pending
  }
  const run = writeExtension(projectId, mcpEntryPath)
    .catch((error: unknown): SpecflowResult<SpecflowMcpExtension> => ({
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error)
    }))
    .finally(() => inFlight.delete(projectId))
  inFlight.set(projectId, run)
  return run
}
