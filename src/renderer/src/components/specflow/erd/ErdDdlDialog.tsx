import { useEffect, useState } from 'react'
import { Copy, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { specflowRequest } from '../specflow-client'
import type { ErdNamingViolation } from './use-erd-schema'
import { ErdNamingViolations } from './ErdNamingViolations'

type DdlResponse = { ddl: string; naming_violations?: ErdNamingViolation[] | null }

type ErdDdlDialogProps = {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ErdDdlDialog({
  projectId,
  open,
  onOpenChange
}: ErdDdlDialogProps): React.JSX.Element {
  const [result, setResult] = useState<DdlResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    setResult(null)
    setError(null)
    specflowRequest<DdlResponse>('GET', `/projects/${encodeURIComponent(projectId)}/schemas/ddl`)
      .then((response) => {
        if (!cancelled) {
          setResult(response)
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : String(requestError))
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, projectId])

  const copy = async (): Promise<void> => {
    if (!result) {
      return
    }
    await window.api.ui.writeClipboardText(result.ddl)
    toast.success(translate('specflow.erd.ddlCopied', 'DDL copied'))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{translate('specflow.erd.ddlTitle', 'PostgreSQL DDL')}</DialogTitle>
          <DialogDescription>
            {translate('specflow.erd.ddlDescription', 'Generated from the saved schema.')}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !result ? (
          <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <ErdNamingViolations violations={result.naming_violations ?? []} />
            <pre className="scrollbar-sleek max-h-[60vh] overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs whitespace-pre select-text">
              {result.ddl}
            </pre>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" disabled={!result} onClick={() => void copy()}>
            <Copy />
            {translate('specflow.erd.copyDdl', 'Copy')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
