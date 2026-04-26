import { useState, useRef, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { Icon } from './Icons'

interface WebBrowserModalProps {
  editor: Editor | null
  onClose: () => void
}

interface ResultItem {
  title: string
  url: string
  snippet: string
}
interface PreviewData {
  url: string
  title: string
  html: string
  images: string[]
  tables: string[]
  text: string
}

const fetchViaProxy = async (target: string): Promise<string> => {
  const r = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(target))
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const t = await r.text()
  if (t.length < 100) throw new Error('짧은 응답')
  return t
}

/* DuckDuckGo HTML 검색 — 파서 친화적 마크업 */
const ENGINES: Record<string, { label: string; searchUrl: (q: string) => string; parse: (doc: Document) => ResultItem[] }> = {
  ddg: {
    label: 'DuckDuckGo',
    searchUrl: (q) => 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q),
    parse: (doc) => Array.from(doc.querySelectorAll('.result')).map((el) => {
      let url = (el.querySelector('.result__url') as HTMLAnchorElement)?.href || ''
      /* DDG 우회 URL 제거 */
      const m = url.match(/uddg=([^&]+)/); if (m) url = decodeURIComponent(m[1])
      return {
        title: (el.querySelector('.result__title')?.textContent || '').trim(),
        url: url.replace(/^\/\//, 'https://'),
        snippet: (el.querySelector('.result__snippet')?.textContent || '').trim(),
      }
    }).filter(r => r.title && r.url).slice(0, 15),
  },
  wiki: {
    label: 'Wikipedia',
    searchUrl: (q) => 'https://ko.wikipedia.org/w/api.php?action=opensearch&search=' + encodeURIComponent(q) + '&limit=15&format=json',
    parse: (doc) => {
      try {
        const data = JSON.parse(doc.body.textContent || '[]')
        const titles = data[1] || [], descs = data[2] || [], urls = data[3] || []
        return titles.map((t: string, i: number) => ({ title: t, url: urls[i] || '', snippet: descs[i] || '' }))
      } catch { return [] }
    },
  },
  namu: {
    label: '나무위키',
    searchUrl: (q) => 'https://namu.wiki/Search?q=' + encodeURIComponent(q),
    parse: (doc) => Array.from(doc.querySelectorAll('article a, .search-result a')).map((a) => ({
      title: (a.textContent || '').trim(),
      url: 'https://namu.wiki' + ((a as HTMLAnchorElement).getAttribute('href') || ''),
      snippet: '',
    })).filter(r => r.title && r.title.length > 1).slice(0, 15),
  },
  gh: {
    label: 'GitHub',
    searchUrl: (q) => 'https://github.com/search?q=' + encodeURIComponent(q) + '&type=repositories',
    parse: (doc) => Array.from(doc.querySelectorAll('article, [data-testid="results-list"] li, .search-title')).map((el) => {
      const a = el.querySelector('a[href*="/"]') as HTMLAnchorElement
      return {
        title: (a?.textContent || el.textContent || '').trim().slice(0, 80),
        url: a?.href || '',
        snippet: (el.querySelector('p')?.textContent || '').trim().slice(0, 200),
      }
    }).filter(r => r.title && r.url).slice(0, 15),
  },
}

/**
 * Phase 35 — 인앱 웹 브라우저 = "웹 리서치 어시스턴트".
 * 검색 → 결과 리스트 → 클릭 시 콘텐츠 추출 → 이미지/표/본문 선택 삽입.
 * iframe 으로 페이지 직접 보여주는 게 아니라 콘텐츠를 깨끗하게 노트에 가져오는 것이 목적.
 */
export function WebBrowserModal({ editor, onClose }: WebBrowserModalProps) {
  const [query, setQuery] = useState('')
  const [engine, setEngine] = useState<keyof typeof ENGINES>('ddg')
  const [results, setResults] = useState<ResultItem[]>([])
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [view, setView] = useState<'idle' | 'results' | 'preview'>('idle')
  const [busy, setBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [selectedImgs, setSelectedImgs] = useState<Set<number>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const insertHTML = (html: string) => editor?.chain().focus().insertContent(html).run()

  /* === 검색 실행 === */
  const search = async (q?: string) => {
    const Q = (q || query).trim()
    if (!Q) return
    setQuery(Q)
    setBusy(true)
    setStatusMsg(`${ENGINES[engine].label} 에서 "${Q}" 검색 중...`)
    setResults([])
    setPreview(null)
    setView('results')
    try {
      const html = await fetchViaProxy(ENGINES[engine].searchUrl(Q))
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const items = ENGINES[engine].parse(doc)
      setResults(items)
      setStatusMsg(`${items.length}개 결과 발견 — 클릭하면 본문 미리보기`)
    } catch (e: any) {
      setStatusMsg('검색 실패: ' + e.message)
    } finally { setBusy(false) }
  }

  /* === 결과 클릭 → 본문 추출 === */
  const loadResult = async (r: ResultItem) => {
    setBusy(true)
    setStatusMsg(`"${r.title.slice(0, 40)}" 본문 추출 중...`)
    try {
      const html = await fetchViaProxy(r.url)
      const doc = new DOMParser().parseFromString(html, 'text/html')
      doc.querySelectorAll('script,style,iframe,form,nav[role=navigation],aside,.ad,.ads,.advertisement').forEach(e => e.remove())
      const article = (doc.querySelector('article, main, [role=main], .mw-parser-output, .markdown-body') || doc.body) as HTMLElement
      const text = (article.textContent || '').trim().slice(0, 5000)
      const images = Array.from(article.querySelectorAll('img')).map(i => (i as HTMLImageElement).src || (i as HTMLImageElement).getAttribute('data-src') || '').filter(s => s.startsWith('http'))
      const tables = Array.from(article.querySelectorAll('table')).map(t => t.outerHTML)
      setPreview({
        url: r.url,
        title: doc.title || r.title,
        html: article.innerHTML.slice(0, 30000),
        images,
        tables,
        text,
      })
      setSelectedImgs(new Set())
      setView('preview')
      setStatusMsg(`이미지 ${images.length}개 · 표 ${tables.length}개 발견`)
    } catch (e: any) {
      setStatusMsg('추출 실패: ' + e.message + ' — "외부" 버튼으로 새 탭에서 열기')
    } finally { setBusy(false) }
  }

  const backToResults = () => { setView('results'); setPreview(null) }
  const openExternal = (u?: string) => {
    const t = u || preview?.url || ENGINES[engine].searchUrl(query)
    window.open(t, '_blank', 'noopener,noreferrer')
  }

  /* === 노트 삽입 === */
  const insertLinkCard = (r?: ResultItem) => {
    const t = r ? r : (preview ? { title: preview.title, url: preview.url, snippet: preview.text.slice(0, 200) } : null)
    if (!t) return
    insertHTML(`<div style="border:1px solid #ddd;border-radius:8px;padding:1em;margin:1em 0;background:#fafafa;"><a href="${t.url}" target="_blank" style="font-weight:600;text-decoration:none;color:#1a73e8;font-size:1.05em;">${t.title}</a><div style="color:#666;font-size:0.9em;margin:0.4em 0;">${t.snippet}</div><div style="font-size:0.8em;color:#999;font-family:monospace;">${t.url}</div></div>`)
    setStatusMsg('링크 카드 노트에 삽입됨')
  }
  const insertReaderContent = () => {
    if (!preview) return
    insertHTML(`<h2>${preview.title}</h2>${preview.html}<p><em>출처: <a href="${preview.url}" target="_blank">${preview.url}</a></em></p>`)
    setStatusMsg('본문 노트에 삽입됨')
  }
  const insertSelectedImages = () => {
    if (!preview || !selectedImgs.size) return alert('이미지를 선택하세요')
    const html = Array.from(selectedImgs).map(i => `<img src="${preview.images[i]}" style="max-width:100%;margin:0.4em 0;" />`).join('')
    insertHTML(html + `<p><em>이미지 출처: <a href="${preview.url}" target="_blank">${preview.url}</a></em></p>`)
    setStatusMsg(`이미지 ${selectedImgs.size}개 삽입됨`)
  }
  const insertAllImages = () => {
    if (!preview || !preview.images.length) return
    const html = preview.images.map(s => `<img src="${s}" style="max-width:100%;margin:0.4em 0;" />`).join('')
    insertHTML(html + `<p><em>출처: <a href="${preview.url}" target="_blank">${preview.url}</a></em></p>`)
    setStatusMsg(`전체 이미지 ${preview.images.length}개 삽입됨`)
  }
  const insertTable = (i: number) => {
    if (!preview || !preview.tables[i]) return
    insertHTML(preview.tables[i] + `<p><em>표 출처: <a href="${preview.url}" target="_blank">${preview.url}</a></em></p>`)
    setStatusMsg(`표 #${i+1} 삽입됨`)
  }
  const insertSnippet = () => {
    if (!preview) return
    const text = window.prompt('인용할 내용 (본문에서 직접 복사 권장):', preview.text.slice(0, 300))
    if (text) insertHTML(`<blockquote style="border-left:3px solid #FAE100;padding:0.4em 0.8em;margin:0.8em 0;background:#FFFBE5;">${text}<br><cite style="font-size:0.85em;color:#888;">— <a href="${preview.url}" target="_blank">${preview.title}</a></cite></blockquote>`)
  }
  const toggleImg = (i: number) => {
    setSelectedImgs(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })
  }

  return (
    <div className="jan-modal-bg" role="dialog" aria-label="웹 리서치" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="jan-web-browser">
        <div className="jan-wb-header">
          <h3><Icon name="globe" size={16} /><span>웹 리서치 — 검색 후 노트에 깨끗하게 삽입</span></h3>
          <button className="jan-wb-close" onClick={onClose} title="닫기 (Esc)" aria-label="닫기">×</button>
        </div>

        {/* 검색 바 */}
        <div className="jan-wb-toolbar">
          {view === 'preview' && (
            <button className="jan-wb-btn" onClick={backToResults} title="결과로 돌아가기"><Icon name="chevron-left" /> 결과</button>
          )}
          <select className="jan-wb-input" style={{ flex: '0 0 140px' }} value={engine} onChange={(e) => setEngine(e.target.value as any)}>
            {Object.entries(ENGINES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input
            ref={inputRef}
            className="jan-wb-input"
            placeholder="검색어 입력 후 Enter — 결과 리스트가 모달에 직접 표시됩니다"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search() }}
          />
          <button className="jan-wb-btn primary" onClick={() => search()} disabled={busy}>{busy ? '검색 중...' : '검색'}</button>
          <button className="jan-wb-btn" onClick={() => openExternal()} title="외부 브라우저에서 열기"><Icon name="globe" /> 외부</button>
        </div>

        {/* 상태 메시지 */}
        {statusMsg && (
          <div className="jan-wb-research" style={{ background: busy ? '#fff8c4' : '#faf7ff' }}>
            <span className="jan-wb-label" style={{ color: '#6a4cbb' }}>상태:</span>
            <span style={{ fontSize: 12, color: '#333' }}>{statusMsg}</span>
          </div>
        )}

        {/* 본문 */}
        <div className="jan-wb-body">
          {view === 'idle' && (
            <div className="jan-wb-placeholder">
              <Icon name="globe" size={70} />
              <h4>웹 리서치 어시스턴트</h4>
              <p>위 검색창에 키워드를 입력하면 결과가 카드 리스트로 직접 표시됩니다.<br />
                각 결과를 클릭하면 본문·이미지·표를 선택해 노트에 깨끗하게 삽입할 수 있습니다.</p>
              <p className="muted">
                <strong>지원 엔진:</strong> DuckDuckGo · Wikipedia · 나무위키 · GitHub<br />
                <strong>인앱 작업:</strong> 링크 카드 / 본문 추출 / 이미지 다중 선택 / 표 선택 / 인용 박스
              </p>
            </div>
          )}

          {view === 'results' && (
            <div className="jan-wb-results">
              {results.length === 0 && !busy && <div className="jan-wb-empty">결과 없음</div>}
              {results.map((r, i) => (
                <div key={i} className="jan-wb-result-item">
                  <div className="jan-wb-result-main">
                    <a className="jan-wb-result-title" href={r.url} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); loadResult(r) }}>
                      {r.title}
                    </a>
                    {r.snippet && <div className="jan-wb-result-snippet">{r.snippet}</div>}
                    <div className="jan-wb-result-url">{r.url}</div>
                  </div>
                  <div className="jan-wb-result-actions">
                    <button className="jan-wb-btn small" onClick={() => loadResult(r)} title="본문 미리보기로 들어가기"><Icon name="file-text" size={12} /> 미리보기</button>
                    <button className="jan-wb-btn small action" onClick={() => insertLinkCard(r)} title="이 결과를 링크 카드로 노트에 삽입"><Icon name="link" size={12} /> 링크 카드</button>
                    <button className="jan-wb-btn small" onClick={() => openExternal(r.url)} title="외부 브라우저"><Icon name="globe" size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'preview' && preview && (
            <div className="jan-wb-preview">
              <div className="jan-wb-preview-actions">
                <button className="jan-wb-btn primary" onClick={insertReaderContent}><Icon name="file-text" size={14} /> 본문 통째 삽입</button>
                <button className="jan-wb-btn action" onClick={() => insertLinkCard()}><Icon name="link" size={14} /> 링크 카드 삽입</button>
                <button className="jan-wb-btn action" onClick={insertSnippet}><Icon name="quote" size={14} /> 발췌 인용</button>
                <span style={{ flex: 1 }} />
                <button className="jan-wb-btn" onClick={() => openExternal(preview.url)}><Icon name="globe" /> 외부 열기</button>
              </div>

              <h2 className="jan-wb-preview-title">{preview.title}</h2>
              <div className="jan-wb-preview-url">{preview.url}</div>

              {preview.images.length > 0 && (
                <div className="jan-wb-section">
                  <div className="jan-wb-section-head">
                    <span><strong>이미지</strong> {preview.images.length}개 — 클릭으로 선택</span>
                    <button className="jan-wb-btn small" onClick={insertSelectedImages} disabled={!selectedImgs.size}>선택 {selectedImgs.size}개 삽입</button>
                    <button className="jan-wb-btn small action" onClick={insertAllImages}>전체 삽입</button>
                  </div>
                  <div className="jan-wb-img-grid">
                    {preview.images.slice(0, 24).map((src, i) => (
                      <div key={i} className={'jan-wb-img-cell' + (selectedImgs.has(i) ? ' selected' : '')} onClick={() => toggleImg(i)}>
                        <img src={src} alt="" loading="lazy" />
                        {selectedImgs.has(i) && <div className="jan-wb-img-check"><Icon name="check" size={16} /></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.tables.length > 0 && (
                <div className="jan-wb-section">
                  <div className="jan-wb-section-head"><span><strong>표</strong> {preview.tables.length}개 — 번호로 선택</span></div>
                  <div className="jan-wb-tables">
                    {preview.tables.slice(0, 5).map((_, i) => (
                      <button key={i} className="jan-wb-btn small action" onClick={() => insertTable(i)}>표 #{i + 1} 삽입</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="jan-wb-section">
                <div className="jan-wb-section-head"><strong>본문 미리보기</strong> ({preview.text.length} 자)</div>
                <div className="jan-wb-preview-html" dangerouslySetInnerHTML={{ __html: preview.html }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
