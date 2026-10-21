import { describe, expect, it } from 'vitest'
import {
  buildGrillPrompt,
  hasNewerSpecVersion,
  latestSpecVersions,
  specHistoryForType,
  type SpecflowSpec
} from './specflow-spec-model'

function spec(type: string, version: number): SpecflowSpec {
  return { id: `${type}-${version}`, type, version, content: '', created_at: '' }
}

describe('latestSpecVersions', () => {
  it('keeps the highest version per known type and ignores unknown types', () => {
    expect(
      latestSpecVersions([spec('PRD', 2), spec('PRD', 3), spec('TRD', 1), spec('ERD', 9)])
    ).toEqual({ PRD: 3, TRD: 1 })
  })
})

describe('hasNewerSpecVersion', () => {
  it('is false when nothing moved past the baseline', () => {
    expect(hasNewerSpecVersion({ PRD: 3, TRD: 3 }, [spec('PRD', 3), spec('TRD', 3)])).toBe(false)
  })

  it('detects a bumped version or a type that did not exist before', () => {
    expect(hasNewerSpecVersion({ PRD: 3 }, [spec('PRD', 4)])).toBe(true)
    expect(hasNewerSpecVersion({}, [spec('QUESTIONS', 1)])).toBe(true)
  })
})

describe('specHistoryForType', () => {
  it('filters one type and sorts newest first', () => {
    const history = [spec('PRD', 1), spec('TRD', 2), spec('PRD', 3), spec('PRD', 2)]
    expect(specHistoryForType(history, 'PRD').map((entry) => entry.version)).toEqual([3, 2, 1])
  })
})

describe('buildGrillPrompt', () => {
  it('starts with the skill command and omits an empty description', () => {
    const prompt = buildGrillPrompt({ name: ' Shop ', description: '  ' })
    expect(prompt.split('\n')[0]).toBe('/skill:grill-me')
    expect(prompt).toContain('Project: Shop')
    expect(prompt).not.toContain('Description:')
    expect(prompt).toContain('submit_grill_decisions')
  })
})
