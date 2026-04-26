/**
 * Phase 13 — 표 유틸리티.
 * - SUM / AVG / MIN / MAX 계산 (현재 셀의 열)
 * - CSV import / export
 */
import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export type Aggregator = 'sum' | 'avg' | 'min' | 'max' | 'count'

interface ActiveTableContext {
  tableNode: ProseMirrorNode
  tablePos: number
  cellNode: ProseMirrorNode
  cellPos: number
  colIndex: number
}

export interface ColumnAggregateCell {
  text: string
  isHeader?: boolean
  isCurrent?: boolean
}

export interface ColumnAggregateResult {
  label: string
  value: string
  numericCount: number
  cellCount: number
}

const AGGREGATE_LABELS: Record<Aggregator, string> = {
  sum: '합계',
  avg: '평균',
  min: '최소',
  max: '최대',
  count: '개수',
}

/**
 * 현재 커서가 있는 표의 같은 열의 모든 숫자 셀에서 집계 계산.
 * 결과를 현재 셀에 삽입.
 */
export function aggregateColumn(editor: Editor, agg: Aggregator) {
  if (!editor.isActive('table')) return false
  const context = findActiveTableContext(editor)
  if (!context) return false

  const cells = getColumnCells(context)
  const result = aggregateColumnCells(cells, agg)
  if (!result) {
    alert('현재 열에 숫자가 없습니다.')
    return false
  }

  insertResult(editor, result.label, result.value)
  return true
}

function findActiveTableContext(editor: Editor): ActiveTableContext | null {
  const { state } = editor
  let tableNode: ProseMirrorNode | null = null
  let tablePos = 0
  let cellPos = 0
  let cellNode: ProseMirrorNode | null = null

  state.doc.descendants((node, pos) => {
    if (node.type.name === 'table') {
      const from = pos
      const to = pos + node.nodeSize
      if (state.selection.from >= from && state.selection.from <= to) {
        tableNode = node
        tablePos = pos
      }
    }
    if (
      (node.type.name === 'tableCell' || node.type.name === 'tableHeader')
      && state.selection.from >= pos
      && state.selection.from <= pos + node.nodeSize
    ) {
      cellNode = node
      cellPos = pos
    }
    return true
  })

  const activeTable = tableNode as ProseMirrorNode | null
  const activeCell = cellNode as ProseMirrorNode | null
  if (!activeTable || !activeCell) return null

  let colIndex = -1
  activeTable.forEach((row, rowOffset) => {
    if (row.type.name !== 'tableRow') return
    const rowStart = tablePos + 1 + rowOffset
    const rowEnd = rowStart + row.nodeSize
    if (cellPos < rowStart || cellPos > rowEnd) return
    row.forEach((_cell, cellOffset, index) => {
      if (rowStart + 1 + cellOffset === cellPos) colIndex = index
    })
  })

  if (colIndex < 0) return null
  return { tableNode: activeTable, tablePos, cellNode: activeCell, cellPos, colIndex }
}

function getColumnCells(context: ActiveTableContext): ColumnAggregateCell[] {
  const cells: ColumnAggregateCell[] = []
  context.tableNode.forEach((row, rowOffset) => {
    if (row.type.name !== 'tableRow') return
    const rowStart = context.tablePos + 1 + rowOffset
    row.forEach((cell, cellOffset, index) => {
      if (index !== context.colIndex) return
      cells.push({
        text: (cell.textContent || '').trim(),
        isHeader: cell.type.name === 'tableHeader',
        isCurrent: rowStart + 1 + cellOffset === context.cellPos || cell === context.cellNode,
      })
    })
  })
  return cells
}

export function aggregateColumnCells(cells: ColumnAggregateCell[], agg: Aggregator): ColumnAggregateResult | null {
  const dataCells = cells.filter((cell) => !cell.isHeader && !cell.isCurrent)
  const numbers = dataCells
    .map((cell) => parseNumericCell(cell.text))
    .filter((value): value is number => value !== null)
  const cellCount = dataCells.filter((cell) => cell.text.trim() !== '').length

  if (agg === 'count') {
    return { label: AGGREGATE_LABELS.count, value: String(cellCount), numericCount: numbers.length, cellCount }
  }
  if (numbers.length === 0) return null

  const raw = (() => {
    switch (agg) {
      case 'sum': return numbers.reduce((a, b) => a + b, 0)
      case 'avg': return numbers.reduce((a, b) => a + b, 0) / numbers.length
      case 'min': return Math.min(...numbers)
      case 'max': return Math.max(...numbers)
      default: return null
    }
  })()

  if (raw === null) return null
  return { label: AGGREGATE_LABELS[agg], value: fmtNumber(raw), numericCount: numbers.length, cellCount }
}

export function parseNumericCell(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const withoutCurrency = trimmed.replace(/[,$€¥₩]/g, '').replace(/\s+/g, '')
  const percentless = withoutCurrency.endsWith('%') ? withoutCurrency.slice(0, -1) : withoutCurrency
  const isParenthesizedNegative = /^\(.+\)$/.test(percentless)
  const normalized = percentless.replace(/[()]/g, '')
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return isParenthesizedNegative ? -Math.abs(value) : value
}

function fmtNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString()
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function insertResult(editor: Editor, label: string, value: string) {
  // 현재 셀 끝에 결과 삽입 (덮어쓰지 않고)
  editor.chain().focus().insertContent(`<strong>${label}: ${value}</strong>`).run()
}

/** TipTap 표 → CSV 문자열. */
export function tableToCsv(editor: Editor): string | null {
  if (!editor.isActive('table')) return null
  const { state } = editor
  let tableNode: ProseMirrorNode | null = null
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'table' && state.selection.from >= pos && state.selection.from <= pos + node.nodeSize) {
      tableNode = node
    }
    return true
  })
  const activeTable = tableNode as ProseMirrorNode | null
  if (!activeTable) return null
  const rows: string[][] = []
  activeTable.forEach((row) => {
    if (row.type.name !== 'tableRow') return
    const cells: string[] = []
    row.forEach((c) => {
      const txt = (c.textContent || '').replace(/"/g, '""')
      cells.push(/[",\n]/.test(txt) ? `"${txt}"` : txt)
    })
    rows.push(cells)
  })
  return rows.map((r) => r.join(',')).join('\n')
}

/** CSV 문자열 → 행렬. 따옴표/이스케이프 고려. */
export function csvToRows(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuote = false
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i]
    if (inQuote) {
      if (c === '"') {
        if (csv[i + 1] === '"') { cell += '"'; i++ }
        else inQuote = false
      } else cell += c
    } else {
      if (c === '"') inQuote = true
      else if (c === ',') { row.push(cell); cell = '' }
      else if (c === '\n' || c === '\r') {
        if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); row = []; cell = '' }
        if (c === '\r' && csv[i + 1] === '\n') i++
      } else cell += c
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ''))
}

/** CSV 행렬 → TipTap insertContent 용 HTML. */
export function rowsToTableHtml(rows: string[][], firstRowIsHeader = true): string {
  if (rows.length === 0) return ''
  const headerHtml = firstRowIsHeader
    ? '<tr>' + rows[0].map((c) => `<th>${escHtml(c)}</th>`).join('') + '</tr>'
    : ''
  const body = rows
    .slice(firstRowIsHeader ? 1 : 0)
    .map((r) => '<tr>' + r.map((c) => `<td>${escHtml(c)}</td>`).join('') + '</tr>')
    .join('')
  return `<table>${headerHtml}${body}</table>`
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
