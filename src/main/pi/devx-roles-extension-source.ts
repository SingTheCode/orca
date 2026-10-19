// Why: the fork's house setup routes every OMP role through the DevX gateway's
// local devx-proxy. models.yml is the user's file, so the provider is registered
// from an Orca-managed extension instead, and role presets apply only to roles
// the user has not configured (an explicit modelRoles entry always wins).
// Like the other managed extensions, the source is a plain string loaded by
// OMP's own loader; it must not import Orca code.

export const ORCA_OMP_DEVX_ROLES_EXTENSION_FILE = 'orca-devx-roles.ts'

export const DEVX_PROXY_BASE_URL = 'http://localhost:18888/v1'

/** Role presets applied when the user's modelRoles leaves the role unset. */
export const DEVX_ROLE_PRESETS: Readonly<Record<string, string>> = {
  default: 'devx/vertex_ai/claude-opus-5-5:medium',
  smol: 'devx/azure_openai/gpt-6-luna:high',
  slow: 'devx/vertex_ai/claude-opus-5-5:xhigh',
  plan: 'devx/vertex_ai/claude-opus-5-5:xhigh',
  task: 'devx/vertex_ai/claude-opus-5-5:medium',
  commit: 'devx/azure_openai/gpt-5.6-luna:high',
  tiny: 'devx/azure_openai/gpt-6-luna:high',
  vision: 'devx/azure_openai/gpt-6.1-sol:medium'
}

export function getOmpDevxRolesExtensionSource(): string {
  return [
    "import { lookup } from '@oh-my-pi/pi-coding-agent/config/registry'",
    '',
    `const DEVX_BASE_URL = ${JSON.stringify(DEVX_PROXY_BASE_URL)}`,
    `const ROLE_PRESETS = ${JSON.stringify(DEVX_ROLE_PRESETS)}`,
    '',
    'export default function (pi) {',
    '  // A user-defined devx provider in models.yml keeps its own wiring.',
    '  pi.registerProvider("devx", {',
    '    baseUrl: DEVX_BASE_URL,',
    '    // devx-proxy authenticates upstream itself and ignores this value.',
    '    apiKey: "devx-proxy",',
    '    api: "openai-completions",',
    '    async fetchDynamicModels() {',
    '      const response = await fetch(`${DEVX_BASE_URL}/models`)',
    '      if (!response.ok) return []',
    '      const body = await response.json()',
    '      // Bare ids pick up limits and capabilities from the bundled catalog.',
    "      return (body?.data ?? []).filter((m) => typeof m?.id === 'string').map((m) => ({ id: m.id }))",
    '    }',
    '  })',
    '',
    '  const roles = lookup("modelRoles")',
    '  const settings = pi.pi?.settings',
    '  if (!roles || !settings) return',
    '  const configured = roles.get(settings) ?? {}',
    '  const missing = Object.fromEntries(',
    '    Object.entries(ROLE_PRESETS).filter(([role]) => !configured[role])',
    '  )',
    '  if (Object.keys(missing).length === 0) return',
    "  // Runtime-only: never written to the user's config.yml.",
    '  roles.override(settings, { ...missing, ...configured })',
    '}',
    ''
  ].join('\n')
}
