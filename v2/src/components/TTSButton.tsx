import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { speakTTS, cancelTTS, isTTSSupported, isTTSSpeaking } from '../lib/speech'
import { useI18nStore } from '../lib/i18n'

interface TTSButtonProps {
  editor: Editor | null
}

const LANG_MAP: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
}

/**
 * Phase 10 — 본문 읽어주기 (TTS).
 * 선택 영역이 있으면 그것만, 없으면 문서 전체.
 */
export function TTSButton({ editor }: TTSButtonProps) {
  const lang = useI18nStore((s) => s.lang)
  const [speaking, setSpeaking] = useState(false)

  // 100ms 폴링으로 speechSynthesis 상태 동기화
  useEffect(() => {
    if (!isTTSSupported()) return
    const t = setInterval(() => setSpeaking(isTTSSpeaking()), 250)
    return () => clearInterval(t)
  }, [])

  if (!isTTSSupported()) return null

  function start() {
    if (!editor) return
    const sel = editor.state.selection
    const text = sel.empty
      ? editor.state.doc.textContent
      : editor.state.doc.textBetween(sel.from, sel.to, ' ')
    if (!text.trim()) return
    speakTTS({ text: text.slice(0, 5000), lang: LANG_MAP[lang] || 'ko-KR' })
    setSpeaking(true)
  }

  function stop() {
    cancelTTS()
    setSpeaking(false)
  }

  return (
    <button
      onClick={speaking ? stop : start}
      className={speaking ? 'is-active' : ''}
      title={speaking ? 'TTS 중지' : '본문 읽기 (선택 영역 또는 전체)'}
    >
      {speaking ? '■ 정지' : '재생'}
    </button>
  )
}
