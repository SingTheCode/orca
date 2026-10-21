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

type ErdGenerateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ErdGenerateDialog({
  open,
  onOpenChange,
  onConfirm
}: ErdGenerateDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="compact">
        <DialogHeader>
          <DialogTitle>
            {translate('specflow.erd.generateConfirmTitle', 'Replace the current schema?')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'specflow.erd.generateConfirmBody',
              'AI generation rebuilds every table from the specs and tasks and overwrites the saved schema, including unsaved edits. Table positions are kept where names match.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {translate('specflow.erd.cancel', 'Cancel')}
          </Button>
          <Button size="sm" onClick={onConfirm} autoFocus>
            {translate('specflow.erd.generateConfirm', 'Replace')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
