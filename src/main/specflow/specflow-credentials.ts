import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { readStoredCredentialToken, writeEncryptedCredential } from '../integration-credential-file'

const SpecflowCredentialsSchema = z.object({
  serverUrl: z.string(),
  email: z.string(),
  password: z.string()
})

export type SpecflowCredentials = { serverUrl: string; email: string; password: string }

export function getSpecflowCredentialsPath(): string {
  return join(homedir(), '.orca', 'specflow-credentials')
}

/** Null when nothing is stored; throws CredentialDecryptionError when the file cannot be unsealed. */
export function readSpecflowCredentials(): SpecflowCredentials | null {
  const path = getSpecflowCredentialsPath()
  if (!existsSync(path)) {
    return null
  }
  const token = readStoredCredentialToken('SpecFlow', readFileSync(path))
  if (!token) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(token)
  } catch {
    return null
  }
  const result = SpecflowCredentialsSchema.safeParse(parsed)
  return result.success ? result.data : null
}

export function saveSpecflowCredentials(credentials: SpecflowCredentials): void {
  const path = getSpecflowCredentialsPath()
  mkdirSync(join(homedir(), '.orca'), { recursive: true })
  writeEncryptedCredential('SpecFlow', path, JSON.stringify(credentials))
}

export function deleteSpecflowCredentials(): void {
  try {
    unlinkSync(getSpecflowCredentialsPath())
  } catch {
    // Already absent.
  }
}
