import { describe, expect, it } from 'vitest'
import { PAGE_BREAK_HTML } from './pageBreak'
import { getActiveListItemType } from './keymap'

describe('Word keymap helpers', () => {
  it('targets task list items before regular list items', () => {
    const active = new Set(['listItem', 'taskItem'])

    expect(getActiveListItemType((name) => active.has(name))).toBe('taskItem')
  })

  it('detects regular list items and ignores non-list selections', () => {
    expect(getActiveListItemType((name) => name === 'listItem')).toBe('listItem')
    expect(getActiveListItemType(() => false)).toBeNull()
  })

  it('uses one canonical page-break HTML fragment', () => {
    expect(PAGE_BREAK_HTML).toBe('<hr class="jan-page-break" data-page-break="1" /><p></p>')
  })
})
