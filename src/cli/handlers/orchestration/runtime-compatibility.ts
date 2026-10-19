import { RuntimeClientError } from '../../runtime-client'

// Why: an older launcher may still export a pre-rename orca* name; accept it but advertise omdx*.
const COMPATIBILITY_CLI_COMMANDS: Readonly<Record<string, 'omdx' | 'omdx-ide' | 'omdx-dev'>> = {
  omdx: 'omdx',
  'omdx-ide': 'omdx-ide',
  'omdx-dev': 'omdx-dev',
  orca: 'omdx',
  'orca-ide': 'omdx-ide',
  'orca-dev': 'omdx-dev'
}

export function resolveCompatibilityCliCommand(): 'omdx' | 'omdx-ide' | 'omdx-dev' {
  const configured = process.env.ORCA_CLI_COMMAND
  const known = configured ? COMPATIBILITY_CLI_COMMANDS[configured] : undefined
  if (known) {
    return known
  }
  return process.platform === 'linux' ? 'omdx-ide' : 'omdx'
}

export function resolvePackagedWindowsCompatibilityCommand(): 'omdx' | 'omdx-ide' | undefined {
  if (process.env.ORCA_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1') {
    return undefined
  }
  const command = process.env.ORCA_CLI_COMMAND
  const known = command ? COMPATIBILITY_CLI_COMMANDS[command] : undefined
  if (known === 'omdx' || known === 'omdx-ide') {
    return known
  }
  throw new RuntimeClientError(
    'invalid_argument',
    'The packaged Oh My DevX launcher did not provide a valid resume command. No question was created.'
  )
}

export async function flushOrchestrationStdout(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write('', (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export function isDevCliInvocation(): boolean {
  return (
    process.env.ORCA_DEV_CLI_INVOCATION === '1' ||
    (process.env.ORCA_USER_DATA_PATH?.includes('orca-dev') ?? false)
  )
}
