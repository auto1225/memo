/**
 * Phase 10 — 음성 입력 (STT) + 음성 합성 (TTS).
 * Web Speech API. Chrome / Edge 지원, Safari 부분 지원, Firefox 미지원.
 */

interface SpeechAPI {
  SpeechRecognition?: any
  webkitSpeechRecognition?: any
}

declare const window: Window & SpeechAPI & typeof globalThis

export function isSTTSupported(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export interface STTHandle {
  stop: () => void
  abort: () => void
}

export interface STTOptions {
  lang?: string // 'ko-KR' | 'en-US' | 'ja-JP'
  interim?: boolean // 중간 결과
  onResult: (text: string, isFinal: boolean) => void
  onError?: (e: Error) => void
  onEnd?: () => void
}

/** STT 시작. 반환값으로 stop/abort 가능. */
export function startSTT(opts: STTOptions): STTHandle | null {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Ctor) return null
  const recog = new Ctor()
  recog.lang = opts.lang || 'ko-KR'
  recog.continuous = true
  recog.interimResults = opts.interim ?? true

  recog.onresult = (e: any) => {
    let interim = ''
    let final = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) final += t
      else interim += t
    }
    if (final) opts.onResult(final, true)
    else if (interim && opts.interim !== false) opts.onResult(interim, false)
  }
  recog.onerror = (e: any) => {
    opts.onError?.(new Error(e.error || 'speech error'))
  }
  recog.onend = () => {
    opts.onEnd?.()
  }
  try {
    recog.start()
  } catch (e: any) {
    opts.onError?.(e)
    return null
  }
  return {
    stop: () => { try { recog.stop() } catch {} },
    abort: () => { try { recog.abort() } catch {} },
  }
}

export interface TTSOptions {
  text: string
  lang?: string
  rate?: number // 0.1 ~ 10
  pitch?: number // 0 ~ 2
  voice?: string // SpeechSynthesisVoice.name
}

// ttsHandle: not currently exposed but may be useful later

export function speakTTS(opts: TTSOptions) {
  if (!isTTSSupported()) return
  cancelTTS()
  const u = new SpeechSynthesisUtterance(opts.text)
  u.lang = opts.lang || 'ko-KR'
  if (opts.rate != null) u.rate = opts.rate
  if (opts.pitch != null) u.pitch = opts.pitch
  if (opts.voice) {
    const v = window.speechSynthesis.getVoices().find((vv) => vv.name === opts.voice)
    if (v) u.voice = v
  }
  window.speechSynthesis.speak(u)
}

export function cancelTTS() {
  if (!isTTSSupported()) return
  try { window.speechSynthesis.cancel() } catch {}
}

export function isTTSSpeaking(): boolean {
  return isTTSSupported() && window.speechSynthesis.speaking
}

export function getTTSVoices(): SpeechSynthesisVoice[] {
  if (!isTTSSupported()) return []
  return window.speechSynthesis.getVoices()
}
