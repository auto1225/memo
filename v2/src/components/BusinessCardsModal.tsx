import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Editor } from '@tiptap/react'
import { Icon } from './Icons'
import { useBusinessCardsStore, type BusinessCard, type BusinessCardInput } from '../store/businessCardsStore'

interface BusinessCardsModalProps {
  editor: Editor | null
  onClose: () => void
}

type CardFilter = 'all' | 'favorite' | 'recent' | `group:${string}` | `tag:${string}`
type CardSort = 'updatedAt' | 'createdAt' | 'name' | 'company'

const EMPTY_CARD: BusinessCardInput = {
  name: '',
  nameEn: '',
  company: '',
  department: '',
  position: '',
  mobile: '',
  phone: '',
  fax: '',
  email: '',
  website: '',
  address: '',
  group: '',
  tags: [],
  memo: '',
  favorite: false,
  sns: {},
  meetings: [],
}

function makeDraft(card?: BusinessCard | null): BusinessCardInput {
  if (!card) return { ...EMPTY_CARD, tags: [], sns: {}, meetings: [] }
  return {
    ...card,
    tags: [...card.tags],
    sns: { ...card.sns },
    meetings: [...card.meetings],
  }
}

function cleanPhone(value: string): string {
  return value.replace(/\D/g, '')
}

function splitTags(value: string): string[] {
  return value.split(',').map((tag) => tag.trim().replace(/^#/, '').toLowerCase()).filter(Boolean)
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 800)
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeVCard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function cardToVCard(card: BusinessCard): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0']
  if (card.name) {
    lines.push(`FN:${escapeVCard(card.name)}`)
    lines.push(`N:${escapeVCard(card.name)};;;;`)
  }
  if (card.company) lines.push(`ORG:${escapeVCard(card.company)}${card.department ? ';' + escapeVCard(card.department) : ''}`)
  if (card.position) lines.push(`TITLE:${escapeVCard(card.position)}`)
  if (card.mobile) lines.push(`TEL;TYPE=CELL:${escapeVCard(card.mobile)}`)
  if (card.phone) lines.push(`TEL;TYPE=WORK:${escapeVCard(card.phone)}`)
  if (card.fax) lines.push(`TEL;TYPE=FAX:${escapeVCard(card.fax)}`)
  if (card.email) lines.push(`EMAIL;TYPE=WORK:${escapeVCard(card.email)}`)
  if (card.website) lines.push(`URL:${escapeVCard(card.website)}`)
  if (card.address) lines.push(`ADR;TYPE=WORK:;;${escapeVCard(card.address)};;;;`)
  if (card.memo) lines.push(`NOTE:${escapeVCard(card.memo)}`)
  for (const [key, value] of Object.entries(card.sns)) {
    if (value) lines.push(`X-SOCIALPROFILE;TYPE=${escapeVCard(key)}:${escapeVCard(value)}`)
  }
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

function cardsToCsv(cards: BusinessCard[]): string {
  const headers = ['name', 'nameEn', 'company', 'department', 'position', 'mobile', 'phone', 'fax', 'email', 'website', 'address', 'group', 'tags', 'memo']
  const rows = cards.map((card) => [
    card.name,
    card.nameEn,
    card.company,
    card.department,
    card.position,
    card.mobile,
    card.phone,
    card.fax,
    card.email,
    card.website,
    card.address,
    card.group,
    card.tags.join(';'),
    card.memo,
  ])
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`
  return [headers.join(','), ...rows.map((row) => row.map(cell).join(','))].join('\n')
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && quoted && line[i + 1] === '"') {
      cur += '"'
      i++
    } else if (ch === '"') {
      quoted = !quoted
    } else if (ch === ',' && !quoted) {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

function parseCsv(text: string): BusinessCardInput[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = cells[index] || ''
    })
    return {
      ...EMPTY_CARD,
      name: row.name || row.이름 || '',
      nameEn: row.nameEn || '',
      company: row.company || row.회사 || '',
      department: row.department || row.부서 || '',
      position: row.position || row.직책 || '',
      mobile: row.mobile || row.휴대폰 || '',
      phone: row.phone || row.전화 || '',
      fax: row.fax || '',
      email: row.email || row.이메일 || '',
      website: row.website || row.url || '',
      address: row.address || row.주소 || '',
      group: row.group || row.그룹 || '',
      tags: splitTags((row.tags || row.태그 || '').replace(/;/g, ',')),
      memo: row.memo || row.메모 || '',
    }
  })
}

function parseVCard(text: string): BusinessCardInput[] {
  return text
    .split(/BEGIN:VCARD/i)
    .slice(1)
    .map((block) => {
      const lines = block.split(/\r?\n/)
      const card: BusinessCardInput = { ...EMPTY_CARD, tags: [], sns: {}, meetings: [] }
      for (const line of lines) {
        const [rawKey, ...rest] = line.split(':')
        const value = rest.join(':').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').trim()
        const key = rawKey.toUpperCase()
        if (key.startsWith('FN')) card.name = value
        else if (key.startsWith('ORG')) {
          const [company, department] = value.split(';')
          card.company = company || ''
          card.department = department || ''
        } else if (key.startsWith('TITLE')) card.position = value
        else if (key.startsWith('EMAIL')) card.email = value
        else if (key.startsWith('URL')) card.website = value
        else if (key.startsWith('ADR')) card.address = value.split(';').filter(Boolean).join(' ')
        else if (key.startsWith('NOTE')) card.memo = value
        else if (key.startsWith('TEL')) {
          if (key.includes('CELL')) card.mobile = value
          else if (key.includes('FAX')) card.fax = value
          else card.phone = value
        } else if (key.startsWith('X-SOCIALPROFILE')) {
          const type = rawKey.match(/TYPE=([^;:]+)/i)?.[1]?.toLowerCase() || 'profile'
          card.sns[type] = value
        }
      }
      return card
    })
    .filter((card) => card.name || card.company || card.email || card.mobile || card.phone)
}

function parseMemoText(text: string): Partial<BusinessCardInput> {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ''
  const phone = text.match(/(?:\+?\d{1,3}[-.\s]?)?(?:0\d{1,2}[-.\s]?)?\d{3,4}[-.\s]?\d{4}/)?.[0] || ''
  const website = text.match(/https?:\/\/[^\s<]+|(?:www\.)[^\s<]+/i)?.[0] || ''
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  return {
    name: lines[0] || '',
    company: lines[1] || '',
    position: lines[2] || '',
    email,
    mobile: phone,
    website,
    memo: lines.slice(3, 8).join('\n'),
  }
}

function findDuplicate(cards: BusinessCard[], draft: BusinessCardInput): BusinessCard | null {
  const email = draft.email.trim().toLowerCase()
  const mobile = cleanPhone(draft.mobile)
  const phone = cleanPhone(draft.phone)
  return cards.find((card) => {
    if (draft.id && card.id === draft.id) return false
    if (email && card.email.trim().toLowerCase() === email) return true
    if (mobile && cleanPhone(card.mobile) === mobile) return true
    return !!(phone && cleanPhone(card.phone) === phone)
  }) || null
}

function cardToHtml(card: BusinessCard): string {
  const rows = [
    ['이름', card.name],
    ['회사', [card.company, card.department].filter(Boolean).join(' / ')],
    ['직책', card.position],
    ['휴대폰', card.mobile],
    ['전화', card.phone],
    ['이메일', card.email],
    ['웹사이트', card.website],
    ['주소', card.address],
    ['태그', card.tags.map((tag) => `#${tag}`).join(' ')],
    ['메모', card.memo],
  ].filter(([, value]) => value)
  return `<div class="jan-business-card-embed"><h3>${escapeHtml(card.name || card.company || '명함')}</h3>${rows.map(([key, value]) => `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</p>`).join('')}</div><p></p>`
}

export function BusinessCardsModal({ editor, onClose }: BusinessCardsModalProps) {
  const cardsRecord = useBusinessCardsStore((state) => state.cards)
  const groups = useBusinessCardsStore((state) => state.groups)
  const addCard = useBusinessCardsStore((state) => state.addCard)
  const updateCard = useBusinessCardsStore((state) => state.updateCard)
  const deleteCard = useBusinessCardsStore((state) => state.deleteCard)
  const toggleFavorite = useBusinessCardsStore((state) => state.toggleFavorite)
  const addGroup = useBusinessCardsStore((state) => state.addGroup)
  const removeGroup = useBusinessCardsStore((state) => state.removeGroup)
  const renameGroup = useBusinessCardsStore((state) => state.renameGroup)
  const importCards = useBusinessCardsStore((state) => state.importCards)
  const addMeeting = useBusinessCardsStore((state) => state.addMeeting)
  const [filter, setFilter] = useState<CardFilter>('all')
  const [sort, setSort] = useState<CardSort>('updatedAt')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<BusinessCardInput>(() => makeDraft())
  const [status, setStatus] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)

  const cards = useMemo(() => Object.values(cardsRecord), [cardsRecord])
  const selectedCard = selectedId ? cardsRecord[selectedId] : null
  const duplicate = useMemo(() => findDuplicate(cards, draft), [cards, draft])
  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of cards) {
      for (const tag of card.tags) counts.set(tag, (counts.get(tag) || 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [cards])
  const visibleCards = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const lower = query.trim().toLowerCase()
    return cards
      .filter((card) => {
        if (filter === 'favorite' && !card.favorite) return false
        if (filter === 'recent' && card.createdAt < cutoff) return false
        if (filter.startsWith('group:') && card.group !== filter.slice(6)) return false
        if (filter.startsWith('tag:') && !card.tags.includes(filter.slice(4))) return false
        if (!lower) return true
        return [card.name, card.nameEn, card.company, card.department, card.position, card.mobile, card.phone, card.email, card.website, card.address, card.memo, card.tags.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(lower)
      })
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name, 'ko')
        if (sort === 'company') return a.company.localeCompare(b.company, 'ko')
        return (b[sort] || 0) - (a[sort] || 0)
      })
  }, [cards, filter, query, sort])

  function updateDraft<K extends keyof BusinessCardInput>(key: K, value: BusinessCardInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function beginAdd() {
    setEditingId('new')
    setDraft(makeDraft())
    setStatus('')
  }

  function beginEdit(card: BusinessCard) {
    setEditingId(card.id)
    setDraft(makeDraft(card))
    setStatus('')
  }

  function saveDraft() {
    if (!draft.name && !draft.company) {
      setStatus('이름 또는 회사명은 꼭 필요합니다')
      return
    }
    if (editingId && editingId !== 'new' && cardsRecord[editingId]) {
      updateCard(editingId, draft)
      setSelectedId(editingId)
      setStatus('명함을 수정했습니다')
    } else {
      const id = addCard(draft)
      setSelectedId(id)
      setStatus('새 명함을 추가했습니다')
    }
    setEditingId(null)
  }

  function removeSelected(card: BusinessCard) {
    if (!window.confirm(`"${card.name || card.company}" 명함을 삭제할까요?`)) return
    deleteCard(card.id)
    setSelectedId(null)
    setEditingId(null)
    setStatus('명함을 삭제했습니다')
  }

  function exportVCard(cardsToExport: BusinessCard[]) {
    if (!cardsToExport.length) return
    downloadText('justanotepad-contacts.vcf', cardsToExport.map(cardToVCard).join('\r\n'), 'text/vcard;charset=utf-8')
    setStatus(`${cardsToExport.length}개 명함을 vCard로 내보냈습니다`)
  }

  function exportCsv(cardsToExport: BusinessCard[]) {
    if (!cardsToExport.length) return
    downloadText('justanotepad-contacts.csv', cardsToCsv(cardsToExport), 'text/csv;charset=utf-8')
    setStatus(`${cardsToExport.length}개 명함을 CSV로 내보냈습니다`)
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const imported = file.name.toLowerCase().endsWith('.vcf') ? parseVCard(text) : parseCsv(text)
    const count = importCards(imported)
    setStatus(`${count}개 명함을 가져왔습니다`)
    e.target.value = ''
  }

  function extractFromMemo() {
    const text = editor?.state.doc.textContent || ''
    if (!text.trim()) {
      setStatus('현재 메모에 추출할 텍스트가 없습니다')
      return
    }
    setEditingId(editingId || 'new')
    setDraft((current) => ({ ...current, ...parseMemoText(text) }))
    setStatus('현재 메모에서 연락처 후보를 추출했습니다')
  }

  function insertCard(card: BusinessCard) {
    if (!editor) return
    editor.chain().focus().insertContent(cardToHtml(card)).run()
    setStatus('현재 메모에 명함 정보를 삽입했습니다')
  }

  function addMeetingPrompt(card: BusinessCard) {
    const date = window.prompt('미팅 날짜:', new Date().toISOString().slice(0, 10))
    if (!date) return
    const place = window.prompt('장소:', '') || ''
    const note = window.prompt('메모:', '') || ''
    addMeeting(card.id, { date, place, note })
    setStatus('미팅 기록을 추가했습니다')
  }

  function handleAddGroup() {
    const name = window.prompt('새 그룹명:')
    if (!name) return
    addGroup(name)
    setFilter(`group:${name.trim()}`)
  }

  function handleRenameGroup(name: string) {
    const next = window.prompt('새 그룹명:', name)
    if (!next || next === name) return
    renameGroup(name, next)
    setFilter(`group:${next}`)
  }

  function handleRemoveGroup(name: string) {
    if (!window.confirm(`"${name}" 그룹을 삭제할까요? 명함은 삭제되지 않습니다.`)) return
    removeGroup(name)
    setFilter('all')
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-cards-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head jan-cards-head">
          <div className="jan-cards-title">
            <Icon name="cards" size={20} />
            <h3>명함관리</h3>
            <span>{visibleCards.length} / {cards.length}개</span>
          </div>
          <div className="jan-cards-actions">
            <button onClick={beginAdd}><Icon name="plus" />명함 추가</button>
            <button onClick={() => importInputRef.current?.click()}><Icon name="download" />가져오기</button>
            <button onClick={() => exportCsv(visibleCards)}><Icon name="upload" />CSV</button>
            <button onClick={() => exportVCard(visibleCards)}><Icon name="card" />vCard</button>
            <button className="jan-modal-close" onClick={onClose}>닫기</button>
          </div>
        </div>

        <div className="jan-cards-body">
          <aside className="jan-cards-side">
            <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}><Icon name="users" />전체<span>{cards.length}</span></button>
            <button className={filter === 'favorite' ? 'is-active' : ''} onClick={() => setFilter('favorite')}><Icon name="heart" />즐겨찾기<span>{cards.filter((card) => card.favorite).length}</span></button>
            <button className={filter === 'recent' ? 'is-active' : ''} onClick={() => setFilter('recent')}><Icon name="history" />최근 7일</button>
            <div className="jan-cards-side-label">그룹</div>
            {groups.map((group) => (
              <div className="jan-cards-group-row" key={group}>
                <button className={filter === `group:${group}` ? 'is-active' : ''} onClick={() => setFilter(`group:${group}`)}><Icon name="briefcase" />{group}</button>
                <button title="이름 변경" onClick={() => handleRenameGroup(group)}><Icon name="settings" /></button>
                <button title="삭제" onClick={() => handleRemoveGroup(group)}><Icon name="trash" /></button>
              </div>
            ))}
            <button className="jan-cards-dashed" onClick={handleAddGroup}><Icon name="plus" />그룹 추가</button>
            <div className="jan-cards-side-label">태그</div>
            {tags.map(([tag, count]) => (
              <button key={tag} className={filter === `tag:${tag}` ? 'is-active' : ''} onClick={() => setFilter(`tag:${tag}`)}><Icon name="tag" />{tag}<span>{count}</span></button>
            ))}
          </aside>

          <main className="jan-cards-list-pane">
            <div className="jan-cards-searchbar">
              <div className="jan-cards-search">
                <Icon name="search" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름, 회사, 전화, 이메일, 태그 검색" />
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value as CardSort)}>
                <option value="updatedAt">최근 수정순</option>
                <option value="createdAt">추가순</option>
                <option value="name">이름순</option>
                <option value="company">회사순</option>
              </select>
            </div>
            <div className="jan-cards-list">
              {visibleCards.length === 0 ? (
                <div className="jan-cards-empty">
                  <Icon name="cards" size={34} />
                  <strong>{cards.length ? '조건에 맞는 명함이 없습니다' : '아직 명함이 없습니다'}</strong>
                  <span>{cards.length ? '검색어 또는 필터를 바꿔보세요.' : '명함을 추가하거나 CSV/vCard 파일에서 가져오세요.'}</span>
                </div>
              ) : visibleCards.map((card) => (
                <button
                  className={'jan-card-tile' + (selectedId === card.id ? ' is-selected' : '')}
                  key={card.id}
                  onClick={() => { setSelectedId(card.id); setEditingId(null) }}
                >
                  <span className="jan-card-avatar">{(card.name || card.company || '?').slice(0, 1).toUpperCase()}</span>
                  <span className="jan-card-main">
                    <strong>{card.name || '이름 없음'}</strong>
                    <span>{[card.company, card.position].filter(Boolean).join(' · ') || '회사/직책 없음'}</span>
                    <em>{card.email || card.mobile || card.phone || '연락처 없음'}</em>
                  </span>
                  {card.favorite && <Icon name="heart" className="jan-card-fav" />}
                </button>
              ))}
            </div>
          </main>

          <aside className="jan-cards-detail">
            {editingId ? (
              <div className="jan-card-form">
                <h4>{editingId === 'new' ? '명함 추가' : '명함 편집'}</h4>
                <div className="jan-card-form-grid">
                  <label>이름<input value={draft.name} onChange={(e) => updateDraft('name', e.target.value)} /></label>
                  <label>영문명<input value={draft.nameEn} onChange={(e) => updateDraft('nameEn', e.target.value)} /></label>
                  <label className="span-2">회사<input value={draft.company} onChange={(e) => updateDraft('company', e.target.value)} /></label>
                  <label>부서<input value={draft.department} onChange={(e) => updateDraft('department', e.target.value)} /></label>
                  <label>직책<input value={draft.position} onChange={(e) => updateDraft('position', e.target.value)} /></label>
                  <label>휴대폰<input value={draft.mobile} onChange={(e) => updateDraft('mobile', e.target.value)} /></label>
                  <label>전화<input value={draft.phone} onChange={(e) => updateDraft('phone', e.target.value)} /></label>
                  <label>이메일<input type="email" value={draft.email} onChange={(e) => updateDraft('email', e.target.value)} /></label>
                  <label>웹사이트<input value={draft.website} onChange={(e) => updateDraft('website', e.target.value)} /></label>
                  <label className="span-2">주소<input value={draft.address} onChange={(e) => updateDraft('address', e.target.value)} /></label>
                  <label>그룹<input list="jan-card-groups" value={draft.group} onChange={(e) => updateDraft('group', e.target.value)} /></label>
                  <label>태그<input value={draft.tags.join(', ')} onChange={(e) => updateDraft('tags', splitTags(e.target.value))} /></label>
                  <label className="span-2">메모<textarea value={draft.memo} onChange={(e) => updateDraft('memo', e.target.value)} rows={4} /></label>
                </div>
                <datalist id="jan-card-groups">
                  {groups.map((group) => <option value={group} key={group} />)}
                </datalist>
                <label className="jan-card-check"><input type="checkbox" checked={draft.favorite} onChange={(e) => updateDraft('favorite', e.target.checked)} />즐겨찾기</label>
                {duplicate && <div className="jan-card-warning">동일 이메일/전화의 명함이 있습니다: {duplicate.name || duplicate.company}</div>}
                <div className="jan-cards-actions">
                  <button onClick={extractFromMemo}><Icon name="wand" />현재 메모에서 추출</button>
                  <button onClick={() => setEditingId(null)}>취소</button>
                  <button className="primary" onClick={saveDraft}><Icon name="check" />저장</button>
                </div>
              </div>
            ) : selectedCard ? (
              <div className="jan-card-profile">
                <div className="jan-card-profile-head">
                  <span className="jan-card-avatar big">{(selectedCard.name || selectedCard.company || '?').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <h4>{selectedCard.name || '이름 없음'}</h4>
                    <p>{[selectedCard.company, selectedCard.department, selectedCard.position].filter(Boolean).join(' · ') || '회사 정보 없음'}</p>
                  </div>
                </div>
                <dl>
                  {[
                    ['휴대폰', selectedCard.mobile],
                    ['전화', selectedCard.phone],
                    ['팩스', selectedCard.fax],
                    ['이메일', selectedCard.email],
                    ['웹사이트', selectedCard.website],
                    ['주소', selectedCard.address],
                    ['그룹', selectedCard.group],
                    ['태그', selectedCard.tags.map((tag) => `#${tag}`).join(' ')],
                    ['메모', selectedCard.memo],
                  ].filter(([, value]) => value).map(([key, value]) => (
                    <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
                  ))}
                </dl>
                <div className="jan-card-meetings">
                  <h5>미팅 기록</h5>
                  {selectedCard.meetings.length === 0 ? <p>기록 없음</p> : selectedCard.meetings.map((meeting) => (
                    <div key={meeting.id}><strong>{meeting.date}</strong><span>{meeting.place}</span><p>{meeting.note}</p></div>
                  ))}
                </div>
                <div className="jan-cards-actions wrap">
                  <button onClick={() => toggleFavorite(selectedCard.id)}><Icon name="heart" />{selectedCard.favorite ? '즐겨찾기 해제' : '즐겨찾기'}</button>
                  <button onClick={() => beginEdit(selectedCard)}><Icon name="settings" />편집</button>
                  <button onClick={() => insertCard(selectedCard)}><Icon name="send" />메모에 삽입</button>
                  <button onClick={() => exportVCard([selectedCard])}><Icon name="card" />vCard</button>
                  <button onClick={() => addMeetingPrompt(selectedCard)}><Icon name="clock" />미팅 추가</button>
                  <button className="danger" onClick={() => removeSelected(selectedCard)}><Icon name="trash" />삭제</button>
                </div>
              </div>
            ) : (
              <div className="jan-cards-empty detail">
                <Icon name="user" size={32} />
                <strong>명함을 선택하세요</strong>
                <span>상세 보기, 메모 삽입, vCard 내보내기를 여기서 처리합니다.</span>
              </div>
            )}
          </aside>
        </div>

        {status && <div className="jan-settings-status jan-cards-status">{status}</div>}
        <input ref={importInputRef} type="file" accept=".csv,.vcf,text/csv,text/vcard" onChange={handleImport} hidden />
      </div>
    </div>
  )
}
