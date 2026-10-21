import { Suspense, useEffect, useState } from 'react'
import { LoaderCircle, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { useActiveWorktree, useRepoById } from '@/store/selectors'
import { SPECFLOW_INTEGRATION_SECTION_ID } from '../settings/task-provider-integration-section-ids'
import { specflowRequest } from './specflow-client'
import { SPECFLOW_TABS } from './specflow-tabs'
import type { SpecflowProjectSummary, SpecflowTabId } from './specflow-types'
import { SpecflowProjectBinder } from './SpecflowProjectBinder'
import { useSpecflowConnection } from './use-specflow-connection'

const EMPTY_BINDINGS: Record<string, string> = {}

export default function SpecflowPage(): React.JSX.Element {
  const activeWorktree = useActiveWorktree()
  const activeRepoId = useAppStore((s) => s.activeRepoId)
  const repoId = activeWorktree?.repoId ?? activeRepoId
  const repo = useRepoById(repoId)
  const bindings = useAppStore((s) => s.settings?.specflowProjectByRepo ?? EMPTY_BINDINGS)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const { connection } = useSpecflowConnection()
  const [projects, setProjects] = useState<SpecflowProjectSummary[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SpecflowTabId>('specs')

  const connected = connection.state === 'ready' && connection.status.connected
  const projectId = repoId ? bindings[repoId] : undefined
  const boundProject = projects.find((project) => project.id === projectId)

  useEffect(() => {
    if (!connected) {
      return
    }
    let cancelled = false
    setProjectsLoading(true)
    setProjectsError(null)
    specflowRequest<SpecflowProjectSummary[]>('GET', '/projects')
      .then((list) => {
        if (!cancelled) {
          setProjects(list)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProjectsError(error instanceof Error ? error.message : String(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProjectsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [connected])

  const bindProject = (nextProjectId: string | null): void => {
    if (!repoId) {
      return
    }
    const next = { ...bindings }
    if (nextProjectId) {
      next[repoId] = nextProjectId
    } else {
      delete next[repoId]
    }
    void updateSettings({ specflowProjectByRepo: next })
  }

  const openIntegrationSettings = (): void => {
    openSettingsPage()
    openSettingsTarget({
      pane: 'integrations',
      repoId: null,
      sectionId: SPECFLOW_INTEGRATION_SECTION_ID
    })
  }

  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col bg-background pt-5 text-foreground md:pt-6">
      <header
        className="flex shrink-0 items-center gap-3 px-3 pb-3 md:px-5"
        // Why: no stacked center titlebar on this page; keep the title clear of Windows/Linux window controls.
        style={{ paddingRight: 'max(0.75rem, var(--window-controls-width, 0px))' }}
      >
        <h1 className="truncate text-base font-semibold leading-8">
          {translate('specflow.page.title', 'SpecFlow')}
        </h1>
        {repo && projectId ? (
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">
              {repo.displayName} · {boundProject?.name ?? projectId}
            </span>
            <button
              type="button"
              onClick={() => bindProject(null)}
              aria-label={translate('specflow.page.unlink', 'Unlink project')}
              className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
            >
              <Unlink className="size-3.5" />
            </button>
          </div>
        ) : null}
      </header>

      {connection.state === 'checking' ? (
        <div className="flex flex-1 items-center justify-center">
          <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : !connected ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-muted-foreground">
            {connection.state === 'error'
              ? connection.error
              : translate(
                  'specflow.page.notConnected',
                  'Connect a SpecFlow server to plan specs, WBS, and ERD for this repository.'
                )}
          </p>
          <Button size="sm" onClick={openIntegrationSettings}>
            {translate('specflow.page.openSettings', 'Open SpecFlow settings')}
          </Button>
        </div>
      ) : !repoId || !repo ? (
        <div className="flex flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
          {translate('specflow.page.noRepo', 'Select a repository in the sidebar to use SpecFlow.')}
        </div>
      ) : !projectId ? (
        <>
          {projectsError ? (
            <p className="px-3 text-xs text-destructive md:px-5">{projectsError}</p>
          ) : null}
          <SpecflowProjectBinder
            repoName={repo.displayName}
            projects={projects}
            loading={projectsLoading}
            onBind={bindProject}
            onCreated={(project) => {
              setProjects((current) => [project, ...current])
              bindProject(project.id)
            }}
          />
        </>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const tab = SPECFLOW_TABS.find((candidate) => candidate.id === value)
            if (tab) {
              setActiveTab(tab.id)
            }
          }}
          className="mx-3 flex min-h-0 flex-1 flex-col md:mx-5"
        >
          <TabsList variant="line">
            {SPECFLOW_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SPECFLOW_TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="min-h-0">
              <div className="scrollbar-sleek h-full overflow-auto">
                <Suspense
                  fallback={
                    <LoaderCircle className="m-4 size-4 animate-spin text-muted-foreground" />
                  }
                >
                  <tab.component
                    projectId={projectId}
                    repoId={repoId}
                    workspacePath={
                      activeWorktree?.repoId === repoId ? activeWorktree.path : repo.path
                    }
                    worktreeId={activeWorktree?.repoId === repoId ? activeWorktree.id : null}
                  />
                </Suspense>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </main>
  )
}
