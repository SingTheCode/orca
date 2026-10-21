import { useEffect, useState } from 'react'
import { ChevronsUpDown, LoaderCircle, X } from 'lucide-react'
import type { JiraIssue } from '../../../../../../shared/jira-types'
import { JIRA_ISSUE_KEY_PATTERN } from '../../../../../../shared/jira-issue-url'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { translate } from '@/i18n/i18n'
import { jiraSearchIssues, type RuntimeJiraSettings } from '@/runtime/runtime-jira-client'
import { buildEpicSearchJql } from './jira-publish-payload'

const SEARCH_DEBOUNCE_MS = 250

export type JiraEpicChoice = { key: string; title: string | null }

export function JiraEpicPicker(props: {
  source: RuntimeJiraSettings
  siteId: string | null
  projectKey: string
  value: JiraEpicChoice | null
  disabled: boolean
  onChange: (value: JiraEpicChoice | null) => void
}): React.JSX.Element {
  const { source, siteId, projectKey } = props
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ jql: string; issues: JiraIssue[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const jql = buildEpicSearchJql(projectKey, query)

  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      jiraSearchIssues(source, jql, 20, siteId)
        .then((issues) => {
          if (!cancelled) {
            setResults({ jql, issues })
            setError(null)
          }
        })
        .catch((searchError: unknown) => {
          if (!cancelled) {
            setResults({ jql, issues: [] })
            setError(searchError instanceof Error ? searchError.message : String(searchError))
          }
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, source, siteId, jql])

  const typedKey = query.trim().toUpperCase()
  const issues = results?.jql === jql ? results.issues : null
  const offerTypedKey =
    JIRA_ISSUE_KEY_PATTERN.test(typedKey) && !issues?.some((issue) => issue.key === typedKey)
  const choose = (choice: JiraEpicChoice): void => {
    props.onChange(choice)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={props.disabled}
            size="sm"
            className="min-w-0 flex-1 justify-between"
          >
            <span className="truncate">
              {props.value
                ? props.value.title
                  ? `${props.value.key} · ${props.value.title}`
                  : props.value.key
                : translate('specflow.jira.noEpic', 'No epic')}
            </span>
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(360px,calc(100vw-1rem))] min-w-[var(--radix-popover-trigger-width)]"
        >
          <Command shouldFilter={false} density="menu">
            <CommandInput
              autoFocus
              placeholder={translate('specflow.jira.searchEpics', 'Search epics or type a key…')}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {issues === null ? (
                <div className="flex justify-center py-4">
                  <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <CommandEmpty>
                  {error ?? translate('specflow.jira.noEpicsFound', 'No epics found.')}
                </CommandEmpty>
              )}
              {offerTypedKey ? (
                <CommandItem
                  value={`typed-${typedKey}`}
                  onSelect={() => choose({ key: typedKey, title: null })}
                >
                  {translate('specflow.jira.useEpicKey', 'Use {{key}}', { key: typedKey })}
                </CommandItem>
              ) : null}
              {(issues ?? []).map((issue) => (
                <CommandItem
                  key={issue.key}
                  value={issue.key}
                  onSelect={() => choose({ key: issue.key, title: issue.title })}
                >
                  <span className="font-mono text-muted-foreground">{issue.key}</span>
                  <span className="truncate">{issue.title}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {props.value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={props.disabled}
          aria-label={translate('specflow.jira.clearEpic', 'Clear epic')}
          onClick={() => props.onChange(null)}
        >
          <X />
        </Button>
      ) : null}
    </div>
  )
}
