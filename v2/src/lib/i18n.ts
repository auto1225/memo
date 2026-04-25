/**
 * Phase 8 — i18n. 간단한 키-값 사전 + Zustand 상태.
 * react-i18next 없이도 충분 (3개 언어, ~80 키).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Lang = 'ko' | 'en' | 'ja'

export const STRINGS: Record<Lang, Record<string, string>> = {
  ko: {
    'app.title': 'JustANotepad',
    'btn.save': '저장',
    'btn.open': '열기',
    'btn.print': '인쇄',
    'btn.preview': '미리보기',
    'btn.search': '검색',
    'btn.close': '닫기',
    'btn.cancel': '취소',
    'btn.help': '도움말',
    'btn.theme': '테마',
    'btn.outline': '목차',
    'placeholder.title': '제목',
    'placeholder.note': '여기에 메모를 적어보세요...',
    'placeholder.search': '제목 / 본문 / 태그 — 띄어쓰기로 AND 검색',
    'modal.ai.title': 'AI 도우미',
    'modal.settings.title': '설정',
    'modal.print.title': '인쇄 미리보기',
    'modal.roles.title': '역할 팩 — 템플릿 삽입',
    'modal.paper.title': '논문 모드 — 인용 관리',
    'modal.postit.title': 'JustPin 포스트잇',
    'modal.search.title': '전체 검색',
    'modal.help.title': '키보드 단축키',
    'modal.paint.title': '그림판',
    'tags.label': '태그:',
    'tags.empty': '(없음)',
    'tags.placeholder': '태그 추가 (Enter 또는 쉼표로 구분)',
    'outline.title': '목차',
    'outline.empty': '제목이 없습니다.',
    'memo.new': '새 메모',
    'memo.untitled': '무제',
    'sync.now': '지금 동기화',
    'collab.start': '협업 시작',
    'collab.stop': '협업 중지',
    'lang.label': '언어:',
  },
  en: {
    'app.title': 'JustANotepad',
    'btn.save': 'Save',
    'btn.open': 'Open',
    'btn.print': 'Print',
    'btn.preview': 'Preview',
    'btn.search': 'Search',
    'btn.close': 'Close',
    'btn.cancel': 'Cancel',
    'btn.help': 'Help',
    'btn.theme': 'Theme',
    'btn.outline': 'Outline',
    'placeholder.title': 'Title',
    'placeholder.note': 'Start writing your note here...',
    'placeholder.search': 'Title / body / tags — space-separated AND',
    'modal.ai.title': 'AI Assistant',
    'modal.settings.title': 'Settings',
    'modal.print.title': 'Print Preview',
    'modal.roles.title': 'Roles — Insert Template',
    'modal.paper.title': 'Paper Mode — Citations',
    'modal.postit.title': 'JustPin Sticky Notes',
    'modal.search.title': 'Search All',
    'modal.help.title': 'Keyboard Shortcuts',
    'modal.paint.title': 'Drawing',
    'tags.label': 'Tags:',
    'tags.empty': '(none)',
    'tags.placeholder': 'Add tag (Enter or comma)',
    'outline.title': 'Outline',
    'outline.empty': 'No headings.',
    'memo.new': 'New Memo',
    'memo.untitled': 'Untitled',
    'sync.now': 'Sync Now',
    'collab.start': 'Start Collab',
    'collab.stop': 'Stop Collab',
    'lang.label': 'Language:',
  },
  ja: {
    'app.title': 'JustANotepad',
    'btn.save': '保存',
    'btn.open': '開く',
    'btn.print': '印刷',
    'btn.preview': 'プレビュー',
    'btn.search': '検索',
    'btn.close': '閉じる',
    'btn.cancel': 'キャンセル',
    'btn.help': 'ヘルプ',
    'btn.theme': 'テーマ',
    'btn.outline': '目次',
    'placeholder.title': 'タイトル',
    'placeholder.note': 'ここにメモを書いてください...',
    'placeholder.search': 'タイトル / 本文 / タグ — スペース区切り AND',
    'modal.ai.title': 'AI アシスタント',
    'modal.settings.title': '設定',
    'modal.print.title': '印刷プレビュー',
    'modal.roles.title': 'ロール — テンプレ挿入',
    'modal.paper.title': '論文モード — 引用管理',
    'modal.postit.title': 'JustPin 付箋',
    'modal.search.title': '全文検索',
    'modal.help.title': 'キーボードショートカット',
    'modal.paint.title': 'お絵描き',
    'tags.label': 'タグ:',
    'tags.empty': '(なし)',
    'tags.placeholder': 'タグ追加 (Enter またはカンマ)',
    'outline.title': '目次',
    'outline.empty': '見出しがありません。',
    'memo.new': '新規メモ',
    'memo.untitled': '無題',
    'sync.now': '同期する',
    'collab.start': 'コラボ開始',
    'collab.stop': 'コラボ停止',
    'lang.label': '言語:',
  },
}

interface I18nState {
  lang: Lang
  setLang: (l: Lang) => void
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      lang: detectLang(),
      setLang: (lang) => set({ lang }),
    }),
    { name: 'jan-v2-lang' }
  )
)

function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'ko'
  const n = navigator.language.toLowerCase()
  if (n.startsWith('ja')) return 'ja'
  if (n.startsWith('en')) return 'en'
  return 'ko'
}

export function t(key: string): string {
  const lang = useI18nStore.getState().lang
  return STRINGS[lang]?.[key] || STRINGS.ko[key] || key
}

/** React hook — 언어 변경 시 자동 재렌더. */
export function useT() {
  const lang = useI18nStore((s) => s.lang)
  return (key: string) => STRINGS[lang]?.[key] || STRINGS.ko[key] || key
}
