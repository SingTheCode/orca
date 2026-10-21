import { describe, expect, it } from 'vitest'
import {
  addColumn,
  connectColumns,
  deleteColumn,
  deleteEdge,
  updateColumn
} from './erd-column-edits'
import { addTable, deleteTable, moveTable, renameTable } from './erd-edits'
import { parseErdContent, type ErdDocument } from './erd-schema'

const SERVER_CONTENT = JSON.stringify({
  tables: [
    {
      name: 'users',
      description: 'members',
      columns: [
        {
          name: 'id',
          type: 'UUID',
          pk: true,
          fk: false,
          nullable: false,
          index: true,
          fk_target: '',
          description: 'pk',
          x_extra: 1
        }
      ]
    },
    {
      name: 'polls',
      description: 'rooms',
      columns: [
        { name: 'id', type: 'UUID', pk: true, fk: false, nullable: false, fk_target: '' },
        {
          name: 'owner_id',
          type: 'UUID',
          pk: false,
          fk: true,
          nullable: false,
          fk_target: 'users.id'
        }
      ],
      x_table_extra: { keep: true }
    }
  ],
  nodes: [
    {
      id: 'users',
      type: 'customTableNode',
      position: { x: 50, y: 100 },
      data: { tableName: 'users', description: 'members', columns: [], color: 'x' }
    },
    {
      id: 'polls',
      type: 'customTableNode',
      position: { x: 450, y: 100 },
      data: { tableName: 'polls', description: 'rooms', columns: [] },
      selected: false
    }
  ],
  edges: [
    {
      id: 'e-polls-owner_id-users-id',
      source: 'polls',
      target: 'users',
      sourceHandle: 'owner_id',
      targetHandle: 'id',
      type: 'smoothstep',
      animated: true,
      label: '1:N'
    }
  ],
  version_note: 'top-level unknown'
})

function load(): ErdDocument {
  return parseErdContent(SERVER_CONTENT)
}

describe('erd content round-trip', () => {
  it('serializes server content back without dropping unknown fields', () => {
    expect(JSON.parse(JSON.stringify(load()))).toEqual(JSON.parse(SERVER_CONTENT))
  })

  it('treats empty content as an empty document', () => {
    expect(parseErdContent('{}')).toEqual({})
    expect(parseErdContent('')).toEqual({})
  })
})

describe('erd edits', () => {
  it('adds a column to tables and the node mirror', () => {
    const next = addColumn(load(), 'users', { name: 'email', type: 'VARCHAR(255)', nullable: true })
    expect(next.tables?.[0].columns?.map((c) => c.name)).toEqual(['id', 'email'])
    expect(next.nodes?.[0].data?.columns?.map((c) => c.name)).toEqual(['id', 'email'])
    expect(next.nodes?.[0].data?.color).toBe('x')
    expect(next.tables?.[0].columns?.[0].x_extra).toBe(1)
  })

  it('renames a table and rewrites edges, node id and fk_target', () => {
    const next = renameTable(load(), 'users', 'members')
    expect(next.tables?.map((t) => t.name)).toEqual(['members', 'polls'])
    expect(next.nodes?.[0]).toMatchObject({ id: 'members', data: { tableName: 'members' } })
    expect(next.edges?.[0]).toMatchObject({
      id: 'e-polls-owner_id-members-id',
      target: 'members',
      label: '1:N'
    })
    expect(next.tables?.[1].columns?.[1].fk_target).toBe('members.id')
    expect(next.nodes?.[1].data?.columns?.[1].fk_target).toBe('members.id')
  })

  it('deletes a table with its edges and clears references to it', () => {
    const next = deleteTable(load(), 'users')
    expect(next.tables?.map((t) => t.name)).toEqual(['polls'])
    expect(next.nodes?.map((n) => n.id)).toEqual(['polls'])
    expect(next.edges).toEqual([])
    expect(next.tables?.[0].columns?.[1]).toMatchObject({ fk: false, fk_target: '' })
  })

  it('connects columns as fk + edge and deleteEdge reverts both', () => {
    let doc = addTable(load(), 'votes', { x: 0, y: 0 })
    doc = addColumn(doc, 'votes', { name: 'poll_id', type: 'UUID' })
    doc = connectColumns(doc, 'votes', 'poll_id', 'polls', 'id')
    const column = doc.tables?.find((t) => t.name === 'votes')?.columns?.[1]
    expect(column).toMatchObject({ fk: true, fk_target: 'polls.id' })
    expect(doc.edges?.map((e) => e.id)).toContain('e-votes-poll_id-polls-id')

    doc = deleteEdge(doc, 'e-votes-poll_id-polls-id')
    expect(doc.edges?.map((e) => e.id)).toEqual(['e-polls-owner_id-users-id'])
    expect(doc.tables?.find((t) => t.name === 'votes')?.columns?.[1]).toMatchObject({
      fk: false,
      fk_target: ''
    })
  })

  it('renaming a referenced column follows through to fk_target and edges', () => {
    const doc = load()
    const next = updateColumn(doc, 'users', 0, { name: 'uid', type: 'UUID', pk: true })
    expect(next.tables?.[1].columns?.[1].fk_target).toBe('users.uid')
    expect(next.edges?.map((e) => e.id)).toEqual(['e-polls-owner_id-users-uid'])
  })

  it('deleting a column removes its edges', () => {
    const next = deleteColumn(load(), 'polls', 1)
    expect(next.edges).toEqual([])
    expect(next.nodes?.[1].data?.columns?.map((c) => c.name)).toEqual(['id'])
  })

  it('moves a node without touching tables', () => {
    const doc = load()
    const next = moveTable(doc, 'users', { x: 10, y: 20 })
    expect(next.nodes?.[0].position).toEqual({ x: 10, y: 20 })
    expect(next.tables).toBe(doc.tables)
  })
})
