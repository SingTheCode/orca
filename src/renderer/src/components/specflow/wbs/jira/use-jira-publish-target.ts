import { useEffect, useMemo, useState } from 'react'
import type {
  JiraConnectionStatus,
  JiraCreateField,
  JiraIssueType,
  JiraProject,
  JiraSite
} from '../../../../../../shared/jira-types'
import { defaultScopeSource } from '@/lib/default-creation-host'
import {
  jiraListCreateFields,
  jiraListIssueTypes,
  jiraListProjects,
  jiraStatus,
  type RuntimeJiraSettings
} from '@/runtime/runtime-jira-client'
import { useAppStore } from '@/store'

type Loadable<T> = { key: string; value: T } | null

export type JiraPublishTargetState = {
  source: RuntimeJiraSettings
  connection: 'checking' | 'disconnected' | 'connected' | 'error'
  connectionError: string | null
  sites: JiraSite[]
  siteId: string | null
  setSiteId: (siteId: string) => void
  projects: JiraProject[] | null
  projectId: string | null
  setProjectId: (projectId: string) => void
  issueTypes: JiraIssueType[] | null
  issueTypeId: string | null
  setIssueTypeId: (issueTypeId: string) => void
  /** Create-screen fields of the chosen project + issue type; null while loading. */
  createFields: JiraCreateField[] | null
  loadError: string | null
}

function defaultSiteId(status: JiraConnectionStatus): string | null {
  const sites = status.sites ?? []
  const preferred = [status.selectedSiteId, status.activeSiteId].find(
    (id) => id && id !== 'all' && sites.some((site) => site.id === id)
  )
  return preferred ?? sites[0]?.id ?? null
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Site → project → issue type pickers backed by Orca's Jira connection (local or runtime host). */
export function useJiraPublishTarget(enabled: boolean): JiraPublishTargetState {
  const settings = useAppStore((s) => s.settings)
  const source = useMemo(() => defaultScopeSource(settings), [settings])
  const [status, setStatus] = useState<JiraConnectionStatus | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [siteId, setSiteId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [issueTypeId, setIssueTypeId] = useState<string | null>(null)
  // Why: each list remembers the request it answers so a stale reply never shows under a newer pick.
  const [projects, setProjects] = useState<Loadable<JiraProject[]>>(null)
  const [issueTypes, setIssueTypes] = useState<Loadable<JiraIssueType[]>>(null)
  const [createFields, setCreateFields] = useState<Loadable<JiraCreateField[]>>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }
    let cancelled = false
    setStatus(null)
    setConnectionError(null)
    jiraStatus(source)
      .then((next) => {
        if (!cancelled) {
          setStatus(next)
          setSiteId(defaultSiteId(next))
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setConnectionError(errorText(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [enabled, source])

  const connected = status?.connected === true
  const siteKey = siteId ?? ''

  useEffect(() => {
    if (!enabled || !connected) {
      return
    }
    let cancelled = false
    setLoadError(null)
    jiraListProjects(source, siteId)
      .then((value) => {
        if (!cancelled) {
          setProjects({ key: siteKey, value })
          setProjectId((current) =>
            current && value.some((project) => project.id === current) ? current : null
          )
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProjects({ key: siteKey, value: [] })
          setLoadError(errorText(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [enabled, connected, source, siteId, siteKey])

  const projectKey = `${siteKey}/${projectId ?? ''}`
  useEffect(() => {
    if (!enabled || !connected || !projectId) {
      return
    }
    let cancelled = false
    jiraListIssueTypes(source, projectId, siteId)
      .then((value) => {
        if (!cancelled) {
          const usable = value.filter((type) => !type.subtask)
          setIssueTypes({ key: projectKey, value: usable })
          setIssueTypeId((current) =>
            current && usable.some((type) => type.id === current)
              ? current
              : ((usable.find((type) => /^task$/i.test(type.name)) ?? usable[0])?.id ?? null)
          )
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setIssueTypes({ key: projectKey, value: [] })
          setLoadError(errorText(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [enabled, connected, source, siteId, projectId, projectKey])

  const fieldsKey = `${projectKey}/${issueTypeId ?? ''}`
  useEffect(() => {
    if (!enabled || !connected || !projectId || !issueTypeId) {
      return
    }
    let cancelled = false
    jiraListCreateFields(source, projectId, issueTypeId, siteId)
      .then((value) => {
        if (!cancelled) {
          setCreateFields({ key: fieldsKey, value })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCreateFields({ key: fieldsKey, value: [] })
          setLoadError(errorText(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [enabled, connected, source, siteId, projectId, issueTypeId, fieldsKey])

  const currentIssueTypes = projectId && issueTypes?.key === projectKey ? issueTypes.value : null
  return {
    source,
    connection: connectionError
      ? 'error'
      : status === null
        ? 'checking'
        : connected
          ? 'connected'
          : 'disconnected',
    connectionError: connectionError ?? status?.credentialError ?? null,
    sites: status?.sites ?? [],
    siteId,
    setSiteId: (next) => {
      setSiteId(next)
      setProjectId(null)
      setIssueTypeId(null)
    },
    projects: projects?.key === siteKey ? projects.value : null,
    projectId,
    setProjectId: (next) => {
      setProjectId(next)
      setIssueTypeId(null)
    },
    issueTypes: currentIssueTypes,
    issueTypeId: currentIssueTypes ? issueTypeId : null,
    setIssueTypeId,
    createFields: issueTypeId && createFields?.key === fieldsKey ? createFields.value : null,
    loadError
  }
}
