import { createContext, useCallback, useContext, useState } from 'react'
import { CloudUpload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { SpecflowTask } from '../specflow-task-types'
import { JiraPublishDialog } from './JiraPublishDialog'

type OpenJiraPublish = (preselectedTaskIds?: readonly string[]) => void

const JiraPublishContext = createContext<OpenJiraPublish | null>(null)

/** Hosts the bulk publish dialog for a WBS so the toolbar and the task sheet open the same one. */
export function JiraPublishProvider(props: {
  tasks: readonly SpecflowTask[]
  children: React.ReactNode
}): React.JSX.Element {
  // `undefined` preselection = every unlinked task; null = closed.
  const [request, setRequest] = useState<{ preselected?: readonly string[] } | null>(null)
  const open = useCallback<OpenJiraPublish>((preselected) => setRequest({ preselected }), [])
  return (
    <JiraPublishContext.Provider value={open}>
      {props.children}
      <JiraPublishDialog
        open={request !== null}
        tasks={props.tasks}
        preselectedTaskIds={request?.preselected}
        onOpenChange={(open) => !open && setRequest(null)}
      />
    </JiraPublishContext.Provider>
  )
}

export function useOpenJiraPublish(): OpenJiraPublish | null {
  return useContext(JiraPublishContext)
}

export function JiraPublishButton(props: { disabled: boolean }): React.JSX.Element {
  const open = useOpenJiraPublish()
  return (
    <Button variant="outline" size="sm" disabled={props.disabled || !open} onClick={() => open?.()}>
      <CloudUpload />
      {translate('specflow.jira.publishToJira', 'Publish to Jira')}
    </Button>
  )
}
