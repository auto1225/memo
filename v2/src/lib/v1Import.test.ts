import { beforeEach, describe, expect, it } from 'vitest'
import { exportV2ToJson, importV1FromLocalStorage } from './v1Import'
import { useBusinessCardsStore } from '../store/businessCardsStore'
import { useMemosStore } from '../store/memosStore'
import { useTemplatesStore } from '../store/templatesStore'

describe('v1 import and backup coverage', () => {
  beforeEach(() => {
    localStorage.clear()
    useMemosStore.setState({ memos: {}, trashed: {}, currentId: null, order: [], sortMode: 'recent' })
    useBusinessCardsStore.setState({ cards: {}, groups: [], myCardId: null })
    useTemplatesStore.setState({ templates: [] })
  })

  it('imports the real v1 sticky-memo-v4 blob', async () => {
    localStorage.setItem(
      'sticky-memo-v4',
      JSON.stringify({
        tabs: [{ id: 'v1_tab_1', name: 'v1 daily', html: '<p>hello from v1</p>' }],
        businessCards: [{ id: 'card_1', name: 'Jane', company: 'Acme', photoBase64: 'data:image/png;base64,AAAA' }],
      })
    )

    const result = await importV1FromLocalStorage()
    const state = useMemosStore.getState()
    const cards = useBusinessCardsStore.getState()

    expect(result.errors).toEqual([])
    expect(result.imported).toBeGreaterThanOrEqual(2)
    expect(state.memos.v1_tab_1.content).toContain('hello from v1')
    expect(cards.cards.card_1.frontImage).toBe('data:image/png;base64,AAAA')
  })

  it('includes user templates in the v2 JSON backup extras', async () => {
    const now = Date.now()
    useMemosStore.setState({
      memos: { m1: { id: 'm1', title: 'memo', content: '<p>body</p>', createdAt: now, updatedAt: now } },
      order: ['m1'],
      currentId: 'm1',
    })
    useTemplatesStore.setState({
      templates: [{ id: 'tpl_1', name: 'Template', title: 'T', content: '<p>template</p>', createdAt: now }],
    })

    const parsed = JSON.parse(await exportV2ToJson())

    expect(parsed.extras.templates).toHaveLength(1)
    expect(parsed.extras.templates[0].content).toContain('template')
  })
})
