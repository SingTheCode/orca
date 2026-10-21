import { describe, expect, it } from 'vitest'
import {
  normalizeVerificationReports,
  type SpecflowVerificationReport
} from './verification-report-model'

function report(overrides: Partial<SpecflowVerificationReport>): SpecflowVerificationReport {
  return {
    id: 'r',
    task_id: 't',
    verification_type: 'UNIT',
    status: 'PASS',
    raw_log: '',
    error_summary: null,
    created_at: '2026-10-21T00:00:00Z',
    ...overrides
  }
}

describe('normalizeVerificationReports', () => {
  it('orders newest first and puts unparseable times last', () => {
    const views = normalizeVerificationReports([
      report({ id: 'old', created_at: '2026-10-20T00:00:00Z' }),
      report({ id: 'bad', created_at: 'not a date' }),
      report({ id: 'new', created_at: '2026-10-21T10:00:00.123456+09:00' }),
      report({ id: 'mid', created_at: '2026-10-21T00:00:00Z' })
    ])
    expect(views.map((view) => view.id)).toEqual(['new', 'mid', 'old', 'bad'])
  })

  it('reads summary and commit hash from the MCP JSON text', () => {
    const [view] = normalizeVerificationReports([
      report({
        status: 'FAIL',
        verification_type: 'e2e',
        raw_log: null,
        error_summary: '{"commit_hash":"abc123","summary":"2 specs failed"}'
      })
    ])
    expect(view).toMatchObject({
      type: 'E2E',
      passed: false,
      summary: '2 specs failed',
      commitHash: 'abc123',
      details: [],
      rawLog: ''
    })
  })

  it('keeps other object keys as details and drops empty values', () => {
    const [text, object] = normalizeVerificationReports([
      report({
        id: 'a',
        error_summary: '{"bugs": 0, "coverage": "87.5%", "commit_hash": "", "summary": ""}'
      }),
      report({ id: 'b', created_at: '2026-10-19T00:00:00Z', error_summary: { nested: { x: 1 } } })
    ])
    expect(text).toMatchObject({
      summary: null,
      commitHash: null,
      details: [
        { key: 'bugs', value: '0' },
        { key: 'coverage', value: '87.5%' }
      ]
    })
    expect(object.details).toEqual([{ key: 'nested', value: '{"x":1}' }])
  })

  it('handles array, null, empty, and non-JSON summaries', () => {
    const views = normalizeVerificationReports([
      report({ id: 'array', error_summary: '["a", null, "b"]' }),
      report({ id: 'null', error_summary: null }),
      report({ id: 'empty', error_summary: '{}' }),
      report({ id: 'blank', error_summary: '  ' }),
      report({ id: 'plain', error_summary: 'boom' })
    ])
    const byId = Object.fromEntries(views.map((view) => [view.id, view]))
    expect(byId.array.summary).toBe('a\nb')
    expect(byId.null).toMatchObject({ summary: null, details: [] })
    expect(byId.empty).toMatchObject({ summary: null, details: [] })
    expect(byId.blank.summary).toBeNull()
    expect(byId.plain.summary).toBe('boom')
  })

  it('accepts a null list', () => {
    expect(normalizeVerificationReports(null)).toEqual([])
  })
})
