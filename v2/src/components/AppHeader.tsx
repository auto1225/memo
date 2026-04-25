import { useEffect, useState } from 'react'
import { Icon } from './Icons'
import { useUIStore } from '../store/uiStore'
import { useThemeStore } from '../store/themeStore'
import { useMemosStore } from '../store/memosStore'

interface AppHeaderProps {
  onCmdK: () => void
  onCmdPalette: () => void
  onSearch: () => void
  onLanguage: () => void
  onCalendar: () => void
  onOcr: () => void
  onChat: () => void
  onShare: () => void
  onSettings: () => void
  onHelp: () => void
  onAbout: () => void
  onAi?: () => void
  onPostit?: () => void
  onPaint?: () => void
  onRoles?: () => void
  onTemplates?: () => void
}

/**
 * Phase 27 — v1 의 26개 topbar 버튼 모두 v2 에 이식.
 * 좌: 햄버거 + 로고 + 메모 제목 input + 포모도로 표시
 * 우: 명령팔레트/웹검색/AI/캘린더/JustPin/강의노트/회의노트/명함/그림판/이미지변환/역할대시보드/테마/검색/집중/도움말/홈허브/동기화/공유/로그인/창버튼
 */
export function AppHeader(p: AppHeaderProps) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const focusMode = useUIStore((s) => s.focusMode)
  const toggleFocus = useUIStore((s) => s.toggleFocus)
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const { current, updateCurrent, list, newMemo, setCurrent } = useMemosStore()
  const memo = current()
  const title = memo?.title || '새 메모'

  /* === 포모도로 인라인 타이머 === */
  const [pomoLeft, setPomoLeft] = useState<number | null>(null)
  useEffect(() => {
    if (pomoLeft === null) return
    if (pomoLeft <= 0) { setPomoLeft(null); alert('포모도로 완료! 5분 휴식하세요.'); return }
    const t = setTimeout(() => setPomoLeft(pomoLeft - 1000), 1000)
    return () => clearTimeout(t)
  }, [pomoLeft])
  const togglePomo = () => {
    if (pomoLeft !== null) { setPomoLeft(null); return }
    const min = Number(window.prompt('포모도로 시간 (분):', '25')) || 25
    setPomoLeft(min * 60 * 1000)
  }
  const pomoText = pomoLeft !== null
    ? `${String(Math.floor(pomoLeft / 60000)).padStart(2, '0')}:${String(Math.floor((pomoLeft % 60000) / 1000)).padStart(2, '0')}`
    : null

  function cycleTheme() {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light')
  }
  const themeIcon: 'sun' | 'moon' | 'auto' =
    theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'auto'

  /* === v1 전용 핸들러 (인라인 구현) === */
  const openWebSearch = () => {
    const q = window.prompt('웹 검색어:')
    if (q) window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank')
  }
  const openJustPin = () => {
    /* 새 메모를 빠른 메모 모드로 생성 */
    if (p.onPostit) p.onPostit()
    else { newMemo(); alert('새 JustPin 메모 생성됨') }
  }
  const insertLectureTemplate = () => {
    newMemo()
    setTimeout(() => {
      updateCurrent({
        title: '강의노트 — ' + new Date().toLocaleDateString('ko-KR'),
        content: `<h2>강의 정보</h2><p><strong>과목:</strong> </p><p><strong>교수:</strong> </p><p><strong>날짜:</strong> ${new Date().toLocaleDateString('ko-KR')}</p><h2>핵심 개념</h2><ul><li></li></ul><h2>본문</h2><p></p><h2>질문 / 복습 포인트</h2><ul><li></li></ul>`,
      })
    }, 50)
  }
  const insertMeetingTemplate = () => {
    newMemo()
    setTimeout(() => {
      updateCurrent({
        title: '회의노트 — ' + new Date().toLocaleDateString('ko-KR'),
        content: `<h2>회의 정보</h2><p><strong>일시:</strong> ${new Date().toLocaleString('ko-KR')}</p><p><strong>참석자:</strong> </p><p><strong>안건:</strong> </p><h2>논의 내용</h2><p></p><h2>결정사항</h2><ul><li></li></ul><h2>액션 아이템 (담당자/마감일)</h2><ul><li></li></ul>`,
      })
    }, 50)
  }
  const openCardsManager = () => {
    /* Mini popup with current memos as "cards" */
    const all = list()
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    let html = `<!doctype html><html><head><title>명함 / 카드 관리</title><style>body{font-family:sans-serif;background:#FFF8E7;padding:1em;} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;} .card{background:#fff;border:1px solid #ddd;border-radius:8px;padding:1em;box-shadow:0 2px 6px rgba(0,0,0,0.08);} h3{margin:0 0 0.5em;font-size:14px;color:#333;} .body{color:#555;font-size:12px;height:80px;overflow:hidden;}</style></head><body><h2>명함 / 카드 관리 — 메모 ${all.length}개</h2><div class="grid">`
    all.slice(0, 50).forEach((m: any) => {
      const body = (m.content || '').replace(/<[^>]+>/g, ' ').slice(0, 200)
      html += `<div class="card"><h3>${m.title || '제목없음'}</h3><div class="body">${body}</div></div>`
    })
    html += '</div></body></html>'
    w.document.write(html); w.document.close()
  }
  const openImageConverter = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    inp.onchange = () => {
      const file = inp.files?.[0]; if (!file) return
      const r = new FileReader()
      r.onload = () => {
        const img = new Image()
        img.onload = () => {
          const w = Number(window.prompt('새 가로 (px):', String(img.width))) || img.width
          const ratio = w / img.width
          const h = Math.round(img.height * ratio)
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h
          cv.getContext('2d')!.drawImage(img, 0, 0, w, h)
          const fmt = window.prompt('포맷 (png/jpeg/webp):', 'webp') || 'webp'
          const dataUrl = cv.toDataURL('image/' + fmt, 0.85)
          const a = document.createElement('a'); a.href = dataUrl; a.download = `converted.${fmt}`
          document.body.appendChild(a); a.click(); document.body.removeChild(a)
        }
        img.src = String(r.result)
      }
      r.readAsDataURL(file)
    }
    inp.click()
  }
  const openRoleDash = () => {
    if (p.onRoles) p.onRoles()
    else alert('역할 팩 패널을 열 수 없습니다.')
  }
  const openHomeHub = () => {
    const all = list().slice(0, 20)
    const w = window.open('', '_blank', 'width=600,height=700')
    if (!w) return
    const items = all.map((m: any) => `<li><a href="javascript:void(0)" data-id="${m.id}">${m.title || '제목없음'}</a> — ${new Date(m.updatedAt || m.createdAt || Date.now()).toLocaleString('ko-KR')}</li>`).join('')
    w.document.write(`<!doctype html><html><head><title>홈 허브</title><style>body{font-family:sans-serif;padding:1em;background:#FFF8E7;} ul{list-style:none;padding:0;} li{padding:8px;border-bottom:1px solid #eee;} a{color:#333;text-decoration:none;font-weight:600;} a:hover{color:#FAE100;}</style></head><body><h2>홈 허브 — 최근 메모 ${all.length}개</h2><ul>${items}</ul></body></html>`)
    w.document.close()
  }
  const openSync = () => {
    p.onSettings()
  }
  const openCms = () => {
    if (confirm('CMS 관리자 페이지로 이동합니다 (Super Admin 전용)')) window.open('/admin', '_blank')
  }
  const tauriPin = async () => { try { const t: any = (window as any).__TAURI__; if (!t) { alert('데스크톱 앱에서만 사용 가능'); return } const w = t.window?.getCurrent?.(); if (w?.setAlwaysOnTop) { const cur = await w.isAlwaysOnTop?.(); await w.setAlwaysOnTop(!cur) } } catch (e: any) { alert('실패: ' + e.message) } }
  const tauriMin = async () => { try { const t: any = (window as any).__TAURI__; const w = t?.window?.getCurrent?.(); if (w?.minimize) await w.minimize() } catch {} }
  const tauriMax = async () => { try { const t: any = (window as any).__TAURI__; const w = t?.window?.getCurrent?.(); if (w?.toggleMaximize) await w.toggleMaximize() } catch {} }
  const tauriClose = async () => { try { const t: any = (window as any).__TAURI__; const w = t?.window?.getCurrent?.(); if (w?.close) await w.close() } catch {} }
  void setCurrent /* keep imported */

  return (
    <header className="jan-app-header">
      <div className="jan-header-left">
        <button className="jan-header-btn" onClick={toggleSidebar} title={sidebarCollapsed ? '사이드바 열기' : '사이드바 접기'} aria-label="메뉴">
          <Icon name="menu" size={18} />
        </button>
        <div className="jan-header-logo">
          <Icon name="file-text" size={16} />
          <span>JustANotepad</span>
        </div>
      </div>

      <input type="text" className="jan-header-title-input" value={title} onChange={(e) => updateCurrent({ title: e.target.value })} placeholder="제목 없음" aria-label="메모 제목" />

      <div className="jan-header-right">
        {pomoText && (
          <button className="jan-header-btn jan-pomo-display" onClick={togglePomo} title="포모도로 (클릭: 정지)" style={{ minWidth: 64, fontFamily: 'monospace', fontWeight: 700 }}>
            {pomoText}
          </button>
        )}
        <button className="jan-header-btn" onClick={p.onCmdPalette} title="명령 팔레트 (Ctrl+K)" aria-label="명령 팔레트"><Icon name="cmd" /></button>
        <button className="jan-header-btn" onClick={openWebSearch} title="웹 검색" aria-label="웹 검색"><Icon name="globe" /></button>
        <button className="jan-header-btn" onClick={p.onAi || p.onChat} title="AI 어시스턴트 (Ctrl+/)" aria-label="AI"><Icon name="ai" /></button>
        <button className="jan-header-btn" onClick={p.onCalendar} title="캘린더" aria-label="캘린더"><Icon name="page" /></button>
        <button className="jan-header-btn" onClick={openJustPin} title="새 JustPin (Ctrl+Alt+P)" aria-label="JustPin"><Icon name="pin" /></button>
        <button className="jan-header-btn" onClick={insertLectureTemplate} title="강의노트" aria-label="강의노트"><Icon name="mic" /></button>
        <button className="jan-header-btn" onClick={insertMeetingTemplate} title="회의노트" aria-label="회의노트"><Icon name="users" /></button>
        <button className="jan-header-btn" onClick={openCardsManager} title="명함 / 카드 관리" aria-label="명함"><Icon name="cards" /></button>
        <button className="jan-header-btn" onClick={p.onPaint} title="그림판" aria-label="그림판"><Icon name="paint" /></button>
        <button className="jan-header-btn" onClick={openImageConverter} title="이미지 변환기" aria-label="이미지 변환"><Icon name="image" /></button>
        <button className="jan-header-btn" onClick={openRoleDash} title="내 도구 / 역할 팩" aria-label="역할 팩"><Icon name="briefcase" /></button>
        <button className="jan-header-btn" onClick={cycleTheme} title={`테마: ${theme}`} aria-label="테마"><Icon name={themeIcon} /></button>
        <button className="jan-header-btn" onClick={p.onSearch} title="검색 (Ctrl+Shift+F)" aria-label="검색"><Icon name="search" /></button>
        <button className={'jan-header-btn' + (focusMode ? ' is-active' : '')} onClick={() => toggleFocus()} title="집중 모드 (F11)" aria-label="집중 모드"><Icon name="eye" /></button>
        <button className="jan-header-btn" onClick={p.onOcr} title="OCR" aria-label="OCR"><Icon name="image-text" /></button>
        <button className="jan-header-btn" onClick={openCms} title="CMS 관리자 (Super Admin)" aria-label="CMS"><Icon name="shield" /></button>
        <button className="jan-header-btn" onClick={p.onHelp} title="도움말 (F1)" aria-label="도움말"><Icon name="help" /></button>
        <button className="jan-header-btn" onClick={openHomeHub} title="홈 허브" aria-label="홈 허브"><Icon name="home" /></button>
        <button className="jan-header-btn" onClick={openSync} title="동기화 설정" aria-label="동기화"><Icon name="sync" /></button>
        <button className="jan-header-btn" onClick={p.onShare} title="공유" aria-label="공유"><Icon name="users" /></button>
        <button className="jan-header-btn" onClick={p.onSettings} title="설정 (Ctrl+,)" aria-label="설정"><Icon name="settings" /></button>
        <button className="jan-header-btn" onClick={p.onAbout} title="버전 / 변경 내역" aria-label="버전"><Icon name="info" /></button>
        <span className="jan-header-divider" />
        <button className="jan-header-btn" onClick={p.onCmdK} title="로그인 / 계정" aria-label="로그인"><Icon name="login" /></button>
        <button className="jan-header-btn" onClick={tauriPin} title="항상 위에 (데스크톱)" aria-label="핀"><Icon name="pin" /></button>
        <button className="jan-header-btn" onClick={tauriMin} title="최소화" aria-label="최소화"><Icon name="window-min" /></button>
        <button className="jan-header-btn" onClick={tauriMax} title="최대화 / 복원" aria-label="최대화"><Icon name="window-max" /></button>
        <button className="jan-header-btn jan-header-close" onClick={tauriClose} title="닫기" aria-label="닫기" style={{ background: 'rgba(220,60,60,0.35)' }}><Icon name="close" /></button>
      </div>
    </header>
  )
}
