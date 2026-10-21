import { Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { ErdCommitInput } from './ErdCommitInput'
import type { ErdColumn, ErdDocument, ErdTable } from './erd-schema'

const NO_FK = '__none__'

type ErdTablePanelProps = {
  doc: ErdDocument
  table: ErdTable
  onClose: () => void
  onRename: (name: string) => void
  onDescription: (description: string) => void
  onDeleteTable: () => void
  onAddColumn: () => void
  onUpdateColumn: (index: number, column: ErdColumn) => void
  onDeleteColumn: (index: number) => void
}

export function ErdTablePanel({
  doc,
  table,
  onClose,
  onRename,
  onDescription,
  onDeleteTable,
  onAddColumn,
  onUpdateColumn,
  onDeleteColumn
}: ErdTablePanelProps): React.JSX.Element {
  const columns = table.columns ?? []
  const fkTargets = (doc.tables ?? []).flatMap((candidate) =>
    (candidate.columns ?? []).map((column) => `${candidate.name}.${column.name}`)
  )

  return (
    <aside className="scrollbar-sleek flex w-96 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {translate('specflow.erd.editTable', 'Edit table')}
        </h2>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label={translate('specflow.erd.closePanel', 'Close')}
        >
          <X />
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="specflow-erd-table-name">
          {translate('specflow.erd.tableName', 'Table name')}
        </Label>
        <ErdCommitInput
          id="specflow-erd-table-name"
          value={table.name}
          onCommit={(name) => {
            if (name && !doc.tables?.some((candidate) => candidate.name === name)) {
              onRename(name)
            }
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="specflow-erd-table-description">
          {translate('specflow.erd.description', 'Description')}
        </Label>
        <ErdCommitInput
          id="specflow-erd-table-description"
          value={table.description ?? ''}
          onCommit={onDescription}
        />
      </div>

      <div className="space-y-2">
        <div className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
          {translate('specflow.erd.columns', 'Columns')}
        </div>
        {columns.map((column, index) => (
          <div key={column.name} className="space-y-2 rounded-md border border-border p-2">
            <div className="flex items-center gap-2">
              <ErdCommitInput
                className="h-8"
                aria-label={translate('specflow.erd.columnName', 'Column name')}
                value={column.name}
                onCommit={(name) => {
                  if (name && !columns.some((other) => other.name === name)) {
                    onUpdateColumn(index, { ...column, name })
                  }
                }}
              />
              <ErdCommitInput
                className="h-8 w-36"
                aria-label={translate('specflow.erd.columnType', 'Type')}
                value={column.type ?? ''}
                onCommit={(type) => onUpdateColumn(index, { ...column, type })}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onDeleteColumn(index)}
                aria-label={translate('specflow.erd.deleteColumn', 'Delete column')}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {(
                [
                  ['pk', translate('specflow.erd.flagPk', 'PK')],
                  ['nullable', translate('specflow.erd.flagNullable', 'Nullable')],
                  ['index', translate('specflow.erd.flagIndex', 'Index')]
                ] as const
              ).map(([flag, label]) => (
                <label key={flag} className="flex items-center gap-1.5">
                  <Checkbox
                    checked={column[flag] === true}
                    onCheckedChange={(checked) =>
                      onUpdateColumn(index, { ...column, [flag]: checked === true })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <Select
              value={column.fk && column.fk_target ? column.fk_target : NO_FK}
              onValueChange={(value) =>
                onUpdateColumn(
                  index,
                  value === NO_FK
                    ? { ...column, fk: false, fk_target: '' }
                    : { ...column, fk: true, fk_target: value }
                )
              }
            >
              <SelectTrigger
                size="sm"
                className="w-full"
                aria-label={translate('specflow.erd.references', 'References')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FK}>
                  {translate('specflow.erd.noReference', 'No foreign key')}
                </SelectItem>
                {fkTargets
                  .filter((target) => target !== `${table.name}.${column.name}`)
                  .map((target) => (
                    <SelectItem key={target} value={target}>
                      {target}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={onAddColumn}>
          <Plus />
          {translate('specflow.erd.addColumn', 'Add column')}
        </Button>
      </div>

      <div className="mt-auto border-t border-border pt-4">
        <Button variant="destructive" size="sm" onClick={onDeleteTable}>
          <Trash2 />
          {translate('specflow.erd.deleteTable', 'Delete table')}
        </Button>
      </div>
    </aside>
  )
}
