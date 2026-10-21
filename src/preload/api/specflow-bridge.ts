import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const specflowApi = {
  status: () => ipcRenderer.invoke('specflow:status'),
  connect: (args) => ipcRenderer.invoke('specflow:connect', args),
  disconnect: () => ipcRenderer.invoke('specflow:disconnect'),
  request: (args) => ipcRenderer.invoke('specflow:request', args),
  subscribeTaskEvents: (args) => ipcRenderer.invoke('specflow:subscribeTaskEvents', args),
  unsubscribeTaskEvents: (args) => ipcRenderer.invoke('specflow:unsubscribeTaskEvents', args),
  // Main does not emit task events yet; the SSE implementation replaces this.
  onTaskEvent: () => () => {},
  uploadWorkspaceSource: (args) => ipcRenderer.invoke('specflow:uploadWorkspaceSource', args),
  ensureMcpKey: (args) => ipcRenderer.invoke('specflow:ensureMcpKey', args)
} satisfies PreloadApi['specflow']
