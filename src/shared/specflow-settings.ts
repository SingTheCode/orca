export const DEFAULT_SPECFLOW_SERVER_URL = 'http://localhost:8088'

/** Non-secret SpecFlow settings; credentials live in `~/.orca/specflow-credentials`. */
export type SpecflowGlobalSettings = {
  /** Absent reads as DEFAULT_SPECFLOW_SERVER_URL. */
  specflowServerUrl?: string
  /** Orca repoId → SpecFlow projectId. */
  specflowProjectByRepo?: Record<string, string>
  /** SpecFlow MCP stdio entry (`mcp/index.js`); absent reads as `~/dev/spec_flow/mcp/index.js`. */
  specflowMcpEntryPath?: string
  /** Orca repoId → SpecFlow project created by workspace source import (code graph). */
  specflowCodeGraphProjectByRepo?: Record<string, string>
}

/** Returns `scheme://host[:port][/base]` without trailing slash or `/api/v1`, or null when invalid. */
export function normalizeSpecflowServerUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    return null
  }
  const basePath = url.pathname.replace(/\/+$/, '').replace(/\/api\/v1$/, '')
  return `${url.origin}${basePath}`
}

function normalizeIdMap(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  const result: Record<string, string> = {}
  for (const [key, id] of Object.entries(value)) {
    if (key.length > 0 && typeof id === 'string' && id.trim().length > 0) {
      result[key] = id.trim()
    }
  }
  return result
}

/** Coerces renderer-written SpecFlow settings to their declared shapes. */
export function sanitizeSpecflowSettingsUpdate(
  args: Partial<Record<keyof SpecflowGlobalSettings, unknown>>
): Partial<SpecflowGlobalSettings> {
  const sanitized: Partial<SpecflowGlobalSettings> = {}
  if ('specflowServerUrl' in args) {
    sanitized.specflowServerUrl =
      normalizeSpecflowServerUrl(args.specflowServerUrl) ?? DEFAULT_SPECFLOW_SERVER_URL
  }
  if ('specflowMcpEntryPath' in args) {
    sanitized.specflowMcpEntryPath =
      typeof args.specflowMcpEntryPath === 'string' ? args.specflowMcpEntryPath.trim() : ''
  }
  if ('specflowProjectByRepo' in args) {
    sanitized.specflowProjectByRepo = normalizeIdMap(args.specflowProjectByRepo)
  }
  if ('specflowCodeGraphProjectByRepo' in args) {
    sanitized.specflowCodeGraphProjectByRepo = normalizeIdMap(args.specflowCodeGraphProjectByRepo)
  }
  return sanitized
}
