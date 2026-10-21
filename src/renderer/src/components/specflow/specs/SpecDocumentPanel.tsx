import { useState } from 'react'
import type { Components } from 'react-markdown'
import { LoaderCircle, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownPreviewBody } from '@/components/editor/MarkdownPreviewBody'
import { useDocumentDarkTheme } from '@/hooks/use-document-dark-theme'
import { translate } from '@/i18n/i18n'
import type { SpecflowSpec } from './specflow-spec-model'

// Why: a bare <a> would navigate the app window; spec links always open in the system browser.
const SPEC_MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children, node: _node, ...props }) => (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        event.preventDefault()
        if (href && /^https?:\/\//i.test(href)) {
          void window.api.shell.openUrl(href)
        }
      }}
    >
      {children}
    </a>
  )
}

export function SpecDocumentPanel(props: {
  spec: SpecflowSpec
  saving: boolean
  /** Another long-running request (refine) owns the project's specs right now. */
  locked: boolean
  onSave: (content: string) => Promise<boolean>
}): React.JSX.Element {
  const isDark = useDocumentDarkTheme()
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null
  const dirty = editing && draft !== props.spec.content

  const save = async (): Promise<void> => {
    if (draft === null || !dirty) {
      return
    }
    if (await props.onSave(draft)) {
      setDraft(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline">
          {translate('specflow.specs.version', 'v{{version}}', { version: props.spec.version })}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(props.spec.created_at).toLocaleString()}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {editing ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={props.saving}
                onClick={() => setDraft(null)}
              >
                {translate('specflow.specs.cancel', 'Cancel')}
              </Button>
              <Button
                size="sm"
                disabled={!dirty || props.saving || props.locked}
                onClick={() => void save()}
              >
                {props.saving ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                {props.saving
                  ? translate('specflow.specs.saving', 'Saving…')
                  : translate('specflow.specs.saveNewVersion', 'Save as new version')}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={props.locked}
              onClick={() => setDraft(props.spec.content)}
            >
              <Pencil className="size-3.5" />
              {translate('specflow.specs.edit', 'Edit')}
            </Button>
          )}
        </div>
      </div>
      {props.saving ? (
        <p role="status" className="text-xs text-muted-foreground">
          {translate(
            'specflow.specs.savingDetail',
            'Saving a new version, then SpecFlow refines specs and WBS with AI. This can take 1–2 minutes.'
          )}
        </p>
      ) : null}
      {editing ? (
        <Textarea
          variant="code"
          className="min-h-96 flex-1 resize-none"
          value={draft}
          disabled={props.saving}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={translate('specflow.specs.editorLabel', 'Spec markdown')}
        />
      ) : (
        <div className={isDark ? 'markdown-dark' : 'markdown-light'}>
          <div className="markdown-body">
            <MarkdownPreviewBody
              content={props.spec.content}
              components={SPEC_MARKDOWN_COMPONENTS}
            />
          </div>
        </div>
      )}
    </div>
  )
}
