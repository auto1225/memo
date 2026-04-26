import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pushOne } from './supabaseSync'
import type { V2Snapshot } from './snapshot'
import { useMemosStore, type Memo } from '../store/memosStore'
import { useSettingsStore } from '../store/settingsStore'
import { DEFAULT_WORKSPACE_ID, useWorkspaceStore } from '../store/workspaceStore'
import { useTagsStore } from '../store/tagsStore'
import { useBusinessCardsStore } from '../store/businessCardsStore'

function memo(id: string, title: string, updatedAt: number): Memo {
  return {
    id,
    title,
    content: `<p>${title}</p>`,
    createdAt: updatedAt,
    updatedAt,
  }
}

function snapshot(memos: Record<string, Memo>, order = Object.keys(memos)): V2Snapshot {
  return {
    app: 'justanotepad',
    version: 2,
    exportedAt: Date.now(),
    memos,
    trashed: {},
    order,
    currentId: order[0] || null,
    sortMode: 'recent',
    tags: { byMemo: {} },
    workspaces: {
      workspaces: {
        [DEFAULT_WORKSPACE_ID]: { id: DEFAULT_WORKSPACE_ID, name: '기본', color: '#D97757', createdAt: 0 },
      },
      byMemo: {},
      currentWsId: null,
    },
    businessCards: {
      cards: {},
      groups: [],
      myCardId: null,
    },
  }
}

describe('Supabase snapshot autosync', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    const testWindow = window as Window & {
      SUPABASE_URL?: string
      SUPABASE_ANON_KEY?: string
    }
    testWindow.SUPABASE_URL = 'https://example.supabase.co'
    testWindow.SUPABASE_ANON_KEY = 'anon-key'
    useSettingsStore.getState().reset()
    useSettingsStore.setState({ syncEnabled: true, syncProvider: 'supabase' })
    useMemosStore.setState({ memos: {}, trashed: {}, currentId: null, order: [], sortMode: 'recent' })
    useTagsStore.setState({ byMemo: {} })
    useWorkspaceStore.setState({
      workspaces: {
        [DEFAULT_WORKSPACE_ID]: { id: DEFAULT_WORKSPACE_ID, name: '기본', color: '#D97757', createdAt: 0 },
      },
      byMemo: {},
      currentWsId: null,
    })
    useBusinessCardsStore.setState({ cards: {}, groups: [], myCardId: null })
  })

  it('pulls and merges the cloud snapshot before autosave upsert', async () => {
    const local = memo('m_local', 'local note', 1_000)
    const remote = memo('m_remote', 'remote note', 2_000)
    const upserts: unknown[] = []
    useMemosStore.setState({
      memos: { [local.id]: local },
      trashed: {},
      currentId: local.id,
      order: [local.id],
      sortMode: 'recent',
    })

    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user: { id: 'user-1', email: 'user@example.com' } } }, error: null }),
          signInWithOAuth: async () => ({ error: null }),
          signOut: async () => ({ error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { data: snapshot({ [remote.id]: remote }, [remote.id]), version: 2 }, error: null }),
            }),
          }),
          upsert: async (payload: unknown) => {
            upserts.push(payload)
            return { error: null }
          },
        }),
      }),
    }

    await expect(pushOne(local.id)).resolves.toBe(true)

    expect(useMemosStore.getState().memos.m_remote.title).toBe('remote note')
    expect(upserts).toHaveLength(1)
    const payload = upserts[0] as { data: V2Snapshot }
    expect(Object.keys(payload.data.memos).sort()).toEqual(['m_local', 'm_remote'])
  })
})
