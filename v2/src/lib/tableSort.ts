/**
 * Phase 14 — 표 정렬.
 * 현재 셀이 위치한 열을 기준으로 모든 데이터 행 (헤더 제외) 을 정렬.
 * 숫자/문자 자동 감지.
 */
import type { Editor } from '@tiptap/react'

export type SortDir = 'asc' | 'desc'

export function sortTableByCurrentColumn(editor: Editor, dir: SortDir = 'asc'): boolean {
  if (!editor.isActive('table')) return false
  const { state } = editor

  let tableNode: any = null
  let tablePos = 0
  let cellPos = 0
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
      cellPos = pos
    }
    return true
  })
  if (!tableNode) return false

  // colIndex 찾기
  let colIndex = -1
  let firstRowIsHeader = false
  let counter = 0
  tableNode.descendants((row: any, rPos: number) => {
    if (row.type.name === 'tableRow') {
      const rFrom = tablePos + 1 + rPos
      let i = 0
      let hasHeader = false
      row.forEach((c: any, cOff: number) => {
        if (c.type.name === 'tableHeader') hasHeader = true
        if (rFrom + 1 + cOff === cellPos) colIndex = i
        i++
      })
      if (counter === 0) firstRowIsHeader = hasHeader
      counter++
    }
    return false
  })

  if (colIndex < 0) return false

  // 모든 행의 텍스트 셀 추출
  type RowData = { cells: string[]; htmlCells: string[]; isHeader: boolean }
  const rows: RowData[] = []
  tableNode.forEach((row: any) => {
    if (row.type.name !== 'tableRow') return
    const cells: string[] = []
    const htmlCells: string[] = []
    let isHeader = false
    row.forEach((c: any) => {
      cells.push((c.textContent || '').trim())
      htmlCells.push(serialize(c))
      if (c.type.name === 'tableHeader') isHeader = true
    })
    rows.push({ cells, htmlCells, isHeader })
  })

  // 헤더 행 분리
  const headerRows: RowData[] = []
  const dataRows: RowData[] = []
  for (const r of rows) {
    if (r.isHeader || (firstRowIsHeader && rows.indexOf(r) === 0)) headerRows.push(r)
    else dataRows.push(r)
  }

  // 정렬
  dataRows.sort((a, b) => {
    const av = a.cells[colIndex] || ''
    const bv = b.cells[colIndex] || ''
    const an = parseFloat(av.replace(/[,$€¥₩%]/g, ''))
    const bn = parseFloat(bv.replace(/[,$€¥₩%]/g, ''))
    if (!isNaN(an) && !isNaN(bn)) return dir === 'asc' ? an - bn : bn - an
    return dir === 'asc' ? av.localeCompare(bv, 'ko') : bv.localeCompare(av, 'ko')
  })

  // 새 표 HTML 빌드
  const allRows = [...headerRows, ...dataRows]
  const html = '<table>' + allRows.map((r) => `<tr>${r.htmlCells.join('')}</tr>`).join('') + '</table>'

  editor.chain().focus().deleteTable().insertContent(html).run()
  return true
}

function serialize(cellNode: any): string {
  // ProseMirror cell → HTML cell 직렬화 (단순)
  const tag = cellNode.type.name === 'tableHeader' ? 'th' : 'td'
  const text = (cellNode.textContent || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<${tag}>${text}</${tag}>`
}
