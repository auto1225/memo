import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export interface FindReplaceOptions {
  query: string
  useRegex?: boolean
  caseSensitive?: boolean
  wholeWord?: boolean
  limit?: number
}

export interface TextMatch {
  from: number
  to: number
  text: string
  index: number
}

interface SearchSegment {
  searchFrom: number
  searchTo: number
  pmFrom: number | null
  pmTo: number | null
  text: string
}

export function findTextMatches(doc: ProseMirrorNode, options: FindReplaceOptions): TextMatch[] {
  const regex = buildSearchRegex(options, true)
  if (!regex) return []

  const { text, segments } = buildSearchIndex(doc)
  const matches: TextMatch[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex += 1
      continue
    }

    const searchFrom = match.index
    const searchTo = searchFrom + match[0].length
    if (options.wholeWord && !isWholeWord(text, searchFrom, searchTo)) continue

    const mapped = mapSearchRangeToDoc(segments, searchFrom, searchTo)
    if (mapped) {
      matches.push({
        from: mapped.from,
        to: mapped.to,
        text: match[0],
        index: searchFrom,
      })
    }

    if (matches.length >= (options.limit ?? 500)) break
  }

  return matches
}

export function getReplacementText(match: TextMatch, options: FindReplaceOptions, replacement: string): string {
  if (!options.useRegex) return replacement
  const regex = buildSearchRegex(options, false)
  if (!regex) return replacement
  return match.text.replace(regex, replacement)
}

export function buildSearchRegex(options: FindReplaceOptions, global: boolean): RegExp | null {
  const query = options.query
  if (!query) return null

  const source = options.useRegex ? query : escapeRegex(query)
  const flags = `${global ? 'g' : ''}${options.caseSensitive ? '' : 'i'}u`

  try {
    return new RegExp(source, flags)
  } catch {
    return null
  }
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSearchIndex(doc: ProseMirrorNode): { text: string; segments: SearchSegment[] } {
  const segments: SearchSegment[] = []
  let text = ''
  let lastTextblock: ProseMirrorNode | null = null

  doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text) return true

    const textblock = parent?.isTextblock ? parent : null
    if (lastTextblock && textblock && textblock !== lastTextblock) {
      segments.push({
        searchFrom: text.length,
        searchTo: text.length + 1,
        pmFrom: null,
        pmTo: null,
        text: '\n',
      })
      text += '\n'
    }

    const searchFrom = text.length
    text += node.text
    segments.push({
      searchFrom,
      searchTo: text.length,
      pmFrom: pos,
      pmTo: pos + node.text.length,
      text: node.text,
    })
    lastTextblock = textblock
    return true
  })

  return { text, segments }
}

function mapSearchRangeToDoc(
  segments: SearchSegment[],
  searchFrom: number,
  searchTo: number,
): { from: number; to: number } | null {
  let from: number | null = null
  let to: number | null = null

  for (const segment of segments) {
    if (segment.searchTo <= searchFrom) continue
    if (segment.searchFrom >= searchTo) break

    if (segment.pmFrom === null || segment.pmTo === null) return null

    const overlapFrom = Math.max(searchFrom, segment.searchFrom)
    const overlapTo = Math.min(searchTo, segment.searchTo)
    const docFrom = segment.pmFrom + (overlapFrom - segment.searchFrom)
    const docTo = segment.pmFrom + (overlapTo - segment.searchFrom)

    if (from === null) from = docFrom
    to = docTo
  }

  if (from === null || to === null || from >= to) return null
  return { from, to }
}

function isWholeWord(text: string, from: number, to: number): boolean {
  return !isWordChar(charBefore(text, from)) && !isWordChar(charAfter(text, to))
}

function charBefore(text: string, offset: number): string {
  return offset <= 0 ? '' : text.slice(0, offset).at(-1) || ''
}

function charAfter(text: string, offset: number): string {
  return offset >= text.length ? '' : text.slice(offset).at(0) || ''
}

function isWordChar(char: string): boolean {
  return char !== '' && /[\p{L}\p{N}_]/u.test(char)
}
