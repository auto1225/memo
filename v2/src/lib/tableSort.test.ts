import { describe, expect, it } from 'vitest'
import { Schema, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import { sortTableNode } from './tableSort'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
    table: {
      content: 'tableRow+',
      group: 'block',
      tableRole: 'table',
      toDOM: () => ['table', ['tbody', 0]],
    },
    tableRow: {
      content: '(tableCell | tableHeader)+',
      tableRole: 'row',
      toDOM: () => ['tr', 0],
    },
    tableCell: {
      content: 'block+',
      tableRole: 'cell',
      toDOM: () => ['td', 0],
    },
    tableHeader: {
      content: 'block+',
      tableRole: 'header_cell',
      toDOM: () => ['th', 0],
    },
  },
  marks: {
    strong: { toDOM: () => ['strong', 0] },
  },
})

function text(value: string, strong = false) {
  return strong ? schema.text(value, [schema.marks.strong.create()]) : schema.text(value)
}

function p(value: string, strong = false) {
  return schema.nodes.paragraph.create(null, text(value, strong))
}

function row(cells: ProseMirrorNode[]) {
  return schema.nodes.tableRow.create(null, cells)
}

function cell(value: string, strong = false) {
  return schema.nodes.tableCell.create(null, p(value, strong))
}

function header(value: string) {
  return schema.nodes.tableHeader.create(null, p(value))
}

describe('tableSort', () => {
  it('sorts table rows while keeping the header row in place', () => {
    const table = schema.nodes.table.create(null, [
      row([header('Name'), header('Amount')]),
      row([cell('Beta'), cell('10')]),
      row([cell('Alpha'), cell('2')]),
    ])

    const sorted = sortTableNode(table, 0, 'asc')

    expect(sorted?.child(0).textContent).toBe('NameAmount')
    expect(sorted?.child(1).textContent).toBe('Alpha2')
    expect(sorted?.child(2).textContent).toBe('Beta10')
  })

  it('uses numeric comparison for currency and parenthesized values', () => {
    const table = schema.nodes.table.create(null, [
      row([header('Item'), header('Amount')]),
      row([cell('Large'), cell('₩1,200')]),
      row([cell('Loss'), cell('(5)')]),
      row([cell('Small'), cell('20')]),
    ])

    const sorted = sortTableNode(table, 1, 'asc')

    expect(sorted?.child(1).textContent).toBe('Loss(5)')
    expect(sorted?.child(2).textContent).toBe('Small20')
    expect(sorted?.child(3).textContent).toBe('Large₩1,200')
  })

  it('preserves inline formatting inside sorted cells', () => {
    const table = schema.nodes.table.create(null, [
      row([header('Name'), header('Amount')]),
      row([cell('Beta'), cell('10')]),
      row([cell('Alpha', true), cell('2')]),
    ])

    const sorted = sortTableNode(table, 0, 'asc')
    const firstDataText = sorted?.child(1).child(0).child(0).child(0)

    expect(firstDataText?.text).toBe('Alpha')
    expect(firstDataText?.marks[0]?.type.name).toBe('strong')
  })
})
