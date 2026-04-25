import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useSettingsStore } from '../store/settingsStore'
import { formatBibEntry, formatInline, type Citation, type CitationStyle } from '../lib/citationFormat'

interface PaperPanelProps {
  editor: Editor | null
  onClose: () => void
}

const EMPTY: Citation = { id: '', authors: [''], title: '', year: '' }

/**
 * Phase 5 — 논문 모드 패널.
 * 인용 추가/편집 → APA/IEEE/MLA 본문 인라인 + Bibliography 섹션 자동 삽입.
 *
 * 인용 데이터는 메모 별로 저장되지 않고 (Phase 5 범위 외) — 패널 내 세션 상태만.
 * 추후 메모 metadata 로 영속화 가능.
 */
export function PaperPanel({ editor, onClose }: PaperPanelProps) {
  const style = useSettingsStore((s) => s.citationStyle)
  const setStyle = (st: CitationStyle) => useSettingsStore.getState().setKey('citationStyle', st)
  const [cites, setCites] = useState<Citation[]>([])
  const [draft, setDraft] = useState<Citation>({ ...EMPTY })

  if (!editor) return null

  function add() {
    if (!draft.title.trim()) return
    const c: Citation = { ...draft, id: 'c' + Date.now() }
    setCites((cs) => [...cs, c])
    setDraft({ ...EMPTY })
  }
  function remove(idx: number) {
    setCites((cs) => cs.filter((_, i) => i !== idx))
  }

  function insertInline(idx: number) {
    if (!editor) return
    const tag = formatInline(cites[idx], style, idx)
    editor.chain().focus().insertContent(`<sup>${tag}</sup>`).run()
  }

  function insertBibliography() {
    if (!editor || cites.length === 0) return
    const lines = cites
      .map((c, i) => `<p style="text-indent:-2em;padding-left:2em;">${formatBibEntry(c, style, i)}</p>`)
      .join('')
    const html = `<h2>References</h2>${lines}`
    editor.chain().focus().insertContent(html).run()
    onClose()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-paper-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>논문 모드 — 인용 관리</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-paper-style-row">
            <span>인용 스타일:</span>
            {(['apa', 'ieee', 'mla'] as CitationStyle[]).map((s) => (
              <button
                key={s}
                className={'jan-paper-style' + (style === s ? ' is-active' : '')}
                onClick={() => setStyle(s)}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="jan-paper-form">
            <input
              placeholder="저자 (쉼표 구분: John Doe, Jane Smith)"
              value={draft.authors.join(', ')}
              onChange={(e) => setDraft({ ...draft, authors: e.target.value.split(',').map((s) => s.trim()) })}
            />
            <div className="jan-paper-row">
              <input
                placeholder="연도"
                value={draft.year || ''}
                onChange={(e) => setDraft({ ...draft, year: e.target.value })}
                style={{ width: 80 }}
              />
              <input
                placeholder="제목"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>
            <input
              placeholder="저널/책/학회명"
              value={draft.venue || ''}
              onChange={(e) => setDraft({ ...draft, venue: e.target.value })}
            />
            <div className="jan-paper-row">
              <input placeholder="vol" value={draft.volume || ''} onChange={(e) => setDraft({ ...draft, volume: e.target.value })} style={{ width: 70 }} />
              <input placeholder="no" value={draft.issue || ''} onChange={(e) => setDraft({ ...draft, issue: e.target.value })} style={{ width: 70 }} />
              <input placeholder="페이지 (12-34)" value={draft.pages || ''} onChange={(e) => setDraft({ ...draft, pages: e.target.value })} style={{ flex: 1 }} />
            </div>
            <input placeholder="DOI 또는 URL" value={draft.doi || draft.url || ''} onChange={(e) => setDraft({ ...draft, doi: e.target.value })} />
            <button className="jan-paper-add" onClick={add}>인용 추가</button>
          </div>

          <div className="jan-paper-list">
            {cites.length === 0 && <div className="jan-paper-empty">인용을 추가하세요.</div>}
            {cites.map((c, i) => (
              <div key={c.id} className="jan-paper-item">
                <div className="jan-paper-num">[{i + 1}]</div>
                <div className="jan-paper-text">{formatBibEntry(c, style, i)}</div>
                <button onClick={() => insertInline(i)} title="본문에 인라인 인용 삽입">본문 인용</button>
                <button onClick={() => remove(i)} title="삭제">×</button>
              </div>
            ))}
          </div>

          <button className="jan-paper-bib" onClick={insertBibliography} disabled={cites.length === 0}>
            References 섹션 삽입 ({cites.length})
          </button>
        </div>
      </div>
    </div>
  )
}
