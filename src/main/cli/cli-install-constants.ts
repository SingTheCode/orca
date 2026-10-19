export const DEFAULT_MAC_COMMAND_PATH = '/usr/local/bin/omdx'
export const DEV_COMMAND_NAME = 'omdx-dev'
// Why: pre-rename Linux command names; managed copies are reclaimed after `omdx-ide` registers.
export const LEGACY_LINUX_COMMAND_NAMES = ['orca-ide', 'orca'] as const
// Why: dev builds before the rename generated `orca-dev` (and an `orca` alias) launchers.
export const LEGACY_DEV_LAUNCHER_NAMES = ['orca-dev', 'orca'] as const
export const DEV_LAUNCHER_DIR = ['cli', 'bin'] as const
export const WINDOWS_PATH_WRITE_TIMEOUT_MS = 5_000
