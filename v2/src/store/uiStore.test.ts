import { describe, expect, it } from 'vitest'
import { normalizePageColumnCount } from './uiStore'

describe('uiStore helpers', () => {
  it('normalizes page column counts to Word-like supported values', () => {
    expect(normalizePageColumnCount(1)).toBe(1)
    expect(normalizePageColumnCount(2)).toBe(2)
    expect(normalizePageColumnCount(3)).toBe(3)
    expect(normalizePageColumnCount(4)).toBe(1)
    expect(normalizePageColumnCount('2')).toBe(2)
    expect(normalizePageColumnCount('wide')).toBe(1)
  })
})
