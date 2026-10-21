import { lstat, readdir, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'
import { zip, type Zippable } from 'fflate'
import { z } from 'zod'
import type { SpecflowResult, SpecflowUploadWorkspaceSourceArgs } from '../../shared/specflow-types'
import { gitExecFileAsync } from '../git/runner'
import { getSpecflowAccessToken, SPECFLOW_DEFAULT_TIMEOUT_MS } from './specflow-http-client'

export const SOURCE_UPLOAD_MAX_FILE_BYTES = 1024 * 1024
// Why 20 MB: ImportProjectFromSource rejects larger request bodies.
export const SOURCE_UPLOAD_MAX_ZIP_BYTES = 20 * 1024 * 1024
// Why: bounds memory before compression; text sources compress far below this.
const MAX_RAW_BYTES = 200 * 1024 * 1024
const GIT_LIST_MAX_BUFFER = 64 * 1024 * 1024

const EXCLUDED_DIRS: Record<string, true> = {
  node_modules: true,
  dist: true,
  out: true,
  build: true,
  '.next': true,
  coverage: true
}

const ImportResponseSchema = z.object({ project: z.object({ id: z.string().min(1) }) })

/**
 * Whether a workspace-relative path (either separator) belongs in the upload.
 * Hidden segments are skipped too: `.git`, `.env*` and tool caches hold no parseable source.
 */
export function isUploadableSourcePath(relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]+/).filter((segment) => segment.length > 0)
  if (segments.length === 0) {
    return false
  }
  return segments.every(
    (segment) => !segment.startsWith('.') && !EXCLUDED_DIRS[segment] && segment !== '..'
  )
}

async function listGitFiles(root: string): Promise<string[] | null> {
  try {
    const { stdout } = await gitExecFileAsync(
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { cwd: root, maxBuffer: GIT_LIST_MAX_BUFFER }
    )
    return stdout.split('\0').filter((entry) => entry.length > 0)
  } catch {
    // Not a git work tree (folder workspace) or git unavailable: fall back to the walk.
    return null
  }
}

async function walkFiles(root: string): Promise<string[]> {
  const files: string[] = []
  const pending = ['']
  while (pending.length > 0) {
    const dir = pending.pop() ?? ''
    const entries = await readdir(join(root, dir), { withFileTypes: true })
    for (const entry of entries) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name
      if (!isUploadableSourcePath(rel)) {
        continue
      }
      // Dirent types come from lstat, so symlinks are neither dirs nor files here.
      if (entry.isDirectory()) {
        pending.push(rel)
      } else if (entry.isFile()) {
        files.push(rel)
      }
    }
  }
  return files
}

async function collectSourceFiles(root: string): Promise<SpecflowResult<Zippable>> {
  const listed = (await listGitFiles(root)) ?? (await walkFiles(root))
  const tree: Zippable = {}
  let rawBytes = 0
  for (const rel of listed) {
    if (!isUploadableSourcePath(rel)) {
      continue
    }
    const absolute = join(root, rel)
    // Why: git lists tracked paths that may resolve outside the root through a symlink.
    if (relative(root, absolute).split(sep).includes('..')) {
      continue
    }
    const info = await lstat(absolute).catch(() => null)
    if (!info || !info.isFile() || info.size > SOURCE_UPLOAD_MAX_FILE_BYTES) {
      continue
    }
    rawBytes += info.size
    if (rawBytes > MAX_RAW_BYTES) {
      return {
        ok: false,
        status: null,
        error: 'Workspace source exceeds 200 MB before compression; upload a smaller folder.'
      }
    }
    tree[rel.split(/[\\/]+/).join('/')] = new Uint8Array(await readFile(absolute))
  }
  if (Object.keys(tree).length === 0) {
    return { ok: false, status: null, error: 'No source files found to upload.' }
  }
  return { ok: true, data: tree }
}

function errorMessage(status: number, text: string): string {
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      const value = parsed.error
      if (typeof value === 'string' && value.length > 0) {
        return value
      }
    }
  } catch {
    // Non-JSON body; fall through.
  }
  return `SpecFlow source import failed with HTTP ${status}`
}

async function postImport(name: string, archive: Uint8Array): Promise<SpecflowResult<string>> {
  const send = async (serverUrl: string, accessToken: string): Promise<Response> => {
    const form = new FormData()
    form.append('name', name)
    form.append('file', new Blob([Buffer.from(archive)], { type: 'application/zip' }), 'source.zip')
    return fetch(`${serverUrl}/api/v1/projects/import-source`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      body: form,
      signal: AbortSignal.timeout(SPECFLOW_DEFAULT_TIMEOUT_MS)
    })
  }
  try {
    let auth = await getSpecflowAccessToken()
    if (!auth.ok) {
      return auth
    }
    let response = await send(auth.data.serverUrl, auth.data.accessToken)
    if (response.status === 401) {
      auth = await getSpecflowAccessToken(auth.data.accessToken)
      if (!auth.ok) {
        return auth
      }
      response = await send(auth.data.serverUrl, auth.data.accessToken)
    }
    const text = await response.text()
    if (response.status < 200 || response.status >= 300) {
      return { ok: false, status: response.status, error: errorMessage(response.status, text) }
    }
    const parsed = ImportResponseSchema.safeParse(JSON.parse(text))
    if (!parsed.success) {
      return { ok: false, status: response.status, error: 'Unexpected SpecFlow import response.' }
    }
    return { ok: true, data: parsed.data.project.id }
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return { ok: false, status: null, error: 'SpecFlow source upload timed out.' }
    }
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, status: null, error: `Could not upload source to SpecFlow: ${message}` }
  }
}

/**
 * Zips the workspace and creates a new SpecFlow import project from it.
 * Why always new: `/import-source/retry` only replays the stored zip of a FAILED import and
 * cannot take new content, so a re-upload creates a fresh project and the caller replaces its mapping.
 */
export async function uploadWorkspaceSource(
  args: SpecflowUploadWorkspaceSourceArgs
): Promise<SpecflowResult<{ projectId: string }>> {
  const root = args.workspacePath
  const name = args.name.trim()
  if (!name) {
    return { ok: false, status: null, error: 'Project name is required.' }
  }
  if (!isAbsolute(root)) {
    return { ok: false, status: null, error: 'Workspace path must be absolute.' }
  }
  const rootInfo = await stat(root).catch(() => null)
  if (!rootInfo?.isDirectory()) {
    return { ok: false, status: null, error: 'Workspace path is not an existing directory.' }
  }
  let archive: Uint8Array
  try {
    const tree = await collectSourceFiles(root)
    if (!tree.ok) {
      return tree
    }
    const zipped = Promise.withResolvers<Uint8Array>()
    zip(tree.data, { level: 6 }, (error, data) =>
      error ? zipped.reject(error) : zipped.resolve(data)
    )
    archive = await zipped.promise
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, status: null, error: `Could not package workspace source: ${message}` }
  }
  if (archive.byteLength > SOURCE_UPLOAD_MAX_ZIP_BYTES) {
    const mb = (archive.byteLength / 1024 / 1024).toFixed(1)
    return {
      ok: false,
      status: null,
      error: `Workspace source zip is ${mb} MB; SpecFlow accepts at most 20 MB.`
    }
  }
  const imported = await postImport(name, archive)
  return imported.ok ? { ok: true, data: { projectId: imported.data } } : imported
}
