import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { specflowRequest } from './specflow-client'
import type { SpecflowProjectSummary } from './specflow-types'

type CreateProjectResponse = { project: SpecflowProjectSummary }

export function SpecflowProjectBinder(props: {
  repoName: string
  projects: readonly SpecflowProjectSummary[]
  loading: boolean
  onBind: (projectId: string) => void
  onCreated: (project: SpecflowProjectSummary) => void
}): React.JSX.Element {
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState(props.repoName)
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async (): Promise<void> => {
    setCreating(true)
    setError(null)
    try {
      const created = await specflowRequest<CreateProjectResponse>('POST', '/projects', {
        name: name.trim(),
        description: description.trim()
      })
      props.onCreated(created.project)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-3 py-6 md:px-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">
          {translate('specflow.page.bindTitle', 'Link {{repo}} to a SpecFlow project', {
            repo: props.repoName
          })}
        </h2>
        <p className="text-xs text-muted-foreground">
          {translate(
            'specflow.page.bindDescription',
            'Specs, WBS, ERD, and code graph for this repository are stored in the linked project.'
          )}
        </p>
      </div>

      <section className="space-y-2">
        <Label>{translate('specflow.page.existingProject', 'Existing project')}</Label>
        <div className="flex items-center gap-2">
          <Select value={selectedId} onValueChange={setSelectedId} disabled={props.loading}>
            <SelectTrigger className="flex-1">
              <SelectValue
                placeholder={
                  props.loading
                    ? translate('specflow.page.loadingProjects', 'Loading projects…')
                    : props.projects.length === 0
                      ? translate('specflow.page.noProjects', 'No projects yet')
                      : translate('specflow.page.chooseProject', 'Choose a project')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {props.projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!selectedId} onClick={() => props.onBind(selectedId)}>
            {translate('specflow.page.link', 'Link')}
          </Button>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-4">
        <Label>{translate('specflow.page.newProject', 'New project')}</Label>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={translate('specflow.page.projectName', 'Project name')}
        />
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={translate('specflow.page.projectDescription', 'Description (optional)')}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button
          size="sm"
          variant="outline"
          disabled={creating || name.trim().length === 0}
          onClick={() => void create()}
        >
          {creating ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : null}
          {translate('specflow.page.createAndLink', 'Create and link')}
        </Button>
      </section>
    </div>
  )
}
