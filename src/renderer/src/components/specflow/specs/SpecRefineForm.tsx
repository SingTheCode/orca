import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'

export function SpecRefineForm(props: {
  refining: boolean
  locked: boolean
  onRefine: (additionalAnswer: string) => Promise<boolean>
}): React.JSX.Element {
  const [answer, setAnswer] = useState('')
  const submit = async (): Promise<void> => {
    if (await props.onRefine(answer.trim())) {
      setAnswer('')
    }
  }

  return (
    <section className="space-y-2 border-t border-border/60 pt-4">
      <div className="space-y-1">
        <Label htmlFor="specflow-refine">
          {translate('specflow.specs.refineTitle', 'Refine with an extra answer')}
        </Label>
        <p className="text-xs text-muted-foreground">
          {translate(
            'specflow.specs.refineDescription',
            'Answer an open question or add a requirement. SpecFlow rewrites PRD, TRD, and QUESTIONS as new versions.'
          )}
        </p>
      </div>
      <Textarea
        id="specflow-refine"
        value={answer}
        disabled={props.refining}
        onChange={(event) => setAnswer(event.target.value)}
        className="min-h-20"
      />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          disabled={props.refining || props.locked || answer.trim().length === 0}
          onClick={() => void submit()}
        >
          {props.refining ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
          {props.refining
            ? translate('specflow.specs.refining', 'Refining…')
            : translate('specflow.specs.refine', 'Refine specs')}
        </Button>
        {props.refining ? (
          <span role="status" className="text-xs text-muted-foreground">
            {translate(
              'specflow.specs.refiningDetail',
              'AI is rewriting the specs. This can take 1–2 minutes.'
            )}
          </span>
        ) : null}
      </div>
    </section>
  )
}
