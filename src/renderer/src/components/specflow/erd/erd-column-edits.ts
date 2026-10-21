import { clearFkReferences, columnsOf, mapTable, syncColumnEdge } from './erd-edits'
import { erdEdgeId, type ErdColumn, type ErdDocument } from './erd-schema'

export function addColumn(doc: ErdDocument, tableName: string, column: ErdColumn): ErdDocument {
  const next = mapTable(doc, tableName, (table) => ({
    ...table,
    columns: [...(table.columns ?? []), column]
  }))
  return syncColumnEdge(next, tableName, column.name)
}

/** Replaces the column at `index`, renaming relations and FK references when the name changes. */
export function updateColumn(
  doc: ErdDocument,
  tableName: string,
  index: number,
  column: ErdColumn
): ErdDocument {
  const previous = columnsOf(doc, tableName)[index]
  if (!previous) {
    return doc
  }
  let next = mapTable(doc, tableName, (table) => ({
    ...table,
    columns: (table.columns ?? []).map((current, i) => (i === index ? column : current))
  }))
  if (previous.name !== column.name) {
    const oldRef = `${tableName}.${previous.name}`
    for (const table of next.tables ?? []) {
      if (!table.columns?.some((c) => c.fk_target === oldRef)) {
        continue
      }
      next = mapTable(next, table.name, (current) => ({
        ...current,
        columns: current.columns?.map((c) =>
          c.fk_target === oldRef ? { ...c, fk_target: `${tableName}.${column.name}` } : c
        )
      }))
    }
    next = {
      ...next,
      edges: (next.edges ?? []).flatMap((edge) => {
        if (edge.source === tableName && edge.sourceHandle === previous.name) {
          return []
        }
        if (edge.target === tableName && edge.targetHandle === previous.name) {
          const source = edge.sourceHandle ?? ''
          return [
            {
              ...edge,
              id: erdEdgeId(edge.source, source, tableName, column.name),
              targetHandle: column.name
            }
          ]
        }
        return [edge]
      })
    }
  }
  return syncColumnEdge(next, tableName, column.name)
}

export function deleteColumn(doc: ErdDocument, tableName: string, index: number): ErdDocument {
  const removed = columnsOf(doc, tableName)[index]
  if (!removed) {
    return doc
  }
  let next = mapTable(doc, tableName, (table) => ({
    ...table,
    columns: (table.columns ?? []).filter((_, i) => i !== index)
  }))
  next = clearFkReferences(
    next,
    (target) => target.table === tableName && target.column === removed.name
  )
  return {
    ...next,
    edges: (next.edges ?? []).filter(
      (edge) =>
        !(edge.source === tableName && edge.sourceHandle === removed.name) &&
        !(edge.target === tableName && edge.targetHandle === removed.name)
    )
  }
}

/** Marks `source.sourceColumn` as FK to `target.targetColumn` and draws the edge. */
export function connectColumns(
  doc: ErdDocument,
  source: string,
  sourceColumn: string,
  target: string,
  targetColumn: string
): ErdDocument {
  const index = columnsOf(doc, source).findIndex((column) => column.name === sourceColumn)
  const column = columnsOf(doc, source)[index]
  if (!column || (source === target && sourceColumn === targetColumn)) {
    return doc
  }
  return updateColumn(doc, source, index, {
    ...column,
    fk: true,
    fk_target: `${target}.${targetColumn}`
  })
}

/** Removes an edge and the FK flag it represents on the source column. */
export function deleteEdge(doc: ErdDocument, edgeId: string): ErdDocument {
  const edge = doc.edges?.find((candidate) => candidate.id === edgeId)
  if (!edge) {
    return doc
  }
  const ref = `${edge.target}.${edge.targetHandle ?? ''}`
  const withoutEdge = {
    ...doc,
    edges: (doc.edges ?? []).filter((candidate) => candidate.id !== edgeId)
  }
  return mapTable(withoutEdge, edge.source, (table) => ({
    ...table,
    columns: table.columns?.map((column) =>
      column.name === edge.sourceHandle && column.fk_target === ref
        ? { ...column, fk: false, fk_target: '' }
        : column
    )
  }))
}
