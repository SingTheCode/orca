import type {
  SpecflowConnectArgs,
  SpecflowMcpExtension,
  SpecflowRequestArgs,
  SpecflowResult,
  SpecflowStatus,
  SpecflowTaskEvent,
  SpecflowUploadWorkspaceSourceArgs,
  SpecflowUser
} from '../../shared/specflow-types'

export type SpecflowApi = {
  status: () => Promise<SpecflowResult<SpecflowStatus>>
  connect: (args: SpecflowConnectArgs) => Promise<SpecflowResult<{ user: SpecflowUser }>>
  disconnect: () => Promise<SpecflowResult<null>>
  request: <T>(args: SpecflowRequestArgs) => Promise<SpecflowResult<T>>
  subscribeTaskEvents: (args: {
    projectId: string
  }) => Promise<SpecflowResult<{ subscriptionId: string }>>
  unsubscribeTaskEvents: (args: { subscriptionId: string }) => Promise<SpecflowResult<null>>
  onTaskEvent: (callback: (event: SpecflowTaskEvent) => void) => () => void
  uploadWorkspaceSource: (
    args: SpecflowUploadWorkspaceSourceArgs
  ) => Promise<SpecflowResult<{ projectId: string }>>
  ensureMcpKey: (args: { projectId: string }) => Promise<SpecflowResult<SpecflowMcpExtension>>
}
