import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const AGENT_HOOK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent', 'hooks', 'prepare-codex'],
    summary: "Prepare a WSL pane's Oh My DevX-managed Codex home before a shell launch",
    usage: 'omdx agent hooks prepare-codex',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['agent', 'hooks', 'status'],
    summary: 'Show whether Oh My DevX-managed agent status hooks are enabled',
    usage: 'omdx agent hooks status [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['omdx agent hooks status', 'omdx agent hooks status --json']
  },
  {
    path: ['agent', 'hooks', 'off'],
    summary: 'Disable Oh My DevX-managed agent status hooks and remove local hook entries',
    usage: 'omdx agent hooks off [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['omdx agent hooks off']
  },
  {
    path: ['agent', 'hooks', 'on'],
    summary: 'Enable Oh My DevX-managed agent status hooks',
    usage: 'omdx agent hooks on [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['omdx agent hooks on']
  }
]
