import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import { taskStatusLabel } from './specflow-task-labels'
import { taskDatePart, type TaskGroup, type TaskGroupBy } from './specflow-task-model'
import type { SpecflowTask } from './specflow-task-types'

function TaskRow(props: {
  task: SpecflowTask
  titleById: ReadonlyMap<string, string>
  onOpen: (taskId: string) => void
}): React.JSX.Element {
  const { task } = props
  const dependencyTitles = (task.dependencies ?? []).map(
    (id) => props.titleById.get(id) ?? translate('specflow.wbs.unknownDependency', 'Removed task')
  )
  const start = taskDatePart(task.start_date)
  const end = taskDatePart(task.end_date)
  return (
    <li>
      <button
        type="button"
        onClick={() => props.onOpen(task.id)}
        className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_7rem_11rem] items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Badge variant="outline">{task.priority}</Badge>
        <span className="min-w-0 space-y-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm">{task.title}</span>
            {task.jira_ticket_key ? (
              <Badge variant="secondary">{task.jira_ticket_key}</Badge>
            ) : null}
          </span>
          {dependencyTitles.length > 0 ? (
            <span className="block truncate text-xs text-muted-foreground">
              {translate('specflow.wbs.dependsOn', 'Depends on: {{titles}}', {
                titles: dependencyTitles.join(', ')
              })}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">{taskStatusLabel(task.status)}</span>
        <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
          {start || end ? `${start || '—'} → ${end || '—'}` : '—'}
        </span>
      </button>
    </li>
  )
}

export function WbsTaskList(props: {
  groups: readonly TaskGroup[]
  groupBy: TaskGroupBy
  titleById: ReadonlyMap<string, string>
  onOpen: (taskId: string) => void
}): React.JSX.Element {
  return (
    <div className="space-y-5">
      {props.groups.map((group) => (
        <section key={group.key} className="space-y-1">
          <h3 className="px-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
            {props.groupBy === 'priority' ? group.key : taskStatusLabel(group.key)} ·{' '}
            {group.tasks.length}
          </h3>
          <ul className="divide-y divide-border">
            {group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                titleById={props.titleById}
                onOpen={props.onOpen}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
