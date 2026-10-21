import { describe, expect, it } from 'vitest'
import { nextImportStep, parseSnapshotLanguages, sortedKindCounts } from './code-graph-model'

const project = (status: string, progress: number, error = '') => ({
  status,
  import_progress: progress,
  import_stage: 'stage',
  import_error: error
})

describe('nextImportStep', () => {
  it('waits while the zip is still being extracted', () => {
    expect(nextImportStep(project('IMPORTING', 10))).toEqual({
      kind: 'wait',
      progress: 10,
      stage: 'stage'
    })
  })

  it('analyzes once extraction finished, even while spec generation continues or fails', () => {
    expect(nextImportStep(project('IMPORTING', 30))).toEqual({ kind: 'analyze' })
    expect(nextImportStep(project('FAILED', 55, 'llm down'))).toEqual({ kind: 'analyze' })
    expect(nextImportStep(project('READY', 100))).toEqual({ kind: 'analyze' })
  })

  it('fails when extraction itself failed', () => {
    expect(nextImportStep(project('FAILED', 10, 'bad zip'))).toEqual({
      kind: 'failed',
      error: 'bad zip'
    })
  })
})

describe('parseSnapshotLanguages', () => {
  it('reads the JSON string array and tolerates junk', () => {
    expect(parseSnapshotLanguages('["go","typescript"]')).toEqual(['go', 'typescript'])
    expect(parseSnapshotLanguages('')).toEqual([])
    expect(parseSnapshotLanguages('not json')).toEqual([])
    expect(parseSnapshotLanguages('{"go":1}')).toEqual([])
  })
})

describe('sortedKindCounts', () => {
  it('drops zero counts and sorts by count then name', () => {
    expect(sortedKindCounts({ FILE: 3, DIR: 0, METHOD: 3, FUNCTION: 9 })).toEqual([
      ['FUNCTION', 9],
      ['FILE', 3],
      ['METHOD', 3]
    ])
  })
})
