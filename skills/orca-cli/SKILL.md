---
name: orca-cli
description: >-
  Operate Oh My DevX-managed worktrees, folder contexts, terminals, repos, automations, artifacts,
  skill sharing, worktree comments, and Oh My DevX's embedded browser through the `omdx` CLI. Use
  when the user says "$orca-cli", "Oh My DevX worktree", "child worktree", "spawn codex/claude in a
  worktree", "read/wait/send Oh My DevX terminal", "handoff" / "handover" / "give this to another
  agent", "Oh My DevX browser", "omdx artifacts", or "share skills". Prefer it over raw git
  worktree, ad hoc PTYs, or Computer Use when Oh My DevX state is involved. Use Computer Use only
  when a visible window needs GUI control that a CLI, filesystem, or API cannot do.
---

# Oh My DevX CLI

This discovery stub loads the version-matched guide from the Oh My DevX executable used for this session.

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- If the `ORCA_CLI_COMMAND` environment variable is set, use its value. Oh My DevX exports this
  for managed WSL sessions.
- Otherwise, in a dev checkout whose session exposes `ORCA_DEV_REPO_ROOT`, use `omdx-dev`.
- Otherwise, on Linux outside an Oh My DevX-managed terminal, use `omdx-ide`. Bare `omdx` is
  only provided inside Oh My DevX's terminals there. Never run bare `orca` on Linux: it
  normally resolves to the GNOME Orca screen reader (`/usr/bin/orca`) and starts speech on
  the user's machine.
- Otherwise, use `omdx`.

Below, `OMDX` is a placeholder for the executable you resolved. Substitute it before
running anything; do not create a shell variable or run `OMDX` literally. This works the
same way in POSIX shells, PowerShell, and cmd.exe.

If the selected executable cannot run, report its exact error and stop. Do not fall through
to another executable, which could silently target a different Oh My DevX build.

## Load the version-matched guide before running Oh My DevX commands

```text
OMDX skills get orca-cli
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Oh My DevX is not running, start it with `OMDX open --json`
and retry. If it fails with `runtime_access_denied`, your sandbox blocked the connection:
re-run it with escalated permissions, and do not run `OMDX open` or restart Oh My DevX. If
`skills get` is unknown, explain that updating Oh My DevX restores the guide; use `--help` for
read-only discovery and do not guess unsupported commands.
