import { describe, expect, it } from 'vitest'
import { formatRunningText, normalizePageColumnCount, normalizePageMarginsMm, pageMarginsCss, pageMarginsSummary } from './uiStore'

describe('uiStore helpers', () => {
  it('normalizes page column counts to Word-like supported values', () => {
    expect(normalizePageColumnCount(1)).toBe(1)
    expect(normalizePageColumnCount(2)).toBe(2)
    expect(normalizePageColumnCount(3)).toBe(3)
    expect(normalizePageColumnCount(4)).toBe(1)
    expect(normalizePageColumnCount('2')).toBe(2)
    expect(normalizePageColumnCount('wide')).toBe(1)
  })

  it('normalizes and summarizes individual page margins', () => {
    expect(normalizePageMarginsMm({ top: 12, right: 16, bottom: 20, left: 24 })).toEqual({
      top: 12,
      right: 16,
      bottom: 20,
      left: 24,
    })
    expect(normalizePageMarginsMm({ top: 2, right: 100, bottom: 'bad', left: 19 })).toEqual({
      top: 8,
      right: 60,
      bottom: 20,
      left: 19,
    })
    expect(pageMarginsCss({ top: 10, right: 12, bottom: 14, left: 16 })).toBe('10mm 12mm 14mm 16mm')
    expect(pageMarginsSummary({ top: 20, right: 20, bottom: 20, left: 20 })).toBe('20mm')
    expect(pageMarginsSummary({ top: 12, right: 16, bottom: 20, left: 24 })).toBe('상12 우16 하20 좌24mm')
  })

  it('formats running header and footer page tokens for editor preview', () => {
    expect(formatRunningText('Page {page} / {total}', 2, 7)).toBe('Page 2 / 7')
    expect(formatRunningText('쪽 {page}', 0, 0)).toBe('쪽 1')
    expect(formatRunningText('  프로젝트 헤더  ', 1, 1)).toBe('프로젝트 헤더')
  })
})
