import {
  ERD_NODE_TYPE,
  erdEdgeId,
  erdTablePosition,
  parseFkTarget,
  type ErdColumn,
  type ErdDocument,
  type ErdNode,
  type ErdPosition,
  type ErdTable
} from './erd-schema'

// All edits are immutable and keep the three mirrors in `content` consistent:
// tables[] (read by the DDL generator), nodes[] (canvas), edges[] (relations).

export function mapTable(
  doc: ErdDocument,
  tableName: string,
  update: (table: ErdTable) => ErdTable
): ErdDocument {
  const current = doc.tables?.find((table) => table.name === tableName)
  if (!current) {
    return doc
  }
  const updated = update(current)
  const tables = (doc.tables ?? []).map((table) => (table === current ? updated : table))
  return syncNode({ ...doc, tables }, tableName, updated)
}

// Why mirror into node.data: the web ERDView renders node.data, not tables[].
function syncNode(doc: ErdDocument, nodeId: string, table: ErdTable): ErdDocument {
  const nodes = doc.nodes ?? []
  const existing = nodes.find((node) => node.id === nodeId)
  const data = {
    ...existing?.data,
    tableName: table.name,
    description: table.description ?? '',
    columns: table.columns ?? []
  }
  if (!existing) {
    const created: ErdNode = {
      id: table.name,
      type: ERD_NODE_TYPE,
      position: erdTablePosition(doc, table.name),
      data
    }
    return { ...doc, nodes: [...nodes, created] }
  }
  return {
    ...doc,
    nodes: nodes.map((node) => (node === existing ? { ...node, id: table.name, data } : node))
  }
}

export function columnsOf(doc: ErdDocument, tableName: string): ErdColumn[] {
  return doc.tables?.find((table) => table.name === tableName)?.columns ?? []
}

/** Clears FK flags on every column whose fk_target matches. */
export function clearFkReferences(
  doc: ErdDocument,
  matches: (target: { table: string; column: string }) => boolean
): ErdDocument {
  let next = doc
  for (const table of doc.tables ?? []) {
    const columns = table.columns ?? []
    const hit = columns.some((column) => {
      const target = column.fk && column.fk_target ? parseFkTarget(column.fk_target) : null
      return target !== null && matches(target)
    })
    if (!hit) {
      continue
    }
    next = mapTable(next, table.name, (current) => ({
      ...current,
      columns: (current.columns ?? []).map((column) => {
        const target = column.fk_target ? parseFkTarget(column.fk_target) : null
        return target && matches(target) ? { ...column, fk: false, fk_target: '' } : column
      })
    }))
  }
  return next
}

/** Rebuilds the outgoing edge of one column from its fk/fk_target. */
export function syncColumnEdge(
  doc: ErdDocument,
  tableName: string,
  columnName: string
): ErdDocument {
  const edges = (doc.edges ?? []).filter(
    (edge) => !(edge.source === tableName && edge.sourceHandle === columnName)
  )
  const column = columnsOf(doc, tableName).find((candidate) => candidate.name === columnName)
  const target = column?.fk && column.fk_target ? parseFkTarget(column.fk_target) : null
  const targetExists =
    target !== null && columnsOf(doc, target.table).some((c) => c.name === target.column)
  if (target && targetExists) {
    const previous = (doc.edges ?? []).find(
      (edge) =>
        edge.source === tableName &&
        edge.sourceHandle === columnName &&
        edge.target === target.table &&
        edge.targetHandle === target.column
    )
    edges.push(
      previous ?? {
        id: erdEdgeId(tableName, columnName, target.table, target.column),
        source: tableName,
        target: target.table,
        sourceHandle: columnName,
        targetHandle: target.column,
        type: 'smoothstep',
        animated: true
      }
    )
  }
  return { ...doc, edges }
}

export function moveTable(doc: ErdDocument, tableName: string, position: ErdPosition): ErdDocument {
  const table = doc.tables?.find((candidate) => candidate.name === tableName)
  // Tables without a stored node get one so the new position persists.
  const withNode =
    table && !doc.nodes?.some((node) => node.id === tableName)
      ? syncNode(doc, tableName, table)
      : doc
  return {
    ...withNode,
    nodes: (withNode.nodes ?? []).map((node) =>
      node.id === tableName ? { ...node, position: { ...node.position, ...position } } : node
    )
  }
}

/** Adds a table with a UUID primary key; returns the document unchanged if the name is taken. */
export function addTable(doc: ErdDocument, name: string, position: ErdPosition): ErdDocument {
  if (doc.tables?.some((table) => table.name === name)) {
    return doc
  }
  const table: ErdTable = {
    name,
    description: '',
    columns: [
      {
        name: 'id',
        type: 'UUID',
        pk: true,
        fk: false,
        nullable: false,
        index: true,
        fk_target: '',
        description: ''
      }
    ]
  }
  const node: ErdNode = {
    id: name,
    type: ERD_NODE_TYPE,
    position,
    data: { tableName: name, description: '', columns: table.columns }
  }
  return {
    ...doc,
    tables: [...(doc.tables ?? []), table],
    nodes: [...(doc.nodes ?? []), node],
    edges: doc.edges ?? []
  }
}

export function renameTable(doc: ErdDocument, oldName: string, newName: string): ErdDocument {
  if (oldName === newName || doc.tables?.some((table) => table.name === newName)) {
    return doc
  }
  let next = mapTable(doc, oldName, (table) => ({ ...table, name: newName }))
  next = {
    ...next,
    tables: (next.tables ?? []).map((table) => ({
      ...table,
      columns: table.columns?.map((column) => {
        const target = column.fk_target ? parseFkTarget(column.fk_target) : null
        return target?.table === oldName
          ? { ...column, fk_target: `${newName}.${target.column}` }
          : column
      })
    })),
    edges: (next.edges ?? []).map((edge) => {
      if (edge.source !== oldName && edge.target !== oldName) {
        return edge
      }
      const source = edge.source === oldName ? newName : edge.source
      const target = edge.target === oldName ? newName : edge.target
      return {
        ...edge,
        id: erdEdgeId(source, edge.sourceHandle ?? '', target, edge.targetHandle ?? ''),
        source,
        target
      }
    })
  }
  // Re-mirror every table so referencing nodes pick up the rewritten fk_target.
  for (const table of next.tables ?? []) {
    next = syncNode(next, table.name, table)
  }
  return next
}

export function updateTableDescription(
  doc: ErdDocument,
  tableName: string,
  description: string
): ErdDocument {
  return mapTable(doc, tableName, (table) => ({ ...table, description }))
}

export function deleteTable(doc: ErdDocument, tableName: string): ErdDocument {
  const next = clearFkReferences(doc, (target) => target.table === tableName)
  return {
    ...next,
    tables: (next.tables ?? []).filter((table) => table.name !== tableName),
    nodes: (next.nodes ?? []).filter((node) => node.id !== tableName),
    edges: (next.edges ?? []).filter(
      (edge) => edge.source !== tableName && edge.target !== tableName
    )
  }
}
