---
name: orca-per-workspace-env
description: >-
  Set up, review, debug, or validate an Oh My DevX per-workspace environment recipe: the
  on-demand, disposable runtime (cloud sandbox, VM, SSH host, or local container)
  Oh My DevX creates fresh for each workspace. Use to stand up a new recipe end to end,
  fix an `environmentRecipes` entry in `orca.yaml`, scaffold provider lifecycle
  scripts, or resolve an `omdx vm recipe doctor` failure. Use `orca-cli` for
  ordinary worktree and workspace creation with no recipe involved.
---

# Per-Workspace Environments

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
OMDX skills get orca-per-workspace-env
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Oh My DevX is not running, start it with `OMDX open --json`
and retry. If it fails with `runtime_access_denied`, your sandbox blocked the connection:
re-run it with escalated permissions, and do not run `OMDX open` or restart Oh My DevX. If
`skills get` is unknown, explain that updating Oh My DevX restores the guide; use `--help` for
read-only discovery and do not guess unsupported commands.
