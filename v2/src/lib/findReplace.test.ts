import { describe, expect, it } from 'vitest'
import { Schema } from '@tiptap/pm/model'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { findTextMatches, getReplacementText } from './findReplace'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      toDOM: () => ['p', 0],
    },
    heading: {
      content: 'inline*',
      group: 'block',
      attrs: { level: { default: 1 } },
      toDOM: (node) => [`h${node.attrs.level}`, 0],
    },
    text: { group: 'inline' },
  },
  marks: {
    strong: { toDOM: () => ['strong', 0] },
  },
})

const p = (...content: ProseMirrorNode[]) => schema.nodes.paragraph.create(null, content)
const h = (...content: ProseMirrorNode[]) => schema.nodes.heading.create({ level: 1 }, content)
const text = (value: string, strong = false) =>
  strong ? schema.text(value, [schema.marks.strong.create()]) : schema.text(value)
const doc = (...blocks: ProseMirrorNode[]) => schema.nodes.doc.create(null, blocks)

describe('findReplace', () => {
  it('maps matches to real ProseMirror positions across inline formatting', () => {
    const content = doc(p(text('Alpha '), text('Beta', true), text(' Gamma')))

    const [match] = findTextMatches(content, { query: 'Beta' })

    expect(content.textBetween(match.from, match.to)).toBe('Beta')
  })

  it('does not create false matches across separate text blocks', () => {
    const content = doc(h(text('Alpha')), p(text('Beta')))

    expect(findTextMatches(content, { query: 'AlphaBeta' })).toHaveLength(0)
    expect(findTextMatches(content, { query: 'Alpha\nBeta' })).toHaveLength(0)
  })

  it('supports Word-style whole-word matching for Latin and Korean text', () => {
    const content = doc(p(text('cat catalog cat2 cat 고양이 고양이들 고양이')))

    const latin = findTextMatches(content, { query: 'cat', wholeWord: true })
    const korean = findTextMatches(content, { query: '고양이', wholeWord: true })

    expect(latin.map((match) => content.textBetween(match.from, match.to))).toEqual(['cat', 'cat'])
    expect(korean.map((match) => content.textBetween(match.from, match.to))).toEqual(['고양이', '고양이'])
  })

  it('returns capture-aware regex replacement text', () => {
    const content = doc(p(text('2026/04')))
    const [match] = findTextMatches(content, { query: '(\\d{4})/(\\d{2})', useRegex: true })

    expect(getReplacementText(match, { query: '(\\d{4})/(\\d{2})', useRegex: true }, '$2-$1')).toBe('04-2026')
  })

  it('ignores invalid regular expressions', () => {
    const content = doc(p(text('Alpha')))

    expect(findTextMatches(content, { query: '[', useRegex: true })).toEqual([])
  })
})
