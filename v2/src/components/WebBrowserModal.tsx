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

const CORS_PROXIES = [
  (u: string) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
]
const NEEDS_PROXY = ['google.', 'naver.com', 'daum.net', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'amazon.', 'linkedin.com', 'pinterest.com']
const needsProxy = (url: string) => {
  try { const u = new URL(url); return NEEDS_PROXY.some(d => u.hostname.includes(d)) } catch { return false }
}

const sanitizeForSrcdoc = (html: string, baseUrl: string): string => {
  const base = `<base href="${baseUrl}" target="_blank">`
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + base)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + '<head>' + base + '</head>')
  return '<head>' + base + '</head>' + html
}

const fetchViaProxy = async (target: string): Promise<string> => {
  let lastErr: any
  for (const mk of CORS_PROXIES) {
    try {
      const r = await fetch(mk(target))
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const t = await r.text()
      if (t.length < 100) throw new Error('짧은 응답')
      return t
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('모든 프록시 실패')
}

/**
 * Phase 34 — 단일 iframe + 직접 DOM 조작.
 * React state 통한 src/srcdoc 전환 race condition 회피.
 */
export function WebBrowserModal({ editor, onClose }: WebBrowserModalProps) {
  const [currentUrl, setCurrentUrl] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [hIdx, setHIdx] = useState(-1)
  const [statusMsg, setStatusMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  /* === 핵심 navigate: 단일 iframe + 직접 DOM 조작 === */
  const navigate = async (target: string) => {
    if (!target.trim()) return
    let final = target.trim()
    if (!/^https?:\/\//.test(final) && !/^[\w-]+\.[\w]+/.test(final)) {
      final = ENGINES.google.url(final)
    } else if (!/^https?:\/\//.test(final)) {
      final = 'https://' + final
    }

    setCurrentUrl(final)
    if (hIdx === -1 || history[hIdx] !== final) {
      const h = [...history.slice(0, hIdx + 1), final]; setHistory(h); setHIdx(h.length - 1)
    }

    const ifr = iframeRef.current
    if (!ifr) return

    setLoading(true)
    if (needsProxy(final)) {
      setStatusMsg('iframe 차단 사이트 — CORS 프록시로 로딩 중...')
      try {
        const html = await fetchViaProxy(final)
        const safe = sanitizeForSrcdoc(html, final)
        ifr.removeAttribute('src')
        ifr.srcdoc = safe
        setStatusMsg(`CORS 프록시로 로딩됨 (${(safe.length / 1024).toFixed(0)} KB · 동적 콘텐츠 일부 제한)`)
      } catch (e: any) {
        setStatusMsg('프록시 실패 — 외부 브라우저로 열기 권장: ' + e.message)
        ifr.removeAttribute('srcdoc')
        ifr.src = 'about:blank'
      }
    } else {
      setStatusMsg('인앱 iframe 로딩 중...')
      ifr.removeAttribute('srcdoc')
      ifr.src = final
    }
    setLoading(false)
  }
  const onIframeLoad = () => {
    if (!statusMsg.includes('CORS')) setStatusMsg('인앱 로딩 완료')
  }

  const goEngine = (key: string) => {
    const q = inputRef.current?.value || window.prompt(ENGINES[key].label + ' 검색어:')
    if (q) navigate(ENGINES[key].url(q))
  }
  const goBack = () => { if (hIdx > 0) { const i = hIdx - 1; setHIdx(i); navigate(history[i]) } }
  const goFwd = () => { if (hIdx < history.length - 1) { const i = hIdx + 1; setHIdx(i); navigate(history[i]) } }
  const reload = () => { if (currentUrl) navigate(currentUrl) }
  const openExternal = () => {
    const t = currentUrl || inputRef.current?.value
    if (!t) return alert('URL 이 없습니다.')
    let f = t.trim(); if (!/^https?:\/\//.test(f)) f = 'https://' + f
    window.open(f, '_blank', 'noopener,noreferrer')
  }
  const insertHTML = (html: string) => editor?.chain().focus().insertContent(html).run()

  /* === 웹 → 노트 === */
  const insertLink = () => {
    if (!currentUrl) return alert('먼저 페이지를 여세요.')
    insertHTML(`<a href="${currentUrl}" target="_blank">${currentUrl}</a>`)
  }
  const insertExcerpt = async () => {
    if (!currentUrl) return alert('먼저 페이지를 여세요.')
    let text = ''
    try { text = await navigator.clipboard.readText() } catch {}
    if (!text) text = window.prompt('인용할 텍스트:') || ''
    if (text) insertHTML(`<blockquote style="border-left:3px solid #FAE100;padding:0.4em 0.8em;margin:0.8em 0;background:#FFFBE5;">${text}<br><cite style="font-size:0.85em;color:#888;">— <a href="${currentUrl}">${currentUrl}</a></cite></blockquote>`)
  }
  const insertLinkCard = () => {
    if (!currentUrl) return
    insertHTML(`<div style="border:1px solid #ddd;border-radius:8px;padding:1em;margin:1em 0;background:#fafafa;"><a href="${currentUrl}" style="font-weight:600;text-decoration:none;color:#333;">${currentUrl}</a></div>`)
  }
  const readerMode = async () => {
    if (!currentUrl) return
    try {
      const html = await fetchViaProxy(currentUrl)
      const doc = new DOMParser().parseFromString(html, 'text/html')
      doc.querySelectorAll('script,style,nav,header,footer,iframe,form,button').forEach(e => e.remove())
      const article = doc.querySelector('article, main, [role=main]') || doc.body
      const title = doc.title || currentUrl
      insertHTML(`<h2>${title}</h2>${article.innerHTML.slice(0, 5000)}<p><em>출처: <a href="${currentUrl}">${currentUrl}</a></em></p>`)
    } catch (e: any) { alert('실패: ' + e.message) }
  }
  const aiSummary = () => alert('AI 요약은 별도 API 키 설정이 필요합니다.')
  const extractImages = async () => {
    if (!currentUrl) return
    try {
      const html = await fetchViaProxy(currentUrl)
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const imgs = Array.from(doc.querySelectorAll('img')).map(i => (i as HTMLImageElement).src).filter(s => s.startsWith('http')).slice(0, 12)
      if (!imgs.length) return alert('이미지 없음.')
      const sel = window.prompt(`${imgs.length}개. 번호 (쉼표 또는 'all'):`, 'all')
      if (!sel) return
      const idxs = sel === 'all' ? imgs.map((_, i) => i) : sel.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < imgs.length)
      idxs.forEach(i => insertHTML(`<img src="${imgs[i]}" style="max-width:100%;margin:0.5em 0;"/>`))
    } catch (e: any) { alert('실패: ' + e.message) }
  }
  const extractTables = async () => {
    if (!currentUrl) return
    try {
      const html = await fetchViaProxy(currentUrl)
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const tables = doc.querySelectorAll('table')
      if (!tables.length) return alert('표 없음.')
      const sel = window.prompt(`${tables.length}개. 번호:`, '1')
      const idx = parseInt(sel || '1') - 1
      if (tables[idx]) insertHTML(tables[idx].outerHTML)
    } catch (e: any) { alert('실패: ' + e.message) }
  }

  return (
    <div className="jan-modal-bg" role="dialog" aria-label="인앱 웹 브라우저" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="jan-web-browser">
        <div className="jan-wb-header">
          <h3><Icon name="globe" size={16} /><span>인앱 웹 브라우저</span></h3>
          <button className="jan-wb-close" onClick={onClose} title="닫기 (Esc)" aria-label="닫기">×</button>
        </div>

        <div className="jan-wb-toolbar">
          <button className="jan-wb-btn" onClick={goBack} disabled={hIdx <= 0} title="뒤로"><Icon name="chevron-left" /></button>
          <button className="jan-wb-btn" onClick={goFwd} disabled={hIdx >= history.length - 1} title="앞으로"><Icon name="chevron-right" /></button>
          <button className="jan-wb-btn" onClick={reload} title="새로고침"><Icon name="refresh-cw" /></button>
          <input ref={inputRef} className="jan-wb-input" placeholder="검색어 또는 https:// URL 입력 후 Enter"
            onKeyDown={(e) => { if (e.key === 'Enter') navigate((e.target as HTMLInputElement).value) }}
          />
          <button className="jan-wb-btn primary" onClick={() => inputRef.current && navigate(inputRef.current.value)}>이동</button>
          <button className="jan-wb-btn" onClick={openExternal} title="외부 브라우저로 열기"><Icon name="globe" /> 외부</button>
        </div>

        <div className="jan-wb-engines">
          <span className="jan-wb-label">빠른 검색:</span>
          {Object.entries(ENGINES).map(([k, e]) => (
            <button key={k} className="jan-wb-btn small" onClick={() => goEngine(k)}>{e.label}</button>
          ))}
          <span style={{ flex: 1 }} />
          <button className="jan-wb-btn small action" onClick={insertLink}><Icon name="link" size={12} /> 링크 저장</button>
          <button className="jan-wb-btn small action" onClick={insertExcerpt}><Icon name="quote" size={12} /> 선택 인용</button>
        </div>

        <div className="jan-wb-research">
          <span className="jan-wb-label" style={{ color: '#6a4cbb' }}>웹 → 노트:</span>
          <button className="jan-wb-btn small action" onClick={insertLinkCard}><Icon name="link" size={12} /> 링크 카드</button>
          <button className="jan-wb-btn small action" onClick={readerMode}><Icon name="file-text" size={12} /> 리더 모드</button>
          <button className="jan-wb-btn small action" onClick={aiSummary}><Icon name="sparkle" size={12} /> AI 요약</button>
          <button className="jan-wb-btn small action" onClick={extractImages}><Icon name="image" size={12} /> 이미지</button>
          <button className="jan-wb-btn small action" onClick={extractTables}><Icon name="table" size={12} /> 표 추출</button>
          <span style={{ flex: 1 }} />
          {loading ? <span style={{ fontSize: 11, color: '#6a4cbb', fontWeight: 600 }}>로딩 중...</span> : statusMsg && <span style={{ fontSize: 11, color: '#6a4cbb' }}>{statusMsg}</span>}
        </div>

        <div className="jan-wb-frame-wrap">
          {/* 항상 같은 iframe — src 또는 srcdoc 직접 set */}
          <iframe
            ref={iframeRef}
            referrerPolicy="no-referrer"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
            onLoad={onIframeLoad}
            title="In-app browser"
            style={{ display: currentUrl ? 'block' : 'none', width: '100%', height: '100%', border: 'none', background: '#fff' }}
          />
          {!currentUrl && (
            <div className="jan-wb-placeholder">
              <Icon name="globe" size={70} />
              <h4>메모장 내부 웹 브라우저</h4>
              <p>위 검색창에 검색어를 입력하거나 URL 을 붙여넣으세요<br />또는 빠른 검색 버튼으로 바로 이동할 수 있어요.</p>
              <p className="muted">
                Google · Naver · Facebook 등 차단 사이트는 <strong>CORS 프록시 (allorigins.win)</strong> 로 인앱 로딩됩니다.<br />
                Wikipedia · GitHub · StackOverflow 등은 직접 iframe 으로 빠르게 로딩됩니다.
              </p>
            </div>
          )}
        </div>

        <div className="jan-wb-statusbar">
          <Icon name="globe" size={11} />
          <span>현재:</span>
          <span className="jan-wb-current">{currentUrl || '(없음)'}</span>
        </div>
      </div>
    </div>
  )
}
