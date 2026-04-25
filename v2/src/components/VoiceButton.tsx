import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { startSTT, isSTTSupported, type STTHandle } from '../lib/speech'
import { useI18nStore } from '../lib/i18n'

interface VoiceButtonProps {
  editor: Editor | null
}

const LANG_MAP: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
}

/**
 * Phase 10 — 음성 입력 버튼.
 * 클릭 → 마이크 권한 → 발화 → editor 에 텍스트 삽입.
 */
export function VoiceButton({ editor }: VoiceButtonProps) {
  const lang = useI18nStore((s) => s.lang)
  const [recording, setRecording] = useState(false)
  const [handle, setHandle] = useState<STTHandle | null>(null)

  if (!isSTTSupported()) return null

  function start() {
    if (!editor) return
    const h = startSTT({
      lang: LANG_MAP[lang] || 'ko-KR',
      interim: false,
      onResult: (text, isFinal) => {
        if (isFinal && text.trim()) {
          editor!.chain().focus().insertContent(text + ' ').run()
        }
      },
      onError: (e) => {
        console.warn('[STT]', e)
        setRecording(false)
        setHandle(null)
      },
      onEnd: () => {
        setRecording(false)
        setHandle(null)
      },
    })
    if (h) {
      setHandle(h)
      setRecording(true)
    }
  }

  function stop() {
    handle?.stop()
    setRecording(false)
    setHandle(null)
  }

  return (
    <button
      onClick={recording ? stop : start}
      className={recording ? 'is-active' : ''}
      title={recording ? '음성 입력 중지' : '음성 입력 시작'}
      aria-pressed={recording}
    >
      {recording ? '●' : '🎤'.replace('🎤', '음성')}
    </button>
  )
}
