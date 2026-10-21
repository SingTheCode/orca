import { useState } from 'react'
import { Input } from '@/components/ui/input'

type ErdCommitInputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  onCommit: (value: string) => void
}

// Why commit on blur/Enter: renames rewrite edges and FK targets, so intermediate keystrokes
// must not each become a rename (and must not collide with existing names mid-typing).
export function ErdCommitInput({
  value,
  onCommit,
  ...props
}: ErdCommitInputProps): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const [source, setSource] = useState(value)
  if (source !== value) {
    setSource(value)
    setDraft(value)
  }
  const commit = (): void => {
    const next = draft.trim()
    if (next !== value) {
      onCommit(next)
    }
  }
  return (
    <Input
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit()
        } else if (event.key === 'Escape') {
          setDraft(value)
        }
      }}
    />
  )
}
