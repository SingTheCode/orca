import { z } from 'zod'

// Why loose objects + optional fields: the server content is LLM-generated JSON that the
// web ERDView also writes; unknown keys and absent fields must survive a save untouched.
const columnSchema = z.looseObject({
  name: z.string(),
  type: z.string().optional(),
  pk: z.boolean().optional(),
  fk: z.boolean().optional(),
  nullable: z.boolean().optional(),
  index: z.boolean().optional(),
  // DDL generator reads `fk` + `fk_target` ("table.column") from tables[].columns[].
  fk_target: z.string().optional(),
  description: z.string().optional()
})

const tableSchema = z.looseObject({
  name: z.string(),
  description: z.string().optional(),
  columns: z.array(columnSchema).optional()
})

const nodeSchema = z.looseObject({
  id: z.string(),
  type: z.string().optional(),
  position: z.looseObject({ x: z.number(), y: z.number() }).optional(),
  data: z
    .looseObject({
      tableName: z.string().optional(),
      description: z.string().optional(),
      columns: z.array(columnSchema).optional()
    })
    .optional()
})

const edgeSchema = z.looseObject({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  type: z.string().optional(),
  animated: z.boolean().optional(),
  label: z.string().optional()
})

const documentSchema = z.looseObject({
  tables: z.array(tableSchema).optional(),
  nodes: z.array(nodeSchema).optional(),
  edges: z.array(edgeSchema).optional()
})

export type ErdColumn = z.infer<typeof columnSchema>
export type ErdTable = z.infer<typeof tableSchema>
export type ErdNode = z.infer<typeof nodeSchema>
export type ErdEdge = z.infer<typeof edgeSchema>
export type ErdDocument = z.infer<typeof documentSchema>
export type ErdPosition = { x: number; y: number }

export const ERD_NODE_TYPE = 'customTableNode'

/** Parses `SchemaDesign.content`; empty content (`""` or `"{}"`) yields an empty document. */
export function parseErdContent(content: string): ErdDocument {
  if (content.trim() === '') {
    return {}
  }
  return documentSchema.parse(JSON.parse(content))
}

/** Edge ids follow the generator prompt's `e-{source}-{sourceCol}-{target}-{targetCol}` form. */
export function erdEdgeId(
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string
): string {
  return `e-${source}-${sourceHandle}-${target}-${targetHandle}`
}

/** Splits "table.column" the way the DDL generator does (last dot). */
export function parseFkTarget(target: string): { table: string; column: string } | null {
  const trimmed = target.trim()
  const idx = trimmed.lastIndexOf('.')
  if (idx <= 0 || idx === trimmed.length - 1) {
    return null
  }
  return { table: trimmed.slice(0, idx), column: trimmed.slice(idx + 1) }
}

const FALLBACK_COLUMNS = 3
const FALLBACK_SPACING_X = 400
const FALLBACK_SPACING_Y = 420

/** Stored node position for a table, or a grid slot when the content has no node for it. */
export function erdTablePosition(doc: ErdDocument, tableName: string): ErdPosition {
  const node = doc.nodes?.find((candidate) => candidate.id === tableName)
  if (node?.position) {
    return { x: node.position.x, y: node.position.y }
  }
  const found = doc.tables?.findIndex((table) => table.name === tableName) ?? -1
  // Unknown names (a table about to be added) take the next free slot.
  const index = found >= 0 ? found : (doc.tables?.length ?? 0)
  return {
    x: 50 + (index % FALLBACK_COLUMNS) * FALLBACK_SPACING_X,
    y: 100 + Math.floor(index / FALLBACK_COLUMNS) * FALLBACK_SPACING_Y
  }
}

/** `base`, or `base_2`, `base_3`, … — the first not in `taken`. */
export function uniqueErdName(base: string, taken: readonly string[]): string {
  let candidate = base
  for (let suffix = 2; taken.includes(candidate); suffix += 1) {
    candidate = `${base}_${suffix}`
  }
  return candidate
}
