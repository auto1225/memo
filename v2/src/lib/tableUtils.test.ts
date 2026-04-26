import { describe, expect, it } from 'vitest'
import { aggregateColumnCells, csvToRows, parseNumericCell, rowsToTableHtml } from './tableUtils'

describe('tableUtils', () => {
  it('parses currency, grouped numbers, percentages, and parenthesized negatives', () => {
    expect(parseNumericCell('₩1,200')).toBe(1200)
    expect(parseNumericCell('12.5%')).toBe(12.5)
    expect(parseNumericCell('(5)')).toBe(-5)
    expect(parseNumericCell('합계: 12')).toBeNull()
  })

  it('aggregates a column while skipping header and current result cell', () => {
    const cells = [
      { text: 'Amount', isHeader: true },
      { text: '₩10' },
      { text: '2' },
      { text: '', isCurrent: true },
    ]

    expect(aggregateColumnCells(cells, 'sum')).toMatchObject({ label: '합계', value: '12', numericCount: 2, cellCount: 2 })
    expect(aggregateColumnCells(cells, 'avg')).toMatchObject({ label: '평균', value: '6' })
    expect(aggregateColumnCells(cells, 'count')).toMatchObject({ label: '개수', value: '2' })
  })

  it('returns null for numeric aggregations when a data column has no numbers', () => {
    expect(aggregateColumnCells([{ text: 'Name', isHeader: true }, { text: 'Alpha' }], 'sum')).toBeNull()
  })

  it('round-trips quoted CSV cells into safe table HTML', () => {
    const rows = csvToRows('Name,Note\r\n"Alpha, Inc.","He said ""hi"""')
    const html = rowsToTableHtml(rows)

    expect(rows).toEqual([
      ['Name', 'Note'],
      ['Alpha, Inc.', 'He said "hi"'],
    ])
    expect(html).toContain('<th>Name</th>')
    expect(html).toContain('<td>Alpha, Inc.</td>')
    expect(html).toContain('<td>He said "hi"</td>')
  })
})
