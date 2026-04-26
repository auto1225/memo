import { beforeEach, describe, expect, it } from 'vitest'
import { createPortableV2Snapshot, exportV2ToJson, importV1FromLocalStorage, importV2FromJsonAsync } from './v1Import'
import { useBusinessCardsStore } from '../store/businessCardsStore'
import { useMemosStore } from '../store/memosStore'
import { useTemplatesStore } from '../store/templatesStore'
import { clearAttachmentsForTests, loadAttachment, saveAttachment } from './attachments'
import { saveDataUrlAsBlobRef } from './blobRefs'

describe('v1 import and backup coverage', () => {
  beforeEach(async () => {
    localStorage.clear()
    await clearAttachmentsForTests()
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

  it('round-trips attachments through the v2 JSON backup', async () => {
    const now = Date.now()
    useMemosStore.setState({
      memos: { m1: { id: 'm1', title: 'memo', content: '<p><a href="indexeddb:att_1" data-att="att_1">card.pdf</a></p>', createdAt: now, updatedAt: now } },
      order: ['m1'],
      currentId: 'm1',
      trashed: {},
      sortMode: 'recent',
    })
    const id = await saveAttachment(new File(['hello'], 'card.pdf', { type: 'application/pdf' }), 'm1')

    const parsed = JSON.parse(await exportV2ToJson())
    expect(parsed.extras.attachments).toHaveLength(1)
    expect(parsed.extras.attachments[0].id).toBe(id)
    expect(parsed.extras.attachments[0].dataUrl).toContain('application/pdf')

    await clearAttachmentsForTests()
    await importV2FromJsonAsync(JSON.stringify(parsed))

    const restored = await loadAttachment(id)
    expect(restored?.name).toBe('card.pdf')
    await expect(restored?.data.text()).resolves.toBe('hello')
  })

  it('hydrates local blob references in portable sync snapshots', async () => {
    const now = Date.now()
    const dataUrl = `data:image/png;base64,${'A'.repeat(20000)}`
    const ref = await saveDataUrlAsBlobRef(dataUrl)
    useMemosStore.setState({
      memos: { m1: { id: 'm1', title: 'memo', content: `<p><img src="${ref}" /></p>`, createdAt: now, updatedAt: now } },
      order: ['m1'],
      currentId: 'm1',
      trashed: {},
      sortMode: 'recent',
    })

    const snapshot = await createPortableV2Snapshot()

    expect(snapshot.memos.m1.content).toContain(dataUrl)
    expect(snapshot.memos.m1.content).not.toContain('jan-blob://')
  })
})
