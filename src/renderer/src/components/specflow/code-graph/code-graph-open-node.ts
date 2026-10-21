import { detectLanguage } from '@/lib/language-detect'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { scheduleEditorLineReveal } from '@/store/slices/editor/focus/editor-focus-reveal'
import { resolveAnnotationPathInsideWorktree } from '../../editor/check-annotation-path'
import type { CodeGraphNode } from './code-graph-model'

/** Opens a graph node's file in the worktree editor and reveals its start line. */
export function openCodeGraphNodeInEditor(
  node: CodeGraphNode,
  worktreeId: string,
  workspacePath: string
): boolean {
  // Why: reuse the annotation resolver so server paths can never escape the worktree.
  const resolved = resolveAnnotationPathInsideWorktree(workspacePath, node.path)
  if (!resolved) {
    return false
  }
  activateAndRevealWorktree(worktreeId, { providesInitialSurface: true })
  const store = useAppStore.getState()
  const fileId = store.openFile(
    {
      filePath: resolved.absolutePath,
      relativePath: resolved.relativePath,
      worktreeId,
      language: detectLanguage(resolved.relativePath),
      mode: 'edit'
    },
    { focusEditor: true }
  )
  if (node.start_line > 0) {
    scheduleEditorLineReveal(
      useAppStore.getState,
      resolved.absolutePath,
      node.start_line,
      1,
      fileId
    )
  }
  return true
}
