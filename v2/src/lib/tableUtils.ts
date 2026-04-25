/**
 * Phase 13 — 표 유틸리티.
 * - SUM / AVG / MIN / MAX 계산 (현재 셀의 열)
 * - CSV import / export
 */
import type { Editor } from '@tiptap/react'

export type Aggregator = 'sum' | 'avg' | 'min' | 'max' | 'count'

/**
 * 현재 커서가 있는 표의 같은 열의 모든 숫자 셀에서 집계 계산.
 * 결과를 현재 셀에 삽입.
 */
export function aggregateColumn(editor: Editor, agg: Aggregator) {
  if (!editor.isActive('table')) return false
  const { state } = editor
  // 현재 selection 의 표 노드 찾기
  let tableNode: any = null
  let tablePos = 0
  let cellPos = 0
  let cellNode: any = null

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
      (node.type.name === 'tableCell' || node.type.name === 'tableHeader') &&
      state.selection.from >= pos &&
      state.selection.from <= pos + node.nodeSize
    ) {
      cellNode = node
      cellPos = pos
    }
    return true
  })

  if (!tableNode || !cellNode) return false

  // 현재 셀의 열 인덱스 찾기 — 같은 row 안 cellPos 이전 셀 수
  let colIndex = 0
  let rowOfCell: any = null
  tableNode.descendants((row: any, rPos: number) => {
    if (row.type.name === 'tableRow') {
      const rFrom = tablePos + 1 + rPos
      const rTo = rFrom + row.nodeSize
      if (cellPos >= rFrom && cellPos <= rTo) {
        rowOfCell = row
        let i = 0
        row.forEach((_c: any, cOff: number) => {
          if (rFrom + 1 + cOff === cellPos) colIndex = i
          i++
        })
      }
    }
    return false
  })

  if (!rowOfCell) return false

  // 같은 colIndex 의 모든 셀 텍스트 → 숫자 추출
  const numbers: number[] = []
  let count = 0
  tableNode.forEach((row: any) => {
    if (row.type.name !== 'tableRow') return
    let i = 0
    row.forEach((c: any) => {
      if (i === colIndex && (c.type.name === 'tableCell' || c.type.name === 'tableHeader')) {
        const txt = (c.textContent || '').trim()
        const n = parseFloat(txt.replace(/[,$€¥₩%]/g, ''))
        if (!isNaN(n) && txt !== '') numbers.push(n)
        count++
      }
      i++
    })
  })

  if (agg === 'count') {
    insertResult(editor, agg, count.toString())
    return true
  }
  if (numbers.length === 0) {
    alert('현재 열에 숫자가 없습니다.')
    return false
  }

  let result: number
  switch (agg) {
    case 'sum': result = numbers.reduce((a, b) => a + b, 0); break
    case 'avg': result = numbers.reduce((a, b) => a + b, 0) / numbers.length; break
    case 'min': result = Math.min(...numbers); break
    case 'max': result = Math.max(...numbers); break
    default: return false
  }
  insertResult(editor, agg, fmtNumber(result))
  return true
}

function fmtNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString()
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function insertResult(editor: Editor, agg: Aggregator, value: string) {
  const label = { sum: '합계', avg: '평균', min: '최소', max: '최대', count: '개수' }[agg]
  // 현재 셀 끝에 결과 삽입 (덮어쓰지 않고)
  editor.chain().focus().insertContent(`<strong>${label}: ${value}</strong>`).run()
}

/** TipTap 표 → CSV 문자열. */
export function tableToCsv(editor: Editor): string | null {
  if (!editor.isActive('table')) return null
  const { state } = editor
  let tableNode: any = null
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'table' && state.selection.from >= pos && state.selection.from <= pos + node.nodeSize) {
      tableNode = node
    }
    return true
  })
  if (!tableNode) return null
  const rows: string[][] = []
  tableNode.forEach((row: any) => {
    if (row.type.name !== 'tableRow') return
    const cells: string[] = []
    row.forEach((c: any) => {
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
