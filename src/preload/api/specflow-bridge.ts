import { ipcRenderer } from 'electron'
import type { SpecflowTaskEvent } from '../../shared/specflow-types'
import type { PreloadApi } from '../api-types'

export const specflowApi = {
  status: () => ipcRenderer.invoke('specflow:status'),
  connect: (args) => ipcRenderer.invoke('specflow:connect', args),
  disconnect: () => ipcRenderer.invoke('specflow:disconnect'),
  request: (args) => ipcRenderer.invoke('specflow:request', args),
  subscribeTaskEvents: (args) => ipcRenderer.invoke('specflow:subscribeTaskEvents', args),
  unsubscribeTaskEvents: (args) => ipcRenderer.invoke('specflow:unsubscribeTaskEvents', args),
  onTaskEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: SpecflowTaskEvent) =>
      callback(payload)
    ipcRenderer.on('specflow:taskEvent', listener)
    return () => ipcRenderer.removeListener('specflow:taskEvent', listener)
  },
  uploadWorkspaceSource: (args) => ipcRenderer.invoke('specflow:uploadWorkspaceSource', args),
  ensureMcpKey: (args) => ipcRenderer.invoke('specflow:ensureMcpKey', args)
} satisfies PreloadApi['specflow']
