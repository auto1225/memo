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

/* CORS 프록시 — X-Frame-Options 우회 (allorigins / corsproxy 등 공개 프록시) */
const CORS_PROXIES = [
  (u: string) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  (u: string) => 'https://corsproxy.io/?' + encodeURIComponent(u),
]

/* iframe 직접 로딩 차단되는 도메인 — CORS 프록시 srcdoc 으로 폴백 */
const NEEDS_PROXY = [
  'google.com', 'google.co.kr', 'naver.com', 'daum.net',
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'amazon.com', 'amazon.co.kr', 'linkedin.com', 'pinterest.com',
]
const needsProxy = (url: string) => {
  try { const u = new URL(url); return NEEDS_PROXY.some(d => u.hostname.includes(d)) } catch { return false }
}

/* YouTube URL 을 embed URL 로 변환 */
const toEmbedUrl = (url: string): string => {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/results\?search_query=)([\w-]+)/)
  if (!m) return url
  const v = m[1]
  if (url.includes('search_query')) return url /* 검색 결과 페이지는 그대로 (embed 아님) */
  return `https://www.youtube.com/embed/${v}`
}

/* HTML 을 srcdoc 으로 사용할 수 있게 보강 (base href 추가, 스크립트 제거) */
const sanitizeForSrcdoc = (html: string, baseUrl: string): string => {
  /* base href 주입 — 상대경로 이미지/CSS 가 원본 사이트에서 로드되도록 */
  const base = `<base href="${baseUrl}" />`
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => m + base)
  } else if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => m + '<head>' + base + '</head>')
  }
  return '<head>' + base + '</head>' + html
}

/**
 * Phase 33 — v1 인앱 웹 브라우저 + CORS 프록시 폴백.
 * 차단 사이트는 fetch HTML → srcdoc 으로 우회 로딩.
 */
export function WebBrowserModal({ editor, onClose }: WebBrowserModalProps) {
  const [url, setUrl] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [hIdx, setHIdx] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [srcdocHtml, setSrcdocHtml] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const loadTimer = useRef<number | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const fetchViaProxy = async (target: string): Promise<string> => {
    let lastErr: any
    for (const mkProxy of CORS_PROXIES) {
      try {
        const proxyUrl = mkProxy(target)
        const res = await fetch(proxyUrl, { method: 'GET' })
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const html = await res.text()
        if (html.length < 100) throw new Error('너무 짧은 응답')
        return html
      } catch (e: any) { lastErr = e }
    }
    throw lastErr || new Error('모든 프록시 실패')
  }

  const navigate = async (target: string) => {
    if (!target.trim()) return
    let final = target.trim()
    if (!/^https?:\/\//.test(final) && !/^[\w-]+\.[\w]+/.test(final)) {
      final = ENGINES.google.url(final)
    } else if (!/^https?:\/\//.test(final)) {
      final = 'https://' + final
    }
    /* YouTube watch URL 은 embed 로 변환 */
    final = toEmbedUrl(final)

    setError('')
    setSrcdocHtml('')
    setLoading(true)
    setStatusMsg('')
    setUrl(final)
    if (hIdx === -1 || history[hIdx] !== final) {
      const h = [...history.slice(0, hIdx + 1), final]; setHistory(h); setHIdx(h.length - 1)
    }
    if (loadTimer.current) window.clearTimeout(loadTimer.current)

    /* 차단 사이트는 즉시 CORS 프록시 사용 */
    if (needsProxy(final)) {
      setStatusMsg('iframe 차단 사이트 — CORS 프록시로 로딩 중...')
      try {
        const html = await fetchViaProxy(final)
        setSrcdocHtml(sanitizeForSrcdoc(html, final))
        setLoading(false)
        setStatusMsg('CORS 프록시로 로딩됨 (일부 동적 콘텐츠는 제한됨)')
      } catch (e: any) {
        setError('CORS 프록시 실패: ' + e.message)
        setLoading(false)
      }
      return
    }

    /* 일반 사이트: iframe src 로 시도, 5초 안에 onLoad 안 fire 면 프록시 폴백 */
    loadTimer.current = window.setTimeout(async () => {
      setStatusMsg('iframe 로딩 지연 — CORS 프록시 폴백 시도...')
      try {
        const html = await fetchViaProxy(final)
        setSrcdocHtml(sanitizeForSrcdoc(html, final))
        setLoading(false)
        setStatusMsg('CORS 프록시로 폴백됨')
      } catch (e: any) {
        setError('iframe 차단 + 프록시 실패: ' + e.message)
        setLoading(false)
      }
    }, 5000) as any
  }
  const onIframeLoad = () => {
    if (loadTimer.current) { window.clearTimeout(loadTimer.current); loadTimer.current = null }
    setLoading(false)
    if (!srcdocHtml) setStatusMsg('인앱 로딩 완료')
  }

  const goEngine = (key: string) => {
    const q = inputRef.current?.value || window.prompt(ENGINES[key].label + ' 검색어:')
    if (q) navigate(ENGINES[key].url(q))
  }
  const goBack = () => { if (hIdx > 0) { const i = hIdx - 1; setHIdx(i); navigate(history[i]) } }
  const goFwd = () => { if (hIdx < history.length - 1) { const i = hIdx + 1; setHIdx(i); navigate(history[i]) } }
  const reload = () => { if (url) navigate(url) }
  const openExternal = () => {
    const target = url || inputRef.current?.value
    if (!target) return alert('URL 이 없습니다.')
    let final = target.trim()
    if (!/^https?:\/\//.test(final)) final = 'https://' + final
    window.open(final, '_blank', 'noopener,noreferrer')
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
    if (!text) text = window.prompt('인용할 텍스트:') || ''
    if (text) insertHTML(`<blockquote style="border-left:3px solid #FAE100;padding:0.4em 0.8em;margin:0.8em 0;background:#FFFBE5;">${text}<br><cite style="font-size:0.85em;color:#888;">— <a href="${url}">${url}</a></cite></blockquote>`)
  }
  const insertLinkCard = () => {
    if (!url) return
    insertHTML(`<div style="border:1px solid #ddd;border-radius:8px;padding:1em;margin:1em 0;background:#fafafa;"><a href="${url}" style="font-weight:600;text-decoration:none;color:#333;">${url}</a><div style="font-size:0.85em;color:#888;margin-top:0.4em;">링크 카드</div></div>`)
  }
  const readerMode = async () => {
    if (!url) return
    try {
      let html = srcdocHtml
      if (!html) html = await fetchViaProxy(url)
      const doc = new DOMParser().parseFromString(html, 'text/html')
      doc.querySelectorAll('script,style,nav,header,footer,iframe,form,button').forEach(e => e.remove())
      const article = doc.querySelector('article, main, [role=main]') || doc.body
      const title = doc.title || url
      insertHTML(`<h2>${title}</h2>${article.innerHTML.slice(0, 5000)}<p><em>출처: <a href="${url}">${url}</a></em></p>`)
    } catch (e: any) { alert('실패: ' + e.message) }
  }
  const aiSummary = () => alert('AI 요약은 별도 API 키 설정이 필요합니다.')
  const extractImages = async () => {
    if (!url) return
    try {
      let html = srcdocHtml
      if (!html) html = await fetchViaProxy(url)
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const imgs = Array.from(doc.querySelectorAll('img')).map(i => (i as HTMLImageElement).src).filter(s => s.startsWith('http')).slice(0, 12)
      if (!imgs.length) return alert('이미지를 찾지 못함.')
      const sel = window.prompt(`${imgs.length}개 발견. 번호 (쉼표 또는 'all'):`, 'all')
      if (!sel) return
      const idxs = sel === 'all' ? imgs.map((_, i) => i) : sel.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < imgs.length)
      idxs.forEach(i => insertHTML(`<img src="${imgs[i]}" style="max-width:100%;margin:0.5em 0;"/>`))
    } catch (e: any) { alert('실패: ' + e.message) }
  }
  const extractTables = async () => {
    if (!url) return
    try {
      let html = srcdocHtml
      if (!html) html = await fetchViaProxy(url)
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const tables = doc.querySelectorAll('table')
      if (!tables.length) return alert('표를 찾지 못함.')
      const sel = window.prompt(`${tables.length}개 발견. 번호:`, '1')
      const idx = parseInt(sel || '1') - 1
      if (tables[idx]) insertHTML(tables[idx].outerHTML)
    } catch (e: any) { alert('실패: ' + e.message) }
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

        <div className="jan-wb-toolbar">
          <button className="jan-wb-btn" onClick={goBack} disabled={hIdx <= 0} title="뒤로"><Icon name="chevron-left" /></button>
          <button className="jan-wb-btn" onClick={goFwd} disabled={hIdx >= history.length - 1} title="앞으로"><Icon name="chevron-right" /></button>
          <button className="jan-wb-btn" onClick={reload} title="새로고침"><Icon name="refresh-cw" /></button>
          <input
            ref={inputRef}
            className="jan-wb-input"
            placeholder="검색어 또는 https:// URL 입력 후 Enter"
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
          {statusMsg && <span style={{ fontSize: 10, color: '#6a4cbb' }}>{statusMsg}</span>}
        </div>

        <div className="jan-wb-frame-wrap">
          {srcdocHtml ? (
            <iframe
              key="srcdoc"
              srcDoc={srcdocHtml}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              referrerPolicy="no-referrer"
              title="In-app browser (proxy)"
            />
          ) : url && !error ? (
            <iframe
              key="src"
              ref={iframeRef}
              src={url}
              referrerPolicy="no-referrer"
              onLoad={onIframeLoad}
              title="In-app browser"
            />
          ) : null}
          {!url && (
            <div className="jan-wb-placeholder">
              <Icon name="globe" size={70} />
              <h4>메모장 내부 웹 브라우저</h4>
              <p>위 검색창에 검색어를 입력하거나 URL 을 붙여넣으세요<br />또는 빠른 검색 버튼으로 바로 이동할 수 있어요.</p>
              <p className="muted">
                Google · Naver · Facebook 등 차단 사이트는 자동으로 <strong>CORS 프록시</strong>를 통해 인앱 로딩됩니다.<br />
                Wikipedia · 나무위키 · GitHub · YouTube · StackOverflow 등은 직접 iframe 으로 빠르게 로딩됩니다.
              </p>
            </div>
          )}
          {error && url && (
            <div className="jan-wb-error">
              <Icon name="info" size={60} />
              <h4>로딩 실패</h4>
              <p>{error}</p>
              <button className="jan-wb-btn primary" onClick={openExternal}><Icon name="globe" /> 외부 브라우저로 열기</button>
            </div>
          )}
          {loading && url && !error && <div className="jan-wb-loading">{statusMsg || '불러오는 중...'}</div>}
        </div>

        <div className="jan-wb-statusbar">
          <Icon name="globe" size={11} />
          <span>현재:</span>
          <span className="jan-wb-current">{url || '(없음)'}</span>
        </div>
      </div>
    </div>
  )
}
