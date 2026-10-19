import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

const AUTOMATION_TARGET_FLAGS = [
  'repo',
  'workspace',
  'project',
  'host',
  'project-host-setup',
  'source-context',
  'workspace-mode',
  'base-branch'
]
const AUTOMATION_SCHEDULE_FLAGS = ['trigger', 'schedule', 'time', 'day', 'timezone']
const AUTOMATION_PRECHECK_FLAGS = ['precheck', 'precheck-timeout']
const AUTOMATION_STATE_FLAGS = [
  'enabled',
  'disabled',
  'missed-run-grace-minutes',
  'reuse-session',
  'fresh-session'
]

export const AUTOMATION_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['automations', 'list'],
    summary: 'List scheduled Oh My DevX automations',
    usage: 'omdx automations list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['omdx automations list', 'omdx automations list --json']
  },
  {
    path: ['automations', 'show'],
    summary: 'Show one Oh My DevX automation',
    usage: 'omdx automations show <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id'],
    examples: ['omdx automations show 2f9e...', 'omdx automations show --id 2f9e... --json']
  },
  {
    path: ['automations', 'create'],
    summary: 'Create a scheduled Oh My DevX automation',
    usage:
      'omdx automations create --name <name> --trigger <preset|cron|rrule> --prompt <text> --provider <agent> [--precheck <command>] [--repo <selector>|--workspace <selector>|--project <id-or-name> [--host <host>]|--project-host-setup <id>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'name',
      'prompt',
      'provider',
      'extra-agent-args',
      ...AUTOMATION_PRECHECK_FLAGS,
      ...AUTOMATION_TARGET_FLAGS,
      ...AUTOMATION_SCHEDULE_FLAGS,
      ...AUTOMATION_STATE_FLAGS
    ],
    notes: [
      'Trigger accepts hourly, daily, weekdays, weekly, a 5-field cron expression, or an RRULE string.',
      'When --repo is omitted, the CLI uses the enclosing Oh My DevX worktree when one can be resolved from cwd.',
      'Use --project, or --project-host-setup, to run on a specific project host setup. --project takes the project id or the display name from `omdx project list`, and --host is only needed when the project is set up on more than one host.',
      '--host takes local, ssh:<target-id>, runtime:<environment-id>, or the bare host name `omdx host list` prints for any of them.',
      'Use --source-context with a JSON TaskSourceContext when task/provider data should come from a specific host/account; pass null on edit to clear it.',
      'Use --workspace to run in an existing worktree; otherwise the automation creates a new worktree per run.',
      'Use --precheck to run a bounded command before scheduled runs; exit code 0 continues, anything else records a skipped run.',
      'Use --reuse-session only with existing-workspace automations to submit later runs to the previous live automation session when it is still available. Use --fresh-session to disable reuse.',
      'Use --extra-agent-args="--model opus --effort high" to add arguments after the host\'s default agent Arguments on each fresh run. Only model, effort, and a few safe options are accepted (Claude, Codex, CodeBuddy, Cursor, Grok, OMP); extras cannot be combined with --reuse-session. On edit, --extra-agent-args= clears them.'
    ],
    examples: [
      'omdx automations create --name "Daily review" --trigger daily --prompt "Review open changes" --provider codex',
      'omdx automations create --name "Weekday triage" --trigger "0 9 * * 1-5" --prompt "Triage issues" --provider claude --repo my-repo',
      'omdx automations create --name "PR review" --trigger hourly --precheck "gh pr list --json number -q .[0].number" --prompt "Review requested PRs" --provider codex',
      'omdx automations create --name "Docs pass" --trigger daily --prompt "Tidy the docs" --provider claude --extra-agent-args="--model opus --effort high --add-dir docs"'
    ]
  },
  {
    path: ['automations', 'edit'],
    summary: 'Edit an Oh My DevX automation',
    usage: 'omdx automations edit <id> [--name <name>] [--trigger <preset|cron|rrule>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'id',
      'name',
      'prompt',
      'provider',
      'extra-agent-args',
      ...AUTOMATION_PRECHECK_FLAGS,
      ...AUTOMATION_TARGET_FLAGS,
      ...AUTOMATION_SCHEDULE_FLAGS,
      ...AUTOMATION_STATE_FLAGS
    ],
    positionalArgs: ['id'],
    examples: [
      'omdx automations edit 2f9e... --disabled',
      'omdx automations edit --id 2f9e... --trigger "30 * * * *" --json',
      'omdx automations edit 2f9e... --extra-agent-args='
    ]
  },
  {
    path: ['automations', 'remove'],
    destructive: true,
    summary: 'Remove an Oh My DevX automation and its run history',
    usage: 'omdx automations remove <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id'],
    examples: ['omdx automations remove 2f9e...', 'omdx automations remove --id 2f9e... --json']
  },
  {
    path: ['automations', 'run'],
    summary: 'Run an Oh My DevX automation now',
    usage: 'omdx automations run <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id'],
    examples: ['omdx automations run 2f9e...', 'omdx automations run --id 2f9e... --json']
  },
  {
    path: ['automations', 'runs'],
    summary: 'List automation run history',
    usage:
      'omdx automations runs [--id <automation-id>] [--limit <n>] [--cursor <cursor>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'limit', 'cursor'],
    notes: [
      'Without --limit or --cursor, reads the whole history in pages, so a large history from a paired server still fits in its replies.',
      'With --limit or --cursor, prints one page (newest first, at most 100 runs) and its nextCursor; pass that as --cursor for the next page.'
    ],
    examples: [
      'omdx automations runs',
      'omdx automations runs --id 2f9e... --json',
      'omdx automations runs --limit 20 --json'
    ]
  }
]
