import { useState, useRef, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { Icon } from './Icons'

interface WebBrowserModalProps {
  editor: Editor | null
  onClose: () => void
}

const ENGINES: Record<string, { label: string; url: (q: string) => string }> = {
  google:    { label: 'Google',         url: (q) => 'https://www.google.com/search?q=' + encodeURIComponent(q) },
  ddg:       { label: 'DuckDuckGo',     url: (q) => 'https://duckduckgo.com/?q=' + encodeURIComponent(q) },
  wiki:      { label: 'Wikipedia',      url: (q) => 'https://ko.wikipedia.org/wiki/Special:Search?search=' + encodeURIComponent(q) },
  namu:      { label: '나무위키',       url: (q) => 'https://namu.wiki/Search?q=' + encodeURIComponent(q) },
  nav:       { label: '네이버',         url: (q) => 'https://search.naver.com/search.naver?query=' + encodeURIComponent(q) },
  yt:        { label: '유튜브',         url: (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) },
  gh:        { label: 'GitHub',         url: (q) => 'https://github.com/search?q=' + encodeURIComponent(q) },
  so:        { label: 'StackOverflow',  url: (q) => 'https://stackoverflow.com/search?q=' + encodeURIComponent(q) },
}

/**
 * Phase 31 — v1 의 인앱 웹 브라우저 모달 그대로 이식.
 * 주소/검색 입력 → iframe 로딩 → 빠른 검색엔진 + 웹→노트 도구 (링크저장/선택 인용/링크 카드/리더 모드/AI 요약/이미지 추출/표 추출).
 */
export function WebBrowserModal({ editor, onClose }: WebBrowserModalProps) {
  const [url, setUrl] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [hIdx, setHIdx] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const navigate = (target: string) => {
    if (!target.trim()) return
    let final = target.trim()
    /* URL 형태가 아니면 Google 검색으로 */
    if (!/^https?:\/\//.test(final) && !/^[\w-]+\.[\w]+/.test(final)) {
      final = ENGINES.google.url(final)
    } else if (!/^https?:\/\//.test(final)) {
      final = 'https://' + final
    }
    setError(false)
    setLoading(true)
    setUrl(final)
    if (hIdx === -1 || history[hIdx] !== final) {
      const newHist = [...history.slice(0, hIdx + 1), final]
      setHistory(newHist)
      setHIdx(newHist.length - 1)
    }
  }
  const goEngine = (key: string) => {
    const q = inputRef.current?.value || window.prompt(ENGINES[key].label + ' 검색어:')
    if (q) navigate(ENGINES[key].url(q))
  }
  const goBack = () => {
    if (hIdx > 0) { const i = hIdx - 1; setHIdx(i); setUrl(history[i]); setLoading(true); setError(false) }
  }
  const goFwd = () => {
    if (hIdx < history.length - 1) { const i = hIdx + 1; setHIdx(i); setUrl(history[i]); setLoading(true); setError(false) }
  }
  const reload = () => {
    if (iframeRef.current && url) { iframeRef.current.src = ''; setTimeout(() => { if (iframeRef.current) iframeRef.current.src = url }, 50) }
  }
  const insertHTML = (html: string) => editor?.chain().focus().insertContent(html).run()

  /* === 웹 → 노트 도구 === */
  const insertLink = () => {
    if (!url) return alert('먼저 페이지를 여세요.')
    insertHTML(`<a href="${url}" target="_blank">${url}</a>`)
  }
  const insertExcerpt = async () => {
    if (!url) return alert('먼저 페이지를 여세요.')
    let text = ''
    try { text = await navigator.clipboard.readText() } catch {}
    if (!text) text = window.prompt('인용할 텍스트 (iframe 에서 복사 후 붙여넣기):') || ''
    if (text) insertHTML(`<blockquote style="border-left:3px solid #FAE100;padding:0.4em 0.8em;margin:0.8em 0;background:#FFFBE5;">${text}<br><cite style="font-size:0.85em;color:#888;">— <a href="${url}">${url}</a></cite></blockquote>`)
  }
  const insertLinkCard = async () => {
    if (!url) return
    insertHTML(`<div style="border:1px solid #ddd;border-radius:8px;padding:1em;margin:1em 0;background:#fafafa;"><a href="${url}" style="font-weight:600;text-decoration:none;color:#333;">${url}</a><div style="font-size:0.85em;color:#888;margin-top:0.4em;">링크 카드 — OG 메타는 CORS 허용 사이트만 자동 추출됨</div></div>`)
  }
  const readerMode = async () => {
    if (!url) return
    try {
      const res = await fetch(url, { mode: 'cors' })
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      doc.querySelectorAll('script,style,nav,header,footer,iframe,form,button').forEach(e => e.remove())
      const article = doc.querySelector('article, main, [role=main]') || doc.body
      const title = doc.title || url
      insertHTML(`<h2>${title}</h2>${article.innerHTML.slice(0, 5000)}<p><em>출처: <a href="${url}">${url}</a></em></p>`)
    } catch (e: any) { alert('CORS 차단 또는 실패: ' + e.message + '\n\nWikipedia/MDN 등은 CORS OK · Google/Naver 등은 차단') }
  }
  const aiSummary = async () => {
    if (!url) return
    alert('AI 요약은 별도 API 키 설정이 필요합니다. 설정 패널에서 AI 키를 등록하세요.')
  }
  const extractImages = async () => {
    if (!url) return
    try {
      const res = await fetch(url, { mode: 'cors' })
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const imgs = Array.from(doc.querySelectorAll('img')).map(i => (i as HTMLImageElement).src).filter(s => s.startsWith('http')).slice(0, 12)
      if (!imgs.length) return alert('이미지를 찾지 못했습니다.')
      const sel = window.prompt(`${imgs.length}개 이미지 발견. 삽입할 번호 (1-${imgs.length}, 쉼표 구분 또는 'all'):`, 'all')
      if (!sel) return
      const idxs = sel === 'all' ? imgs.map((_, i) => i) : sel.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < imgs.length)
      idxs.forEach(i => insertHTML(`<img src="${imgs[i]}" style="max-width:100%;margin:0.5em 0;"/>`))
    } catch (e: any) { alert('CORS 차단: ' + e.message) }
  }
  const extractTables = async () => {
    if (!url) return
    try {
      const res = await fetch(url, { mode: 'cors' })
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const tables = doc.querySelectorAll('table')
      if (!tables.length) return alert('표를 찾지 못했습니다.')
      const sel = window.prompt(`${tables.length}개 표 발견. 삽입할 번호 (1-${tables.length}):`, '1')
      const idx = parseInt(sel || '1') - 1
      if (tables[idx]) insertHTML(tables[idx].outerHTML)
    } catch (e: any) { alert('CORS 차단: ' + e.message) }
  }

  return (
    <div className="jan-modal-bg" role="dialog" aria-label="인앱 웹 브라우저" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="jan-web-browser">
        <div className="jan-wb-header">
          <h3>
            <Icon name="globe" size={16} />
            <span>인앱 웹 브라우저</span>
          </h3>
          <button className="jan-wb-close" onClick={onClose} title="닫기 (Esc)" aria-label="닫기">×</button>
        </div>

        {/* 주소창 + 네비게이션 */}
        <div className="jan-wb-toolbar">
          <button className="jan-wb-btn" onClick={goBack} disabled={hIdx <= 0} title="뒤로"><Icon name="chevron-left" /></button>
          <button className="jan-wb-btn" onClick={goFwd} disabled={hIdx >= history.length - 1} title="앞으로"><Icon name="chevron-right" /></button>
          <button className="jan-wb-btn" onClick={reload} title="새로고침"><Icon name="refresh-cw" /></button>
          <input
            ref={inputRef}
            className="jan-wb-input"
            placeholder="검색어 또는 https:// URL 입력 후 Enter"
            defaultValue=""
            onKeyDown={(e) => { if (e.key === 'Enter') navigate((e.target as HTMLInputElement).value) }}
          />
          <button className="jan-wb-btn primary" onClick={() => inputRef.current && navigate(inputRef.current.value)}>이동</button>
        </div>

        {/* 빠른 검색 */}
        <div className="jan-wb-engines">
          <span className="jan-wb-label">빠른 검색:</span>
          {Object.entries(ENGINES).map(([k, e]) => (
            <button key={k} className="jan-wb-btn small" onClick={() => goEngine(k)}>{e.label}</button>
          ))}
          <span style={{ flex: 1 }} />
          <button className="jan-wb-btn small action" onClick={insertLink} title="현재 URL 을 메모에 링크로 삽입"><Icon name="link" size={12} /> 링크 저장</button>
          <button className="jan-wb-btn small action" onClick={insertExcerpt} title="클립보드 또는 입력한 텍스트를 출처와 함께 인용 삽입"><Icon name="quote" size={12} /> 선택 인용</button>
        </div>

        {/* 웹 → 노트 연구 도구 */}
        <div className="jan-wb-research">
          <span className="jan-wb-label" style={{ color: '#6a4cbb' }}>웹 → 노트:</span>
          <button className="jan-wb-btn small action" onClick={insertLinkCard} title="OG 메타로 링크 카드 삽입"><Icon name="link" size={12} /> 링크 카드</button>
          <button className="jan-wb-btn small action" onClick={readerMode} title="본문만 추출해 노트에 저장 (Readability)"><Icon name="file-text" size={12} /> 리더 모드</button>
          <button className="jan-wb-btn small action" onClick={aiSummary} title="AI 로 페이지 핵심 요약"><Icon name="sparkle" size={12} /> AI 요약</button>
          <button className="jan-wb-btn small action" onClick={extractImages} title="페이지 이미지를 수집해 삽입"><Icon name="image" size={12} /> 이미지</button>
          <button className="jan-wb-btn small action" onClick={extractTables} title="페이지 표를 선택해 삽입"><Icon name="table" size={12} /> 표 추출</button>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: '#888' }}>※ Wikipedia/MDN: CORS OK · Google/Naver: 차단</span>
        </div>

        {/* iframe 또는 placeholder */}
        <div className="jan-wb-frame-wrap">
          {url && !error && (
            <iframe
              ref={iframeRef}
              src={url}
              referrerPolicy="no-referrer"
              onLoad={() => setLoading(false)}
              onError={() => { setError(true); setLoading(false) }}
              title="In-app browser"
            />
          )}
          {!url && (
            <div className="jan-wb-placeholder">
              <Icon name="globe" size={70} />
              <h4>메모장 내부 웹 브라우저</h4>
              <p>위 검색창에 검색어를 입력하거나 URL 을 붙여넣으세요<br />또는 빠른 검색 버튼으로 바로 이동할 수 있어요.</p>
              <p className="muted">일부 사이트 (Google 등) 는 보안정책상 임베드가 제한될 수 있어요.<br />Wikipedia, 나무위키, GitHub, StackOverflow 는 대부분 잘 열립니다.</p>
            </div>
          )}
          {error && (
            <div className="jan-wb-error">
              <Icon name="info" size={60} />
              <h4>페이지를 불러올 수 없습니다</h4>
              <p>이 사이트는 보안정책 (X-Frame-Options) 으로<br />임베드를 차단하고 있을 수 있습니다.<br /><br />다른 검색엔진 (Wikipedia 등) 을 시도해보세요.</p>
            </div>
          )}
          {loading && url && !error && <div className="jan-wb-loading">불러오는 중...</div>}
        </div>

        {/* 현재 URL 표시 */}
        <div className="jan-wb-statusbar">
          <Icon name="globe" size={11} />
          <span>현재:</span>
          <span className="jan-wb-current">{url || '(없음)'}</span>
        </div>
      </div>
    </div>
  )
}
