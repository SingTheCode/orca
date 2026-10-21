import { translate } from '@/i18n/i18n'
import type { SpecflowTabProps } from '../specflow-types'

// Placeholder until the WBS feature replaces this directory.
export default function WbsTab(_props: SpecflowTabProps): React.JSX.Element {
  return (
    <div className="p-4 text-sm text-muted-foreground">
      {translate('specflow.page.tabPlaceholder', '{{tab}} is not available yet.', {
        tab: 'WBS'
      })}
    </div>
  )
}
