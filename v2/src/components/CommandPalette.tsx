import { useEffect, useState, useMemo } from 'react'
import type { Editor } from '@tiptap/react'
import { useMemosStore } from '../store/memosStore'
import { useUIStore } from '../store/uiStore'
import { useThemeStore } from '../store/themeStore'

interface Command {
  id: string
  cat: string
  label: string
  desc?: string
  hint?: string
  run: () => void
}

interface CommandPaletteProps {
  editor: Editor | null
}

/**
 * Phase 28 — 풍부한 명령 팔레트.
 * 카테고리별 그룹화 + 설명(desc) + 단축키 + 약 150 항목.
 * 라벨/desc/카테고리 모두 검색 대상.
 */
export function CommandPalette({ editor }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const { newMemo, duplicate, togglePin, list, setCurrent } = useMemosStore() as any
  const { toggleFocus, zoomIn, zoomOut, zoomReset, toggleSidebar, toggleHeadingNumbers, toggleReading, toggleSpellCheck } = useUIStore()
  const { theme, setTheme } = useThemeStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return
      const ctrl = e.ctrlKey || e.metaKey
      if ((ctrl && e.shiftKey && e.key.toLowerCase() === 'p') ||
          (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        setOpen((v) => !v); setQuery(''); setSelected(0); return
      }
      if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false) }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open])

  /* === 헬퍼 함수들 (Toolbar 의 핸들러 일부 재구현) === */
  const insertHTML = (html: string) => editor?.chain().focus().insertContent(html).run()
  const togglePilcrow = () => {
    document.body.classList.toggle('jan-show-pilcrow')
    try { localStorage.setItem('jan-show-pilcrow', document.body.classList.contains('jan-show-pilcrow') ? '1' : '0') } catch {}
  }
  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light')
  const insertDateTime = () => {
    const d = new Date()
    const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    editor?.chain().focus().insertContent(s).run()
  }

  const fireHeader = (title: string) => {
    const btn = Array.from(document.querySelectorAll('.jan-app-header .jan-header-btn')).find(b => b.getAttribute('title') === title) as any
    if (!btn) return
    const k = Object.keys(btn).find(k => k.startsWith('__reactProps$'))
    if (k) btn[k]?.onClick?.({})
  }
  const fireMenuItem = (cat: string, label: string) => {
    /* Open menu, find item, fire */
    const menuBtn = Array.from(document.querySelectorAll('.jan-menu-btn')).find(b => (b.textContent||'').trim().startsWith(cat)) as any
    if (!menuBtn) return
    const k = Object.keys(menuBtn).find(k => k.startsWith('__reactProps$'))
    if (k) menuBtn[k]?.onClick?.({})
    setTimeout(() => {
      const drop = menuBtn.closest('.jan-menu-wrap')?.querySelector('.jan-menu-dropdown')
      const items = drop ? Array.from(drop.querySelectorAll('.jan-menu-item')) as any[] : []
      const it = items.find(i => (i.querySelector('.jan-menu-label')?.textContent || '').trim() === label)
      if (it) {
        const ik = Object.keys(it).find(k => k.startsWith('__reactProps$'))
        if (ik) it[ik]?.onClick?.({})
      }
      /* close menu */
      if (k) menuBtn[k]?.onClick?.({})
    }, 50)
  }

  const commands: Command[] = useMemo(() => {
    if (!editor) return []
    const ed = editor
    const memos = (list?.() || [])
    const memoCmds: Command[] = memos.slice(0, 30).map((m: any, i: number) => ({
      id: 'memo-' + m.id, cat: '메모', label: '메모로 이동: ' + (m.title || '제목없음'),
      desc: '최근 수정: ' + new Date(m.updatedAt || m.createdAt || Date.now()).toLocaleString('ko-KR'),
      hint: i < 9 ? `Ctrl+${i+1}` : undefined,
      run: () => setCurrent(m.id),
    }))

    return [
      /* === 메모 관리 === */
      { id: 'new', cat: '메모', label: '새 메모', desc: '빈 메모를 새로 만듭니다.', hint: 'Ctrl+N', run: () => newMemo() },
      { id: 'dup', cat: '메모', label: '현재 메모 복제', desc: '현재 메모를 새 사본으로 복사합니다.', run: () => duplicate?.() },
      { id: 'pin', cat: '메모', label: '핀 / 핀 해제', desc: '메모를 사이드바 상단에 고정합니다.', run: () => togglePin?.() },
      ...memoCmds,

      /* === 서식 (마크) === */
      { id: 'bold', cat: '서식', label: '굵게', desc: '선택 텍스트를 두껍게 표시합니다.', hint: 'Ctrl+B', run: () => ed.chain().focus().toggleBold().run() },
      { id: 'italic', cat: '서식', label: '기울임', desc: '선택 텍스트를 이탤릭체로 표시합니다.', hint: 'Ctrl+I', run: () => ed.chain().focus().toggleItalic().run() },
      { id: 'underline', cat: '서식', label: '밑줄', desc: '선택 텍스트에 밑줄을 그립니다.', hint: 'Ctrl+U', run: () => ed.chain().focus().toggleUnderline().run() },
      { id: 'strike', cat: '서식', label: '취소선', desc: '선택 텍스트에 가운데 줄을 긋습니다.', run: () => ed.chain().focus().toggleStrike().run() },
      { id: 'highlight', cat: '서식', label: '형광펜', desc: '노란색 형광펜으로 강조 표시합니다.', run: () => (ed.chain() as any).focus().toggleHighlight({ color: '#FFEB3B' }).run() },
      { id: 'clear-fmt', cat: '서식', label: '서식 지우기', desc: '모든 마크와 노드 서식을 초기화합니다.', run: () => ed.chain().focus().unsetAllMarks().clearNodes().run() },

      /* === 제목 / 단락 === */
      { id: 'h1', cat: '제목', label: '제목 1', desc: '큰 제목 (H1) 스타일로 변경.', hint: 'Ctrl+Alt+1', run: () => ed.chain().focus().toggleHeading({ level: 1 }).run() },
      { id: 'h2', cat: '제목', label: '제목 2', desc: '중간 제목 (H2) 스타일.', hint: 'Ctrl+Alt+2', run: () => ed.chain().focus().toggleHeading({ level: 2 }).run() },
      { id: 'h3', cat: '제목', label: '제목 3', desc: '소제목 (H3) 스타일.', hint: 'Ctrl+Alt+3', run: () => ed.chain().focus().toggleHeading({ level: 3 }).run() },
      { id: 'h4', cat: '제목', label: '제목 4', desc: 'H4 헤딩.', run: () => ed.chain().focus().toggleHeading({ level: 4 }).run() },
      { id: 'p', cat: '제목', label: '일반 문단', desc: '제목 스타일을 해제하고 일반 문단으로.', hint: 'Ctrl+Shift+N', run: () => ed.chain().focus().setParagraph().run() },

      /* === 정렬 === */
      { id: 'left', cat: '정렬', label: '왼쪽 정렬', desc: '선택 단락을 왼쪽으로 정렬.', hint: 'Ctrl+L', run: () => ed.chain().focus().setTextAlign('left').run() },
      { id: 'center', cat: '정렬', label: '가운데 정렬', desc: '선택 단락을 가운데로 정렬.', hint: 'Ctrl+E', run: () => ed.chain().focus().setTextAlign('center').run() },
      { id: 'right', cat: '정렬', label: '오른쪽 정렬', desc: '선택 단락을 오른쪽으로 정렬.', hint: 'Ctrl+R', run: () => ed.chain().focus().setTextAlign('right').run() },
      { id: 'justify', cat: '정렬', label: '양쪽 정렬', desc: '양쪽 끝까지 자간 조정으로 정렬.', hint: 'Ctrl+J', run: () => ed.chain().focus().setTextAlign('justify').run() },

      /* === 리스트 === */
      { id: 'ul', cat: '리스트', label: '글머리 기호 목록', desc: '• 점으로 시작하는 무순서 목록.', run: () => ed.chain().focus().toggleBulletList().run() },
      { id: 'ol', cat: '리스트', label: '번호 매기기 목록', desc: '1. 2. 3. 으로 시작하는 순서 목록.', run: () => ed.chain().focus().toggleOrderedList().run() },
      { id: 'task', cat: '리스트', label: '체크리스트', desc: '체크박스 [ ] 가 있는 할 일 목록.', run: () => (ed.chain() as any).focus().toggleList('taskList', 'taskItem').run() },
      { id: 'quote', cat: '리스트', label: '인용', desc: '왼쪽에 줄이 있는 인용 블록.', run: () => ed.chain().focus().toggleBlockquote().run() },
      { id: 'code', cat: '리스트', label: '코드 블록', desc: '고정폭 코드 블록 (구문 강조).', run: () => ed.chain().focus().toggleCodeBlock().run() },

      /* === 삽입 === */
      { id: 'table', cat: '삽입', label: '표 삽입 (3×3)', desc: '3행×3열 표를 삽입합니다.', run: () => ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { id: 'image', cat: '삽입', label: '이미지 (URL)', desc: 'URL 로 이미지를 삽입합니다.', run: () => { const u = window.prompt('이미지 URL:'); if (u) ed.chain().focus().setImage({ src: u }).run() } },
      { id: 'image-up', cat: '삽입', label: '이미지 업로드', desc: '로컬 파일에서 이미지 업로드.', run: () => { const i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=()=>{const f=i.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>ed.chain().focus().setImage({src:String(r.result)}).run(); r.readAsDataURL(f)}; i.click() } },
      { id: 'link', cat: '삽입', label: '링크', desc: '하이퍼링크를 추가/편집합니다.', hint: 'Ctrl+K', run: () => { const u = window.prompt('링크 URL:'); if (u) ed.chain().focus().setLink({ href: u }).run() } },
      { id: 'hr', cat: '삽입', label: '구분선', desc: '가로 구분선 (HR) 을 삽입.', run: () => ed.chain().focus().setHorizontalRule().run() },
      { id: 'date', cat: '삽입', label: '날짜/시간', desc: '현재 날짜와 시간을 본문에 삽입.', run: insertDateTime },
      { id: 'page-break', cat: '삽입', label: '페이지 구분', desc: '인쇄/PDF 시 다음 페이지로 넘어갑니다.', hint: 'Ctrl+Enter', run: () => insertHTML('<hr class="jan-page-break" data-page-break="1"/><p></p>') },
      { id: 'callout-info', cat: '삽입', label: '콜아웃: 정보', desc: '파란색 정보 알림 상자.', run: () => (ed.chain() as any).focus().setCallout('info').run() },
      { id: 'callout-warn', cat: '삽입', label: '콜아웃: 경고', desc: '주황색 경고 알림 상자.', run: () => (ed.chain() as any).focus().setCallout('warn').run() },
      { id: 'callout-tip', cat: '삽입', label: '콜아웃: 팁', desc: '초록색 팁 알림 상자.', run: () => (ed.chain() as any).focus().setCallout('tip').run() },
      { id: 'callout-error', cat: '삽입', label: '콜아웃: 오류', desc: '빨간색 오류 알림 상자.', run: () => (ed.chain() as any).focus().setCallout('error').run() },
      { id: 'math', cat: '삽입', label: '수식 (LaTeX)', desc: 'KaTeX 로 렌더링되는 LaTeX 수식 블록.', run: () => { const t = window.prompt('LaTeX (예: x^2 + y^2 = z^2):'); if (t) (ed.chain() as any).focus().setMath(t).run() } },
      { id: 'mermaid', cat: '삽입', label: '다이어그램 (Mermaid)', desc: 'Mermaid 코드로 다이어그램 그리기.', run: () => { const c = window.prompt('Mermaid 코드:', 'graph TD\n  A-->B'); if (c) (ed.chain() as any).focus().setMermaid(c).run() } },
      { id: 'embed', cat: '삽입', label: '임베드 (URL)', desc: 'YouTube/Vimeo/CodeSandbox URL 임베드.', run: () => { const u = window.prompt('URL:'); if (u) (ed.chain() as any).focus().setEmbed(u).run() } },
      { id: 'youtube', cat: '삽입', label: 'YouTube 영상', desc: 'YouTube 임베드 iframe 삽입.', run: () => { const u = window.prompt('YouTube URL:'); if (!u) return; const m = u.match(/(?:v=|youtu\.be\/)([\w-]{11})/); if (!m) return alert('유효 URL 아님'); insertHTML(`<div class="jan-yt"><iframe src="https://www.youtube.com/embed/${m[1]}" width="560" height="315" frameborder="0" allowfullscreen></iframe></div>`) } },
      { id: 'symbol', cat: '삽입', label: '특수 문자', desc: '— … · ★ → 등 자주 쓰는 기호.', run: () => { const c = window.prompt('특수 문자:\n— – … · • ◦ ★ ☆ ◆ → ← ✓ ✗ ¶ § © ® ™ ° ± × ÷ ≈ ≠ ∞ Σ Π ∫ √ α β π σ ω', '—'); if (c) ed.chain().focus().insertContent(c).run() } },

      /* === 논문 === */
      { id: 'paper-mode', cat: '논문', label: '논문 모드 패널', desc: 'Science 포맷 논문 시작/변환.', run: () => fireMenuItem('논문', '논문 시작 (Science 포맷 샘플)') },
      { id: 'authors', cat: '논문', label: '저자 · 소속 · 교신 블록', desc: '저자명, 소속, 교신저자 이메일 블록 삽입.', run: () => fireMenuItem('논문', '저자 · 소속 · 교신 블록') },
      { id: 'abstract', cat: '논문', label: 'Abstract 박스', desc: '회색 박스에 ABSTRACT 라벨 + 본문.', run: () => fireMenuItem('논문', 'Abstract 박스') },
      { id: 'keywords', cat: '논문', label: 'Keywords 블록', desc: '키워드 목록 인라인 한 줄.', run: () => fireMenuItem('논문', 'Keywords 블록') },
      { id: 'toc', cat: '논문', label: 'TOC (목차) 자동 생성', desc: 'H1/H2/H3 로 목차 패널 토글.', run: () => fireMenuItem('논문', 'TOC (목차) 자동 생성') },
      { id: 'ack', cat: '논문', label: 'Acknowledgments', desc: '감사의 말 섹션 H2 + 본문.', run: () => fireMenuItem('논문', 'Acknowledgments (감사의 말)') },
      { id: '2col', cat: '논문', label: '2단 레이아웃 토글', desc: 'CSS column-count: 2 로 본문 2단 표시.', run: () => fireMenuItem('논문', '2단 레이아웃 토글') },
      { id: 'wrap-page', cat: '논문', label: '페이지로 감싸기', desc: '전체 본문을 .jan-page-wrap div 로 감쌈.', run: () => fireMenuItem('논문', '페이지로 감싸기') },
      { id: 'run-header', cat: '논문', label: '러닝 헤더 · 꼬리말', desc: '@page top-center + ProseMirror::before 헤더.', run: () => fireMenuItem('논문', '러닝 헤더 · 꼬리말 설정') },
      { id: 'footnote', cat: '논문', label: '각주 삽입', desc: '<sup>[N]</sup> + 문서 끝 footnote 블록.', run: () => fireMenuItem('논문', '각주 삽입') },
      { id: 'citation', cat: '논문', label: '인용 삽입', desc: '<sup>(저자, 연도)</sup> 본문 인용.', run: () => fireMenuItem('논문', '인용 삽입') },
      { id: 'reference', cat: '논문', label: '참고문헌 항목 추가', desc: 'hanging-indent reference 항목.', run: () => fireMenuItem('논문', '참고문헌 항목 추가') },
      { id: 'renumber', cat: '논문', label: '번호 재정렬', desc: '문서 내 모든 각주 번호 1,2,3 으로 재할당.', run: () => fireMenuItem('논문', '번호 재정렬') },

      /* === 한국어 타이포 === */
      { id: 'letter-sp', cat: '타이포', label: '자간 설정', desc: 'letter-spacing 을 em 단위로 조정.', run: () => fireMenuItem('서식', '자간 설정') },
      { id: 'char-scale', cat: '타이포', label: '장평 설정', desc: 'transform: scaleX 로 글자 가로 폭 조정.', run: () => fireMenuItem('서식', '장평 설정') },
      { id: 'first-indent', cat: '타이포', label: '첫 줄 들여쓰기 토글', desc: '단락마다 첫 줄 1.5em 들여쓰기.', run: () => fireMenuItem('서식', '첫 줄 들여쓰기 토글') },
      { id: 'para-space', cat: '타이포', label: '단락 간격', desc: '단락 위/아래 margin 을 em 으로 설정.', run: () => fireMenuItem('서식', '단락 간격') },
      { id: 'text-effect', cat: '타이포', label: '글자 효과', desc: '그림자/네온/조각 텍스트 효과 프리셋.', run: () => fireMenuItem('서식', '글자 효과') },
      { id: 'highlight-box', cat: '타이포', label: '강조 배경 상자', desc: '노랑 배경 + 좌측 보더 강조 div.', run: () => fireMenuItem('서식', '강조 배경 상자') },

      /* === 페이지 === */
      { id: 'page-size', cat: '페이지', label: '페이지 크기', desc: 'A4/A5/Letter/B5 페이지 크기 변경.', run: () => fireMenuItem('페이지', '페이지 크기 설정 (A4/Letter/A5/B5)') },
      { id: 'page-margin', cat: '페이지', label: '페이지 여백', desc: '본문 여백을 mm 단위로 설정.', run: () => fireMenuItem('페이지', '페이지 여백 설정 (mm)') },
      { id: 'pilcrow', cat: '페이지', label: '엔터 표시(¶) 켬/끔', desc: '단락 끝에 ¶ 기호 표시 토글.', run: togglePilcrow },
      { id: 'print-prev', cat: '페이지', label: '인쇄 미리보기', desc: 'Paged.js 기반 페이지 미리보기.', hint: 'Ctrl+Alt+P', run: () => fireHeader('도움말 (F1)') },
      { id: 'print', cat: '페이지', label: '인쇄', desc: '브라우저 인쇄 다이얼로그.', hint: 'Ctrl+P', run: () => window.print() },

      /* === 미디어 === */
      { id: 'screen-cap', cat: '미디어', label: '화면 캡쳐', desc: 'getDisplayMedia 로 화면 캡쳐 후 본문 삽입.', run: () => fireMenuItem('미디어', '화면 캡쳐') },
      { id: 'gallery', cat: '미디어', label: '갤러리 뷰', desc: '본문 모든 이미지를 새 창에 그리드로.', run: () => fireMenuItem('미디어', '갤러리 뷰') },
      { id: 'voice-input', cat: '미디어', label: '음성 입력', desc: 'Web Speech API 로 한국어 받아쓰기.', run: () => fireMenuItem('미디어', '음성 입력 (받아쓰기)') },
      { id: 'tts', cat: '미디어', label: '읽어주기 (TTS)', desc: 'speechSynthesis 로 선택 텍스트 음성 출력.', run: () => fireMenuItem('미디어', '읽어주기 (TTS)') },
      { id: 'rec', cat: '미디어', label: '음성 녹음', desc: 'MediaRecorder 로 녹음 → audio 본문 삽입.', run: () => fireMenuItem('미디어', '음성 녹음') },
      { id: 'meet', cat: '미디어', label: '회의 노트 템플릿', desc: '회의 정보/안건/결정/액션 템플릿.', run: () => fireMenuItem('미디어', '회의 노트 (템플릿)') },
      { id: 'ai-img', cat: '미디어', label: 'AI 이미지 생성 (Pollinations)', desc: '프롬프트로 이미지 생성하여 삽입.', run: () => fireMenuItem('미디어', 'AI 이미지 생성 (Pollinations)') },

      /* === 도구 === */
      { id: 'wordcloud', cat: '도구', label: '워드 클라우드', desc: '본문 단어 빈도를 새 창에 클라우드로.', run: () => fireMenuItem('도구', '워드 클라우드') },
      { id: 'flashcards', cat: '도구', label: '플래시카드', desc: '제목별 Q/A 카드 학습 새 창.', run: () => fireMenuItem('도구', '플래시카드 학습') },
      { id: 'pomodoro', cat: '도구', label: '포모도로 타이머', desc: '25분 집중 타이머 (우상단 카운터).', run: () => fireMenuItem('도구', '포모도로 타이머') },
      { id: 'spell', cat: '도구', label: '맞춤법 검사 토글', desc: '브라우저 spellcheck 속성 켬/끔.', run: toggleSpellCheck },

      /* === 보기 / UI === */
      { id: 'focus', cat: '보기', label: '집중 모드', desc: '사이드바·툴바 등 UI 숨김.', hint: 'F11', run: toggleFocus },
      { id: 'reading', cat: '보기', label: '읽기 모드', desc: '편집 비활성화, 가독성 향상.', hint: 'Shift+F11', run: toggleReading },
      { id: 'sidebar', cat: '보기', label: '사이드바 토글', desc: '메모 목록 사이드바 열기/접기.', run: toggleSidebar },
      { id: 'zoom-in', cat: '보기', label: '줌 인', desc: '본문 글자 크기 +10%.', hint: 'Ctrl+=', run: zoomIn },
      { id: 'zoom-out', cat: '보기', label: '줌 아웃', desc: '본문 글자 크기 -10%.', hint: 'Ctrl+-', run: zoomOut },
      { id: 'zoom-reset', cat: '보기', label: '줌 리셋 (100%)', desc: '본문 글자 크기 기본값으로 복원.', hint: 'Ctrl+0', run: zoomReset },
      { id: 'theme', cat: '보기', label: '테마 변경 (light/dark/auto)', desc: '라이트→다크→자동 순환.', run: cycleTheme },
      { id: 'h-num', cat: '보기', label: '제목 번호 매기기 토글', desc: 'H1/H2/H3 앞에 1, 1.1, 1.1.1 자동 번호.', run: toggleHeadingNumbers },

      /* === 편집 === */
      { id: 'undo', cat: '편집', label: '실행 취소', desc: '마지막 변경을 되돌립니다.', hint: 'Ctrl+Z', run: () => ed.chain().focus().undo().run() },
      { id: 'redo', cat: '편집', label: '다시 실행', desc: '되돌린 변경을 다시 실행.', hint: 'Ctrl+Shift+Z', run: () => ed.chain().focus().redo().run() },
      { id: 'select-all', cat: '편집', label: '모두 선택', desc: '본문 전체를 선택합니다.', hint: 'Ctrl+A', run: () => ed.chain().focus().selectAll().run() },

      /* === 파일 === */
      { id: 'save', cat: '파일', label: '저장', desc: '현재 메모를 파일로 저장.', hint: 'Ctrl+S', run: () => fireMenuItem('파일', '저장') },
      { id: 'open', cat: '파일', label: '열기', desc: '파일에서 메모를 불러옵니다.', hint: 'Ctrl+O', run: () => fireMenuItem('파일', '열기...') },
      { id: 'export-pdf', cat: '파일', label: 'PDF 내보내기', desc: '현재 메모를 PDF 로 다운로드.', run: () => fireMenuItem('파일', 'PDF 내보내기') },
      { id: 'export-html', cat: '파일', label: 'HTML 내보내기', desc: '현재 메모를 HTML 파일로.', run: () => fireMenuItem('파일', 'HTML 내보내기') },
      { id: 'export-md', cat: '파일', label: 'Markdown 내보내기', desc: '.md 파일로 저장.', run: () => fireMenuItem('파일', 'Markdown(.md) 저장') },
      { id: 'export-hwpx', cat: '파일', label: 'HWPX (한글) 내보내기', desc: '한글 .hwpx 파일로 저장.', run: () => fireMenuItem('파일', 'HWPX (한글) 내보내기') },
      { id: 'export-doc', cat: '파일', label: 'Word(.doc) 내보내기', desc: 'MS Office 호환 .doc 파일.', run: () => fireMenuItem('파일', 'Word(.doc) 내보내기') },
      { id: 'gist', cat: '파일', label: 'GitHub Gist 공유', desc: 'Gist 로 업로드하여 링크 공유.', run: () => fireMenuItem('파일', 'GitHub Gist 로 공유') },
      { id: 'share', cat: '파일', label: '공유 링크', desc: '공유용 단축 링크 생성.', run: () => fireMenuItem('파일', '공유 링크') },
      { id: 'json-export', cat: '파일', label: 'JSON 백업 내보내기', desc: '모든 메모를 JSON 파일로 백업.', run: () => fireMenuItem('파일', 'JSON 백업 내보내기') },
      { id: 'json-import', cat: '파일', label: 'JSON 백업 가져오기', desc: 'JSON 파일에서 메모 일괄 가져오기.', run: () => fireMenuItem('파일', 'JSON 백업 가져오기') },
      { id: 'v1-import', cat: '파일', label: 'v1 메모 가져오기', desc: 'localStorage 의 v1 메모 → v2 변환.', run: () => fireMenuItem('파일', 'v1 메모 가져오기') },
      { id: 'versions', cat: '파일', label: '버전 기록', desc: '자동 저장된 버전 목록 + 복원.', run: () => fireMenuItem('파일', '버전 기록') },
      { id: 'lock', cat: '파일', label: '잠금 / 비밀번호', desc: '메모에 비밀번호 설정.', run: () => fireMenuItem('파일', '잠금 / 비밀번호') },
      { id: 'trash', cat: '파일', label: '휴지통', desc: '삭제된 메모 목록 보기.', run: () => fireMenuItem('파일', '휴지통') },
      { id: 'about', cat: '파일', label: '정보 / 버전', desc: 'JustANotepad 버전 및 변경 내역.', run: () => fireHeader('버전 / 변경 내역') },

      /* === Topbar 단축 === */
      { id: 'tb-web', cat: '도구', label: '웹 검색', desc: '구글에서 키워드 검색 (새 탭).', run: () => fireHeader('웹 검색') },
      { id: 'tb-ai', cat: '도구', label: 'AI 어시스턴트', desc: 'AI 도우미 모달 열기.', hint: 'Ctrl+/', run: () => fireHeader('AI 어시스턴트 (Ctrl+/)') },
      { id: 'tb-cal', cat: '도구', label: '캘린더', desc: 'QuickCapture 캘린더 모달.', run: () => fireHeader('캘린더') },
      { id: 'tb-pin', cat: '도구', label: '새 JustPin', desc: '새 포스트잇 메모.', hint: 'Ctrl+Alt+P', run: () => fireHeader('새 JustPin (Ctrl+Alt+P)') },
      { id: 'tb-lecture', cat: '도구', label: '강의노트 템플릿', desc: '과목/교수/날짜/핵심개념 템플릿 새 메모.', run: () => fireHeader('강의노트') },
      { id: 'tb-meeting', cat: '도구', label: '회의노트 템플릿', desc: '안건/결정/액션 아이템 템플릿 새 메모.', run: () => fireHeader('회의노트') },
      { id: 'tb-cards', cat: '도구', label: '명함 / 카드 관리', desc: '메모를 카드 그리드로 새 창에서 보기.', run: () => fireHeader('명함 / 카드 관리') },
      { id: 'tb-paint', cat: '도구', label: '그림판', desc: 'Canvas 기반 그림판 모달.', run: () => fireHeader('그림판') },
      { id: 'tb-imgcv', cat: '도구', label: '이미지 변환기', desc: '리사이즈 + 포맷 변환 (PNG/JPG/WebP).', run: () => fireHeader('이미지 변환기') },
      { id: 'tb-roles', cat: '도구', label: '내 도구 / 역할 팩', desc: '37개 역할별 글쓰기 도구.', run: () => fireHeader('내 도구 / 역할 팩') },
      { id: 'tb-search', cat: '도구', label: '전체 검색', desc: '모든 메모 텍스트 검색.', hint: 'Ctrl+Shift+F', run: () => fireHeader('검색 (Ctrl+Shift+F)') },
      { id: 'tb-ocr', cat: '도구', label: 'OCR', desc: '이미지에서 텍스트 추출.', run: () => fireHeader('OCR') },
      { id: 'tb-help', cat: '도구', label: '도움말', desc: '단축키 + 사용법 가이드.', hint: 'F1', run: () => fireHeader('도움말 (F1)') },
      { id: 'tb-home', cat: '도구', label: '홈 허브', desc: '최근 메모 목록 새 창.', run: () => fireHeader('홈 허브') },
      { id: 'tb-sync', cat: '도구', label: '동기화 설정', desc: 'Dropbox/GDrive/Supabase 동기화.', run: () => fireHeader('동기화 설정') },
      { id: 'tb-settings', cat: '도구', label: '설정', desc: '앱 설정 (테마/언어/AI/저장 등).', hint: 'Ctrl+,', run: () => fireHeader('설정 (Ctrl+,)') },
      { id: 'tb-cms', cat: '도구', label: 'CMS 관리자', desc: 'Super Admin 전용 관리 페이지.', run: () => fireHeader('CMS 관리자 (Super Admin)') },
    ]
  }, [editor, list, newMemo, duplicate, togglePin, setCurrent, toggleFocus, zoomIn, zoomOut, zoomReset, toggleSidebar, toggleHeadingNumbers, toggleReading, toggleSpellCheck, theme])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) =>
      c.label.toLowerCase().includes(q) ||
      (c.desc || '').toLowerCase().includes(q) ||
      c.cat.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    )
  }, [query, commands])

  /* 카테고리별 그룹 */
  const groups = useMemo(() => {
    const m: Record<string, Command[]> = {}
    filtered.forEach(c => { (m[c.cat] = m[c.cat] || []).push(c) })
    return m
  }, [filtered])

  useEffect(() => { setSelected(0) }, [query])

  if (!open) return null

  const flat = filtered
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = flat[selected]
      if (cmd) { cmd.run(); setOpen(false); setQuery('') }
    }
  }

  let runningIdx = 0
  return (
    <div className="jan-cp-overlay" onClick={() => setOpen(false)}>
      <div className="jan-cp" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          className="jan-cp-input"
          autoFocus
          placeholder={`명령 검색... (${flat.length}/${commands.length}개)  ·  Ctrl+K`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul className="jan-cp-list">
          {flat.length === 0 && <li className="jan-cp-empty">검색 결과 없음</li>}
          {Object.entries(groups).map(([cat, cmds]) => (
            <li key={cat} className="jan-cp-group">
              <div className="jan-cp-group-label">{cat} <span style={{ opacity: 0.5, fontWeight: 400, marginLeft: 6 }}>{cmds.length}</span></div>
              {cmds.map((cmd) => {
                const i = runningIdx++
                return (
                  <div
                    key={cmd.id}
                    className={'jan-cp-item' + (i === selected ? ' is-selected' : '')}
                    onClick={() => { cmd.run(); setOpen(false); setQuery('') }}
                    onMouseEnter={() => setSelected(i)}
                  >
                    <div className="jan-cp-item-main">
                      <span className="jan-cp-label">{cmd.label}</span>
                      {cmd.hint && <span className="jan-cp-hint">{cmd.hint}</span>}
                    </div>
                    {cmd.desc && <div className="jan-cp-desc">{cmd.desc}</div>}
                  </div>
                )
              })}
            </li>
          ))}
        </ul>
        <div className="jan-cp-footer">
          ↑↓ 이동 · Enter 실행 · Esc 닫기 · {commands.length}개 명령 (검색: 라벨/설명/카테고리)
        </div>
      </div>
    </div>
  )
}
