import { translate } from '@/i18n/i18n'
import { RunTaskWithOmpButton } from '../agent/RunTaskWithOmpButton'
import { TaskVerificationReports } from '../agent/TaskVerificationReports'
import type { SpecflowTask } from '../specflow-task-types'

export type TaskReportsSlotProps = { projectId: string; task: SpecflowTask }

export function TaskReportsSlot(props: TaskReportsSlotProps): React.JSX.Element {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          {translate('specflow.agent.reports.title', 'Verification')}
        </h3>
        <RunTaskWithOmpButton projectId={props.projectId} taskId={props.task.id} />
      </div>
      <TaskVerificationReports task={props.task} />
    </section>
  )
}
