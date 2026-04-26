import { useMemosStore, type Memo, type SortMode, type TrashedMemo } from '../store/memosStore'
import { useTagsStore } from '../store/tagsStore'
import { DEFAULT_WORKSPACE_ID, useWorkspaceStore, type Workspace } from '../store/workspaceStore'
import { useBusinessCardsStore, type BusinessCard } from '../store/businessCardsStore'
import { migrateV1Html } from './migration'

export interface V2Snapshot {
  app: 'justanotepad'
  version: 2
  exportedAt: number
  memos: Record<string, Memo>
  trashed: Record<string, TrashedMemo>
  order: string[]
  currentId: string | null
  sortMode: SortMode
  tags: {
    byMemo: Record<string, string[]>
  }
  workspaces: {
    workspaces: Record<string, Workspace>
    byMemo: Record<string, string>
    currentWsId: string | null
  }
  businessCards: {
    cards: Record<string, BusinessCard>
    groups: string[]
    myCardId: string | null
  }
}

export interface SnapshotApplyResult {
  applied: boolean
  memosChanged: number
  trashChanged: number
  tagsChanged: number
  workspacesChanged: number
  cardsChanged: number
}

interface V1Tab {
  id?: string
  name?: string
  title?: string
  html?: string
  content?: string
  pinned?: boolean
  tag?: string
  wsId?: string
}

interface V1Workspace {
  id?: string
  name?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeMemo(raw: unknown): Memo | null {
  if (!isRecord(raw)) return null
  const id = safeString(raw.id, '')
  if (!id) return null
  const now = Date.now()
  return {
    id,
    title: safeString(raw.title, '무제'),
    content: safeString(raw.content, '<p></p>'),
    createdAt: safeNumber(raw.createdAt, now),
    updatedAt: safeNumber(raw.updatedAt, now),
    pinned: raw.pinned === true,
  }
}

function normalizeTrash(raw: unknown): TrashedMemo | null {
  const memo = normalizeMemo(raw)
  if (!memo || !isRecord(raw)) return null
  return {
    ...memo,
    trashedAt: safeNumber(raw.trashedAt, memo.updatedAt),
  }
}

function normalizeMemoRecord(raw: unknown): Record<string, Memo> {
  const result: Record<string, Memo> = {}
  if (!isRecord(raw)) return result
  for (const value of Object.values(raw)) {
    const memo = normalizeMemo(value)
    if (memo) result[memo.id] = memo
  }
  return result
}

function normalizeTrashRecord(raw: unknown): Record<string, TrashedMemo> {
  const result: Record<string, TrashedMemo> = {}
  if (!isRecord(raw)) return result
  for (const value of Object.values(raw)) {
    const memo = normalizeTrash(value)
    if (memo) result[memo.id] = memo
  }
  return result
}

function normalizeTags(raw: unknown): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  if (!isRecord(raw)) return result
  for (const [memoId, tags] of Object.entries(raw)) {
    if (!Array.isArray(tags)) continue
    result[memoId] = tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean)
  }
  return result
}

function normalizeWorkspaceRecord(raw: unknown): Record<string, Workspace> {
  const fallback: Record<string, Workspace> = {
    [DEFAULT_WORKSPACE_ID]: { id: DEFAULT_WORKSPACE_ID, name: '기본', color: '#D97757', createdAt: 0 },
  }
  if (!isRecord(raw)) return fallback
  const result: Record<string, Workspace> = {}
  for (const [id, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue
    result[id] = {
      id,
      name: safeString(value.name, '기본'),
      color: safeString(value.color, '#D97757'),
      createdAt: safeNumber(value.createdAt, 0),
    }
  }
  return Object.keys(result).length ? result : fallback
}

function normalizeWorkspaceMap(raw: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (!isRecord(raw)) return result
  for (const [memoId, workspaceId] of Object.entries(raw)) {
    if (typeof workspaceId === 'string' && workspaceId) result[memoId] = workspaceId
  }
  return result
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

function normalizeBusinessCard(raw: unknown, fallbackId: string): BusinessCard | null {
  if (!isRecord(raw)) return null
  const now = Date.now()
  const id = safeString(raw.id, fallbackId)
  const sns: Record<string, string> = {}
  if (isRecord(raw.sns)) {
    for (const [key, value] of Object.entries(raw.sns)) {
      if (typeof value === 'string' && value.trim()) sns[key] = value.trim()
    }
  }
  const meetings = Array.isArray(raw.meetings)
    ? raw.meetings.filter(isRecord).map((meeting, index) => ({
        id: safeString(meeting.id, `mt_${id}_${index}`),
        date: safeString(meeting.date, ''),
        place: safeString(meeting.place, ''),
        note: safeString(meeting.note, ''),
        createdAt: safeNumber(meeting.createdAt, now),
      }))
    : []
  return {
    id,
    name: safeString(raw.name, ''),
    nameEn: safeString(raw.nameEn, ''),
    company: safeString(raw.company, ''),
    department: safeString(raw.department, ''),
    position: safeString(raw.position, ''),
    mobile: safeString(raw.mobile, ''),
    phone: safeString(raw.phone, ''),
    fax: safeString(raw.fax, ''),
    email: safeString(raw.email, ''),
    website: safeString(raw.website, ''),
    address: safeString(raw.address, ''),
    group: safeString(raw.group, ''),
    tags: normalizeStringArray(raw.tags).map((tag) => tag.replace(/^#/, '').toLowerCase()),
    memo: safeString(raw.memo, ''),
    favorite: raw.favorite === true,
    sns,
    meetings,
    frontImage: typeof raw.frontImage === 'string' ? raw.frontImage : undefined,
    backImage: typeof raw.backImage === 'string' ? raw.backImage : undefined,
    createdAt: safeNumber(raw.createdAt, now),
    updatedAt: safeNumber(raw.updatedAt, now),
  }
}

function normalizeBusinessCardRecord(raw: unknown): Record<string, BusinessCard> {
  const result: Record<string, BusinessCard> = {}
  if (Array.isArray(raw)) {
    raw.forEach((value, index) => {
      const card = normalizeBusinessCard(value, `bc_import_${index}`)
      if (card) result[card.id] = card
    })
    return result
  }
  if (!isRecord(raw)) return result
  for (const [id, value] of Object.entries(raw)) {
    const card = normalizeBusinessCard(value, id)
    if (card) result[card.id] = card
  }
  return result
}

function snapshotFromV2(raw: Record<string, unknown>): V2Snapshot | null {
  const memos = normalizeMemoRecord(raw.memos)
  if (!Object.keys(memos).length) return null

  const tags = isRecord(raw.tags) ? normalizeTags(raw.tags.byMemo) : {}
  const rawWorkspaces = isRecord(raw.workspaces) ? raw.workspaces : null
  const workspaces = isRecord(raw.workspaces)
    ? normalizeWorkspaceRecord(raw.workspaces.workspaces)
    : normalizeWorkspaceRecord(null)
  const workspaceMap = rawWorkspaces ? normalizeWorkspaceMap(rawWorkspaces.byMemo) : {}
  const rawCards = isRecord(raw.businessCards) ? raw.businessCards : null
  const rawOrder = Array.isArray(raw.order) ? raw.order.filter((id): id is string => typeof id === 'string') : []
  const order = [...rawOrder.filter((id) => memos[id]), ...Object.keys(memos).filter((id) => !rawOrder.includes(id))]
  const currentId = typeof raw.currentId === 'string' && memos[raw.currentId] ? raw.currentId : order[0] || null
  const sortMode = ['recent', 'title', 'created', 'manual'].includes(String(raw.sortMode))
    ? (raw.sortMode as SortMode)
    : 'recent'

  return {
    app: 'justanotepad',
    version: 2,
    exportedAt: safeNumber(raw.exportedAt, Date.now()),
    memos,
    trashed: normalizeTrashRecord(raw.trashed),
    order,
    currentId,
    sortMode,
    tags: { byMemo: tags },
    workspaces: {
      workspaces,
      byMemo: workspaceMap,
      currentWsId: typeof rawWorkspaces?.currentWsId === 'string' ? rawWorkspaces.currentWsId : null,
    },
    businessCards: {
      cards: rawCards ? normalizeBusinessCardRecord(rawCards.cards) : {},
      groups: rawCards ? normalizeStringArray(rawCards.groups) : [],
      myCardId: typeof rawCards?.myCardId === 'string' ? rawCards.myCardId : null,
    },
  }
}

function snapshotFromV1(raw: Record<string, unknown>): V2Snapshot | null {
  if (!Array.isArray(raw.tabs)) return null
  const now = Date.now()
  const memos: Record<string, Memo> = {}
  const tags: Record<string, string[]> = {}
  const workspaceMap: Record<string, string> = {}
  const order: string[] = []

  for (const tab of raw.tabs as V1Tab[]) {
    const id = safeString(tab.id, `m_${now.toString(36)}_${order.length}`)
    const content = tab.html || tab.content || '<p></p>'
    memos[id] = {
      id,
      title: tab.name || tab.title || '무제',
      content: migrateV1Html(content),
      createdAt: now,
      updatedAt: now,
      pinned: tab.pinned === true,
    }
    order.push(id)
    if (tab.tag) tags[id] = [String(tab.tag).toLowerCase()]
    if (tab.wsId) workspaceMap[id] = tab.wsId
  }

  if (!order.length) return null

  const workspaces: Record<string, Workspace> = {}
  if (Array.isArray(raw.workspaces)) {
    for (const ws of raw.workspaces as V1Workspace[]) {
      if (!ws.id) continue
      workspaces[ws.id] = {
        id: ws.id,
        name: ws.name || '공간',
        color: '#D97757',
        createdAt: now,
      }
    }
  }
  if (!Object.keys(workspaces).length) {
    workspaces[DEFAULT_WORKSPACE_ID] = { id: DEFAULT_WORKSPACE_ID, name: '기본', color: '#D97757', createdAt: 0 }
  }

  return {
    app: 'justanotepad',
    version: 2,
    exportedAt: now,
    memos,
    trashed: {},
    order,
    currentId: safeString(raw.activeId, order[0]),
    sortMode: 'manual',
    tags: { byMemo: tags },
    workspaces: {
      workspaces,
      byMemo: workspaceMap,
      currentWsId: null,
    },
    businessCards: {
      cards: normalizeBusinessCardRecord(raw.businessCards),
      groups: normalizeStringArray(raw.cardGroups),
      myCardId: null,
    },
  }
}

export function snapshotFromCloudData(data: unknown): V2Snapshot | null {
  if (!isRecord(data)) return null
  return snapshotFromV2(data) || snapshotFromV1(data)
}

export function createV2Snapshot(): V2Snapshot {
  const memos = useMemosStore.getState()
  const tags = useTagsStore.getState()
  const workspaces = useWorkspaceStore.getState()
  const businessCards = useBusinessCardsStore.getState()
  return {
    app: 'justanotepad',
    version: 2,
    exportedAt: Date.now(),
    memos: memos.memos,
    trashed: memos.trashed,
    order: memos.order,
    currentId: memos.currentId,
    sortMode: memos.sortMode,
    tags: { byMemo: tags.byMemo },
    workspaces: {
      workspaces: workspaces.workspaces,
      byMemo: workspaces.byMemo,
      currentWsId: workspaces.currentWsId,
    },
    businessCards: {
      cards: businessCards.cards,
      groups: businessCards.groups,
      myCardId: businessCards.myCardId,
    },
  }
}

export function applyV2Snapshot(snapshot: V2Snapshot): SnapshotApplyResult {
  const current = useMemosStore.getState()
  const nextMemos = { ...current.memos }
  const nextTrash = { ...current.trashed }
  let memosChanged = 0
  let trashChanged = 0

  for (const memo of Object.values(snapshot.memos)) {
    const localTrash = nextTrash[memo.id]
    if (localTrash && localTrash.trashedAt >= memo.updatedAt) continue
    const localMemo = nextMemos[memo.id]
    if (!localMemo || localMemo.updatedAt <= memo.updatedAt) {
      nextMemos[memo.id] = memo
      delete nextTrash[memo.id]
      memosChanged++
    }
  }

  for (const trashed of Object.values(snapshot.trashed)) {
    const localMemo = nextMemos[trashed.id]
    if (localMemo && localMemo.updatedAt > trashed.trashedAt) continue
    const localTrash = nextTrash[trashed.id]
    if (!localTrash || localTrash.trashedAt <= trashed.trashedAt) {
      delete nextMemos[trashed.id]
      nextTrash[trashed.id] = trashed
      trashChanged++
    }
  }

  const incomingOrder = snapshot.order.filter((id) => nextMemos[id])
  const localRest = current.order.filter((id) => nextMemos[id] && !incomingOrder.includes(id))
  const order = [...incomingOrder, ...localRest]
  const currentId = snapshot.currentId && nextMemos[snapshot.currentId] ? snapshot.currentId : current.currentId || order[0] || null

  useMemosStore.setState({
    memos: nextMemos,
    trashed: nextTrash,
    order,
    currentId,
    sortMode: snapshot.sortMode,
  })

  const currentTags = useTagsStore.getState().byMemo
  const nextTags = { ...currentTags, ...snapshot.tags.byMemo }
  const tagsChanged = JSON.stringify(currentTags) === JSON.stringify(nextTags) ? 0 : 1
  if (tagsChanged) useTagsStore.setState({ byMemo: nextTags })

  const currentWorkspaces = useWorkspaceStore.getState()
  const nextWorkspaceState = {
    workspaces: { ...currentWorkspaces.workspaces, ...snapshot.workspaces.workspaces },
    byMemo: { ...currentWorkspaces.byMemo, ...snapshot.workspaces.byMemo },
    currentWsId: currentWorkspaces.currentWsId || snapshot.workspaces.currentWsId,
  }
  const workspacesChanged =
    JSON.stringify({
      workspaces: currentWorkspaces.workspaces,
      byMemo: currentWorkspaces.byMemo,
      currentWsId: currentWorkspaces.currentWsId,
    }) === JSON.stringify(nextWorkspaceState)
      ? 0
      : 1
  if (workspacesChanged) useWorkspaceStore.setState(nextWorkspaceState)

  const currentCards = useBusinessCardsStore.getState()
  const nextCards = { ...currentCards.cards }
  for (const card of Object.values(snapshot.businessCards.cards)) {
    const localCard = nextCards[card.id]
    if (!localCard || localCard.updatedAt <= card.updatedAt) nextCards[card.id] = card
  }
  const nextGroups = Array.from(new Set([...currentCards.groups, ...snapshot.businessCards.groups])).sort((a, b) => a.localeCompare(b, 'ko'))
  const nextMyCardId = currentCards.myCardId || snapshot.businessCards.myCardId
  const cardsChanged =
    JSON.stringify({
      cards: currentCards.cards,
      groups: currentCards.groups,
      myCardId: currentCards.myCardId,
    }) === JSON.stringify({ cards: nextCards, groups: nextGroups, myCardId: nextMyCardId })
      ? 0
      : 1
  if (cardsChanged) {
    useBusinessCardsStore.setState({
      cards: nextCards,
      groups: nextGroups,
      myCardId: nextMyCardId,
    })
  }

  return {
    applied: memosChanged + trashChanged + tagsChanged + workspacesChanged + cardsChanged > 0,
    memosChanged,
    trashChanged,
    tagsChanged,
    workspacesChanged,
    cardsChanged,
  }
}
