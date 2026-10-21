import { translate } from '@/i18n/i18n'

/** Display label for a status; unknown server values render verbatim. */
export function taskStatusLabel(status: string): string {
  switch (status) {
    case 'TODO':
      return translate('specflow.wbs.status.todo', 'To do')
    case 'IN_PROGRESS':
      return translate('specflow.wbs.status.inProgress', 'In progress')
    case 'TESTING':
      return translate('specflow.wbs.status.testing', 'Testing')
    case 'SONAR_SCAN':
      return translate('specflow.wbs.status.sonarScan', 'Sonar scan')
    case 'DONE':
      return translate('specflow.wbs.status.done', 'Done')
    default:
      return status
  }
}
