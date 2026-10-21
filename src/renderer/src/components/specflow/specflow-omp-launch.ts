import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { resolveAgentLaunchExecutionContext } from '@/lib/launch-agent-execution-context'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { resolveTuiAgentLaunchArgs } from '../../../../shared/tui-agent-launch-defaults'
import {
  quoteStartupArg,
  resolveStartupShell,
  tokenizeStartupCommand,
  type AgentStartupShell
} from '../../../../shared/tui-agent-startup-shell'

/**
 * Builds omp CLI args that load the SpecFlow MCP extension (and optional config overlay) after the
 * user's own omp defaults. Returns null when the result would not re-tokenize to the same argv.
 */
export function buildSpecflowOmpAgentArgs(args: {
  defaultArgs: string
  extensionDir: string
  planOverlayPath: string | null
  shell: AgentStartupShell
}): string | null {
  const defaults = args.defaultArgs.trim()
    ? tokenizeStartupCommand(args.defaultArgs.trim(), args.shell)
    : { ok: true as const, tokens: [] }
  if (!defaults.ok) {
    return null
  }
  const tokens = [
    ...defaults.tokens,
    '-e',
    args.extensionDir,
    ...(args.planOverlayPath ? ['--config', args.planOverlayPath] : [])
  ]
  const agentArgs = tokens.map((token) => quoteStartupArg(token, args.shell)).join(' ')
  // Why: the launch re-tokenizes this string; refuse rather than start omp with different argv.
  const reparsed = tokenizeStartupCommand(agentArgs, args.shell)
  if (
    !reparsed.ok ||
    reparsed.tokens.length !== tokens.length ||
    reparsed.tokens.some((token, index) => token !== tokens[index])
  ) {
    return null
  }
  return agentArgs
}

/** Starts omp with the SpecFlow MCP extension in a new terminal tab of the worktree and reveals it. */
export function launchOmpWithSpecflow(args: {
  worktreeId: string
  extensionDir: string
  /** Config overlay (e.g. plan mode); null launches without one. */
  planOverlayPath: string | null
  prompt: string
}): boolean {
  const store = useAppStore.getState()
  const context = resolveAgentLaunchExecutionContext(store, { worktreeId: args.worktreeId })
  if (!context) {
    return false
  }
  const agentArgs = buildSpecflowOmpAgentArgs({
    defaultArgs: resolveTuiAgentLaunchArgs('omp', store.settings?.agentDefaultArgs),
    extensionDir: args.extensionDir,
    planOverlayPath: args.planOverlayPath,
    shell: resolveStartupShell(context.resolvedLaunchPlatform, context.queuedShell)
  })
  if (agentArgs === null) {
    toast.error(
      translate(
        'specflow.specs.launchInvalidArgs',
        'omp could not be started: the SpecFlow extension path cannot be passed on this shell.'
      )
    )
    return false
  }
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    requestedSurface: 'terminal',
    agent: 'omp',
    worktreeId: args.worktreeId,
    agentArgs,
    prompt: args.prompt,
    // Why: the prompt is multi-line, so start omp clean and submit once its TUI is ready.
    promptDelivery: 'submit-after-ready',
    launchSource: 'task_page'
  })
  if (!result) {
    return false
  }
  const latest = useAppStore.getState()
  latest.setActiveView('terminal')
  if (latest.activeWorktreeId !== args.worktreeId) {
    latest.setActiveWorktree(args.worktreeId)
  }
  return true
}
