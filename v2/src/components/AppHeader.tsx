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
}

/**
 * Phase 22 — v1 스타일 상단 헤더 바 (5-row 레이아웃 일치).
 * v1 의 .topbar 처럼: 좌측 햄버거 + 로고 + 메모 제목 input → 우측 도구 아이콘들.
 * 별도 jan-titlebar 행을 두지 않고 제목을 헤더 안에 둔다.
 */
export function AppHeader(p: AppHeaderProps) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const { current, updateCurrent } = useMemosStore()
  const memo = current()
  const title = memo?.title || '새 메모'

  function cycleTheme() {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light')
  }

  const themeIcon: 'sun' | 'moon' | 'auto' =
    theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'auto'

  return (
    <header className="jan-app-header">
      <div className="jan-header-left">
        <button
          className="jan-header-btn"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? '사이드바 열기' : '사이드바 접기'}
          aria-label="메뉴"
        >
          <Icon name="menu" size={18} />
        </button>
        <div className="jan-header-logo">
          <Icon name="file-text" size={16} className="jan-header-logo-ico" />
          <span>JustANotepad</span>
        </div>
      </div>

      <input
        type="text"
        className="jan-header-title-input jan-hdr-title-input"
        value={title}
        onChange={(e) => updateCurrent({ title: e.target.value })}
        placeholder="제목 없음"
        aria-label="메모 제목"
      />

      <div className="jan-header-right">
        <button className="jan-header-btn" onClick={p.onCmdPalette} title="명령 팔레트 (Ctrl+K)" aria-label="명령 팔레트">
          <Icon name="cmd" size={16} />
        </button>
        <button className="jan-header-btn" onClick={p.onSearch} title="전체 검색 (Ctrl+Shift+F)" aria-label="검색">
          <Icon name="search" size={16} />
        </button>
        <button className="jan-header-btn" onClick={p.onLanguage} title="언어" aria-label="언어">
          <Icon name="language" size={16} />
        </button>
        <button className="jan-header-btn" onClick={cycleTheme} title={`테마: ${theme}`} aria-label="테마">
          <Icon name={themeIcon} size={16} />
        </button>
        <button className="jan-header-btn" onClick={p.onCalendar} title="캘린더" aria-label="캘린더">
          <Icon name="page" size={16} />
        </button>
        <button className="jan-header-btn" onClick={p.onOcr} title="OCR — 이미지에서 텍스트" aria-label="OCR">
          <Icon name="image-text" size={16} />
        </button>
        <button className="jan-header-btn" onClick={p.onChat} title="AI 챗 패널" aria-label="AI 챗">
          <Icon name="ai" size={16} />
        </button>
        <button className="jan-header-btn" onClick={p.onShare} title="공유 링크" aria-label="공유">
          <Icon name="users" size={16} />
        </button>
        <button className="jan-header-btn" onClick={p.onSettings} title="설정 (Ctrl+,)" aria-label="설정">
          <Icon name="settings" size={16} />
        </button>
        <button className="jan-header-btn" onClick={p.onHelp} title="도움말 (F1)" aria-label="도움말">
          <Icon name="help" size={16} />
        </button>
        <button className="jan-header-btn" onClick={p.onAbout} title="버전 / 변경 내역" aria-label="버전">
          <Icon name="info" size={16} />
        </button>
        <span className="jan-header-divider" />
        <button className="jan-header-btn" onClick={p.onCmdK} title="명령 (Ctrl+K)" aria-label="로그인">
          <Icon name="login" size={16} />
        </button>
      </div>
    </header>
  )
}
