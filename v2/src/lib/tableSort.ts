/**
 * Phase 14 — 표 정렬.
 * 현재 셀이 위치한 열을 기준으로 모든 데이터 행 (헤더 제외) 을 정렬.
 * 숫자/문자 자동 감지.
 */
import type { Editor } from '@tiptap/react'
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model'

export type SortDir = 'asc' | 'desc'

export function sortTableByCurrentColumn(editor: Editor, dir: SortDir = 'asc'): boolean {
  if (!editor.isActive('table')) return false
  const { state } = editor

  let tableNode: ProseMirrorNode | null = null
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
  const activeTable = tableNode as ProseMirrorNode | null
  if (!activeTable) return false

  const colIndex = getColumnIndex(activeTable, tablePos, cellPos)

  if (colIndex < 0) return false
  const sortedTable = sortTableNode(activeTable, colIndex, dir)
  if (!sortedTable) return false

  editor.view.dispatch(
    state.tr
      .replaceWith(tablePos, tablePos + activeTable.nodeSize, sortedTable)
      .scrollIntoView(),
  )
  editor.view.focus()
  return true
}

export function sortTableNode(
  tableNode: ProseMirrorNode,
  colIndex: number,
  dir: SortDir = 'asc',
): ProseMirrorNode | null {
  const rows = collectRows(tableNode)
  if (rows.length === 0 || colIndex < 0) return null

  const firstRowIsHeader = rows[0]?.isHeader ?? false
  const headerRows = rows.filter((row, index) => row.isHeader || (firstRowIsHeader && index === 0))
  const dataRows = rows.filter((row, index) => !(row.isHeader || (firstRowIsHeader && index === 0)))

  dataRows.sort((a, b) => {
    const compare = compareCellText(a.cells[colIndex] || '', b.cells[colIndex] || '', dir)
    return compare === 0 ? a.index - b.index : compare
  })

  return tableNode.copy(Fragment.fromArray([...headerRows, ...dataRows].map((row) => row.node)))
}

interface RowData {
  node: ProseMirrorNode
  cells: string[]
  isHeader: boolean
  index: number
}

function collectRows(tableNode: ProseMirrorNode): RowData[] {
  const rows: RowData[] = []
  tableNode.forEach((row, _offset, index) => {
    if (row.type.name !== 'tableRow') return
    const cells: string[] = []
    let isHeader = false
    row.forEach((cell) => {
      cells.push((cell.textContent || '').trim())
      if (cell.type.name === 'tableHeader') isHeader = true
    })
    rows.push({ node: row, cells, isHeader, index })
  })
  return rows
}

function getColumnIndex(tableNode: ProseMirrorNode, tablePos: number, cellPos: number): number {
  let colIndex = -1
  tableNode.descendants((row, rowPos) => {
    if (row.type.name !== 'tableRow') return false
    const rowStart = tablePos + 1 + rowPos + 1
    row.forEach((_cell, cellOffset, index) => {
      if (rowStart + cellOffset === cellPos) colIndex = index
    })
    return colIndex < 0
  })
  return colIndex
}

function compareCellText(a: string, b: string, dir: SortDir): number {
  const an = parseSortNumber(a)
  const bn = parseSortNumber(b)
  const result = an !== null && bn !== null
    ? an - bn
    : a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' })
  return dir === 'asc' ? result : -result
}

function parseSortNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const negative = /^\(.*\)$/.test(trimmed)
  const normalized = trimmed
    .replace(/[()]/g, '')
    .replace(/[,$€¥₩%]/g, '')
    .replace(/\s+/g, '')
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return negative ? -parsed : parsed
}
