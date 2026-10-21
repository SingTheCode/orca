import { describe, expect, it } from 'vitest'
import { isUploadableSourcePath } from './specflow-source-upload'

describe('isUploadableSourcePath', () => {
  it('keeps ordinary source paths', () => {
    expect(isUploadableSourcePath('main.go')).toBe(true)
    expect(isUploadableSourcePath('src/app/index.ts')).toBe(true)
    expect(isUploadableSourcePath('src\\app\\index.ts')).toBe(true)
    expect(isUploadableSourcePath('docs/builder.md')).toBe(true)
  })

  it('drops excluded build and dependency directories at any depth', () => {
    for (const dir of ['node_modules', 'dist', 'out', 'build', '.next', 'coverage']) {
      expect(isUploadableSourcePath(`${dir}/x.js`)).toBe(false)
      expect(isUploadableSourcePath(`packages/web/${dir}/x.js`)).toBe(false)
    }
  })

  it('drops hidden segments and traversal', () => {
    expect(isUploadableSourcePath('.git/config')).toBe(false)
    expect(isUploadableSourcePath('.env')).toBe(false)
    expect(isUploadableSourcePath('src/.cache/a.ts')).toBe(false)
    expect(isUploadableSourcePath('../outside.ts')).toBe(false)
    expect(isUploadableSourcePath('')).toBe(false)
  })

  it('matches whole segments only', () => {
    expect(isUploadableSourcePath('src/outbox/a.ts')).toBe(true)
    expect(isUploadableSourcePath('src/distance.ts')).toBe(true)
  })
})
