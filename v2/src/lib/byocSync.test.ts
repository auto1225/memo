import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncByocNow } from './byocSync'
import type { V2Snapshot } from './snapshot'
import { useMemosStore, type Memo } from '../store/memosStore'
import { useSettingsStore } from '../store/settingsStore'
import { useTagsStore } from '../store/tagsStore'
import { useBusinessCardsStore } from '../store/businessCardsStore'
import { DEFAULT_WORKSPACE_ID, useWorkspaceStore } from '../store/workspaceStore'

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

function configureDropboxSync() {
  useSettingsStore.setState({
    syncProvider: 'dropbox',
    syncEnabled: true,
    dropboxClientId: 'dropbox-client',
  })
  localStorage.setItem('jan.v2.dropbox.token', 'token')
  localStorage.setItem('jan.v2.dropbox.expires', String(Date.now() + 60_000))
}

describe('BYOC personal storage sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
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
    configureDropboxSync()
  })

  it('pulls a remote snapshot before pushing the merged local snapshot', async () => {
    const local = memo('m_local', 'local note', 1_000)
    const remote = memo('m_remote', 'remote note', 2_000)
    const uploads: Array<{ path: string; body: string }> = []
    useMemosStore.setState({
      memos: { [local.id]: local },
      trashed: {},
      currentId: local.id,
      order: [local.id],
      sortMode: 'recent',
    })

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const target = String(url)
      if (target.includes('/2/files/download')) {
        return new Response(JSON.stringify(snapshot({ [remote.id]: remote }, [remote.id])), { status: 200 })
      }
      if (target.includes('/2/files/upload')) {
        const headers = init?.headers as Record<string, string>
        const args = JSON.parse(headers['Dropbox-API-Arg']) as { path: string }
        uploads.push({ path: args.path, body: String(init?.body || '') })
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const result = await syncByocNow()

    expect(result).toMatchObject({ ok: true, provider: 'dropbox', pulled: 1, pushed: 1 })
    expect(useMemosStore.getState().memos.m_local.title).toBe('local note')
    expect(useMemosStore.getState().memos.m_remote.title).toBe('remote note')
    const uploadedSnapshot = uploads.find((item) => item.path === '/JustANotepad-v2/snapshot.json')
    expect(uploadedSnapshot).toBeTruthy()
    const uploaded = JSON.parse(uploadedSnapshot?.body || '{}') as V2Snapshot
    expect(Object.keys(uploaded.memos).sort()).toEqual(['m_local', 'm_remote'])
  })

  it('creates the remote snapshot when a personal storage backup does not exist yet', async () => {
    const local = memo('m_only_local', 'only local', 1_000)
    const uploads: Array<{ path: string; body: string }> = []
    useMemosStore.setState({
      memos: { [local.id]: local },
      trashed: {},
      currentId: local.id,
      order: [local.id],
      sortMode: 'recent',
    })

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const target = String(url)
      if (target.includes('/2/files/download')) {
        return new Response('path/not_found', { status: 409 })
      }
      if (target.includes('/2/files/upload')) {
        const headers = init?.headers as Record<string, string>
        const args = JSON.parse(headers['Dropbox-API-Arg']) as { path: string }
        uploads.push({ path: args.path, body: String(init?.body || '') })
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const result = await syncByocNow()

    expect(result).toMatchObject({ ok: true, provider: 'dropbox', pulled: 0, pushed: 1 })
    const uploadedSnapshot = uploads.find((item) => item.path === '/JustANotepad-v2/snapshot.json')
    const uploaded = JSON.parse(uploadedSnapshot?.body || '{}') as V2Snapshot
    expect(uploaded.memos.m_only_local.title).toBe('only local')
  })

  it('keeps a newer remote memo when autosync merges before pushing', async () => {
    const local = memo('m_conflict', 'local older', 1_000)
    const remote = memo('m_conflict', 'remote newer', 2_000)
    const uploads: Array<{ path: string; body: string }> = []
    useMemosStore.setState({
      memos: { [local.id]: local },
      trashed: {},
      currentId: local.id,
      order: [local.id],
      sortMode: 'recent',
    })

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const target = String(url)
      if (target.includes('/2/files/download')) {
        return new Response(JSON.stringify(snapshot({ [remote.id]: remote }, [remote.id])), { status: 200 })
      }
      if (target.includes('/2/files/upload')) {
        const headers = init?.headers as Record<string, string>
        const args = JSON.parse(headers['Dropbox-API-Arg']) as { path: string }
        uploads.push({ path: args.path, body: String(init?.body || '') })
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const result = await syncByocNow()

    expect(result).toMatchObject({ ok: true, provider: 'dropbox', pulled: 1, pushed: 1 })
    expect(useMemosStore.getState().memos.m_conflict.title).toBe('remote newer')
    const uploadedSnapshot = uploads.find((item) => item.path === '/JustANotepad-v2/snapshot.json')
    const uploaded = JSON.parse(uploadedSnapshot?.body || '{}') as V2Snapshot
    expect(uploaded.memos.m_conflict.title).toBe('remote newer')
  })

  it('keeps a newer local memo when autosync merges before pushing', async () => {
    const local = memo('m_conflict', 'local newer', 3_000)
    const remote = memo('m_conflict', 'remote older', 2_000)
    const uploads: Array<{ path: string; body: string }> = []
    useMemosStore.setState({
      memos: { [local.id]: local },
      trashed: {},
      currentId: local.id,
      order: [local.id],
      sortMode: 'recent',
    })

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const target = String(url)
      if (target.includes('/2/files/download')) {
        return new Response(JSON.stringify(snapshot({ [remote.id]: remote }, [remote.id])), { status: 200 })
      }
      if (target.includes('/2/files/upload')) {
        const headers = init?.headers as Record<string, string>
        const args = JSON.parse(headers['Dropbox-API-Arg']) as { path: string }
        uploads.push({ path: args.path, body: String(init?.body || '') })
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const result = await syncByocNow()

    expect(result).toMatchObject({ ok: true, provider: 'dropbox', pulled: 0, pushed: 1 })
    expect(useMemosStore.getState().memos.m_conflict.title).toBe('local newer')
    const uploadedSnapshot = uploads.find((item) => item.path === '/JustANotepad-v2/snapshot.json')
    const uploaded = JSON.parse(uploadedSnapshot?.body || '{}') as V2Snapshot
    expect(uploaded.memos.m_conflict.title).toBe('local newer')
  })
})
