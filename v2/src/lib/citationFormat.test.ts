import { describe, it, expect } from 'vitest'
import { formatBibEntry, formatInline } from './citationFormat'

const sample = {
  id: 'c1',
  authors: ['Jane Doe', 'John Smith'],
  year: '2024',
  title: 'Test Paper Title',
  venue: 'Journal of Testing',
  volume: '5',
  issue: '2',
  pages: '12-34',
  doi: '10.1000/test',
}

describe('citationFormat', () => {
  it('APA full bib entry', () => {
    const out = formatBibEntry(sample, 'apa')
    expect(out).toContain('Jane Doe & John Smith')
    expect(out).toContain('(2024)')
    expect(out).toContain('Test Paper Title')
    expect(out).toContain('Journal of Testing')
    expect(out).toContain('https://doi.org/10.1000/test')
  })

  it('IEEE numbered bib entry', () => {
    const out = formatBibEntry(sample, 'ieee', 0)
    expect(out).toMatch(/^\[1\]/)
    expect(out).toContain('Jane Doe, and John Smith')
    expect(out).toContain('vol. 5')
    expect(out).toContain('no. 2')
  })

  it('IEEE inline returns numbered ref', () => {
    expect(formatInline(sample, 'ieee', 0)).toBe('[1]')
    expect(formatInline(sample, 'ieee', 4)).toBe('[5]')
  })

  it('APA inline returns author-year', () => {
    expect(formatInline(sample, 'apa', 0)).toBe('(Doe, 2024)')
  })

  it('handles missing year', () => {
    const noYear = { ...sample, year: undefined }
    const out = formatBibEntry(noYear, 'apa')
    expect(out).toContain('n.d.')
  })

  it('handles single author', () => {
    const single = { ...sample, authors: ['Solo Author'] }
    const out = formatBibEntry(single, 'apa')
    expect(out).toContain('Solo Author')
    expect(out).not.toContain('&')
  })
})
