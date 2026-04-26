import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleByocOAuthRedirectIfNeeded, readByocSyncHealth, syncByocNow } from './byocSync'
import type { V2Snapshot } from './snapshot'
import { useMemosStore, type Memo } from '../store/memosStore'
import { useSettingsStore } from '../store/settingsStore'
import { useTagsStore } from '../store/tagsStore'
import { useBusinessCardsStore } from '../store/businessCardsStore'
import { DEFAULT_WORKSPACE_ID, useWorkspaceStore } from '../store/workspaceStore'
import { clearAttachmentsForTests, loadAttachment, saveAttachment } from './attachments'
import { saveDataUrlAsBlobRef } from './blobRefs'

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

function configureOneDriveSync() {
  useSettingsStore.setState({
    syncProvider: 'onedrive',
    syncEnabled: true,
    onedriveClientId: 'onedrive-client',
  })
  localStorage.setItem('jan.v2.onedrive.token', 'token')
  localStorage.setItem('jan.v2.onedrive.expires', String(Date.now() + 60_000))
}

describe('BYOC personal storage sync', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    localStorage.clear()
    window.history.pushState({}, '', '/v2/')
    await clearAttachmentsForTests()
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

  it('stores BYOC images and attachments as sidecar files instead of inline snapshot data', async () => {
    const now = Date.now()
    const imageDataUrl = `data:image/png;base64,${'A'.repeat(20000)}`
    const imageRef = await saveDataUrlAsBlobRef(imageDataUrl)
    const uploads: Array<{ path: string; body: string }> = []
    useMemosStore.setState({
      memos: {
        m_blob: {
          id: 'm_blob',
          title: 'blob memo',
          content: `<p><img src="${imageRef}" /></p><p><a href="indexeddb:att_sidecar" data-att="att_sidecar">sidecar.txt</a></p>`,
          createdAt: now,
          updatedAt: now,
        },
      },
      trashed: {},
      currentId: 'm_blob',
      order: ['m_blob'],
      sortMode: 'recent',
    })
    const attachmentId = await saveAttachment(new File(['hello sidecar'], 'sidecar.txt', { type: 'text/plain' }), 'm_blob')

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
    expect(uploadedSnapshot?.body).toContain(imageRef)
    expect(uploadedSnapshot?.body).toContain(`jan-byoc-attachment://${attachmentId}`)
    expect(uploadedSnapshot?.body).not.toContain(imageDataUrl)
    expect(uploadedSnapshot?.body).not.toContain('data:text/plain')
    expect(uploads.some((item) => item.path.startsWith('/JustANotepad-v2/blobs/') && item.body === imageDataUrl)).toBe(true)
    expect(uploads.some((item) => item.path.startsWith('/JustANotepad-v2/attachments/') && item.body.startsWith('data:text/plain'))).toBe(true)
  })

  it('hydrates BYOC sidecar files before importing remote snapshots', async () => {
    const now = Date.now()
    const imageDataUrl = `data:image/png;base64,${'B'.repeat(20000)}`
    const attachmentDataUrl = 'data:text/plain;base64,aGVsbG8gcmVtb3Rl'
    const remote = memo('m_remote_sidecar', 'remote sidecar', now)
    remote.content = '<p><img src="jan-blob://remoteimage" /></p><p><a href="indexeddb:att_remote" data-att="att_remote">remote.txt</a></p>'
    const remoteSnapshot = snapshot({ [remote.id]: remote }, [remote.id])
    remoteSnapshot.extras = {
      attachments: [{
        id: 'att_remote',
        name: 'remote.txt',
        type: 'text/plain',
        size: 12,
        memoId: remote.id,
        createdAt: now,
        dataUrl: 'jan-byoc-attachment://att_remote',
      }],
    }

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const target = String(url)
      if (target.includes('/2/files/download')) {
        const headers = init?.headers as Record<string, string>
        const args = JSON.parse(headers['Dropbox-API-Arg']) as { path: string }
        if (args.path === '/JustANotepad-v2/snapshot.json') {
          return new Response(JSON.stringify(remoteSnapshot), { status: 200 })
        }
        if (args.path.startsWith('/JustANotepad-v2/blobs/')) {
          return new Response(imageDataUrl, { status: 200 })
        }
        if (args.path.startsWith('/JustANotepad-v2/attachments/')) {
          return new Response(attachmentDataUrl, { status: 200 })
        }
        return new Response('path/not_found', { status: 409 })
      }
      if (target.includes('/2/files/upload')) {
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const result = await syncByocNow()

    expect(result).toMatchObject({ ok: true, provider: 'dropbox', pulled: expect.any(Number), pushed: 1 })
    const imported = useMemosStore.getState().memos.m_remote_sidecar
    expect(imported.content).toContain('jan-blob://')
    expect(imported.content).not.toContain(imageDataUrl)
    const restored = await loadAttachment('att_remote')
    expect(restored?.name).toBe('remote.txt')
    await expect(restored?.data.text()).resolves.toBe('hello remote')
  })

  it('syncs personal storage through OneDrive app folder content endpoints', async () => {
    configureOneDriveSync()
    const local = memo('m_onedrive', 'onedrive note', 1_000)
    const uploads: Array<{ url: string; body: string }> = []
    useMemosStore.setState({
      memos: { [local.id]: local },
      trashed: {},
      currentId: local.id,
      order: [local.id],
      sortMode: 'recent',
    })

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const target = String(url)
      const method = init?.method || 'GET'
      if (target.includes('graph.microsoft.com')) {
        if (method === 'GET' && target.endsWith('/snapshot.json:/content')) {
          return new Response('not found', { status: 404 })
        }
        if (method === 'PUT') {
          uploads.push({ url: target, body: String(init?.body || '') })
          return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const result = await syncByocNow()

    expect(result).toMatchObject({ ok: true, provider: 'onedrive', pulled: 0, pushed: 1 })
    const snapshotUpload = uploads.find((item) => item.url.includes('/JustANotepad-v2/snapshot.json:/content'))
    expect(snapshotUpload?.url).toContain('/me/drive/special/approot:')
    expect(JSON.parse(snapshotUpload?.body || '{}').memos.m_onedrive.title).toBe('onedrive note')
  })

  it('refreshes a OneDrive token once when Graph returns 401', async () => {
    configureOneDriveSync()
    localStorage.setItem('jan.v2.onedrive.refresh', 'refresh-token')
    const local = memo('m_onedrive_refresh', 'refresh note', 1_000)
    let snapshotReads = 0
    let tokenRefreshes = 0
    const authHeaders: string[] = []
    useMemosStore.setState({
      memos: { [local.id]: local },
      trashed: {},
      currentId: local.id,
      order: [local.id],
      sortMode: 'recent',
    })

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const target = String(url)
      if (target.includes('login.microsoftonline.com')) {
        tokenRefreshes++
        return new Response(JSON.stringify({ access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (target.includes('graph.microsoft.com')) {
        const headers = init?.headers as Record<string, string>
        authHeaders.push(headers.Authorization)
        const method = init?.method || 'GET'
        if (method === 'GET' && target.endsWith('/snapshot.json:/content')) {
          snapshotReads++
          return snapshotReads === 1
            ? new Response('expired', { status: 401 })
            : new Response('not found', { status: 404 })
        }
        if (method === 'PUT') {
          return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const result = await syncByocNow()

    expect(result.ok).toBe(true)
    expect(tokenRefreshes).toBe(1)
    expect(authHeaders).toContain('Bearer new-token')
  })

  it('ignores unrelated OAuth callbacks when no BYOC provider is pending', async () => {
    window.history.pushState({}, '', '/v2/?code=external&state=not-byoc')

    await expect(handleByocOAuthRedirectIfNeeded()).resolves.toBeNull()
  })

  it('fails safely when a remote BYOC blob sidecar is missing', async () => {
    const remote = memo('m_missing_blob', 'missing blob', 1_000)
    remote.content = '<p><img src="jan-blob://missingblob" /></p>'
    const remoteSnapshot = snapshot({ [remote.id]: remote }, [remote.id])

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const target = String(url)
      if (target.includes('/2/files/download')) {
        const headers = init?.headers as Record<string, string>
        const args = JSON.parse(headers['Dropbox-API-Arg']) as { path: string }
        if (args.path === '/JustANotepad-v2/snapshot.json') {
          return new Response(JSON.stringify(remoteSnapshot), { status: 200 })
        }
        return new Response('path/not_found', { status: 409 })
      }
      if (target.includes('/2/files/upload')) {
        throw new Error('snapshot upload should not happen after missing sidecar')
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const result = await syncByocNow()

    expect(result.ok).toBe(false)
    expect(result.error).toContain('동기화 이미지 파일이 누락되었습니다')
    expect(useMemosStore.getState().memos.m_missing_blob).toBeUndefined()
  })

  it('does not commit a snapshot when a sidecar upload fails', async () => {
    const imageRef = await saveDataUrlAsBlobRef(`data:image/png;base64,${'C'.repeat(20000)}`)
    const local = memo('m_sidecar_fail', 'sidecar fail', 1_000)
    local.content = `<p><img src="${imageRef}" /></p>`
    let snapshotUploaded = false
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
        if (args.path.startsWith('/JustANotepad-v2/blobs/')) {
          return new Response('blob upload failed', { status: 500 })
        }
        if (args.path === '/JustANotepad-v2/snapshot.json') snapshotUploaded = true
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const result = await syncByocNow()

    expect(result.ok).toBe(false)
    expect(snapshotUploaded).toBe(false)
  })

  it('records personal storage sync failures for the settings health panel', async () => {
    const local = memo('m_sync_fail', 'sync fail', 1_000)
    useMemosStore.setState({
      memos: { [local.id]: local },
      trashed: {},
      currentId: local.id,
      order: [local.id],
      sortMode: 'recent',
    })

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const target = String(url)
      if (target.includes('/2/files/download')) {
        return new Response('path/not_found', { status: 409 })
      }
      if (target.includes('/2/files/upload')) {
        return new Response('upload failed', { status: 500 })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const result = await syncByocNow()
    const health = readByocSyncHealth()

    expect(result.ok).toBe(false)
    expect(health.provider).toBe('dropbox')
    expect(health.lastError).toContain('Dropbox API 오류')
    expect(health.lastErrorAt).toBeGreaterThan(0)
  })

  it('clears previous personal storage sync errors after a successful sync', async () => {
    localStorage.setItem('jan.v2.sync.lastError', 'old failure')
    localStorage.setItem('jan.v2.sync.lastErrorAt', '123')
    const local = memo('m_sync_ok', 'sync ok', 1_000)
    useMemosStore.setState({
      memos: { [local.id]: local },
      trashed: {},
      currentId: local.id,
      order: [local.id],
      sortMode: 'recent',
    })

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const target = String(url)
      if (target.includes('/2/files/download')) {
        return new Response('path/not_found', { status: 409 })
      }
      if (target.includes('/2/files/upload')) {
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const result = await syncByocNow()
    const health = readByocSyncHealth()

    expect(result.ok).toBe(true)
    expect(health.lastError).toBe('')
    expect(health.lastErrorAt).toBe(0)
    expect(health.lastAt).toBeGreaterThan(0)
  })
})
