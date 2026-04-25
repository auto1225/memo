/**
 * Phase 5 — Claude/GPT 실 API 연결.
 * 사용자가 SettingsModal 에 입력한 키로 직접 호출.
 *
 * 보안: 키는 localStorage 에 저장 (전송 X). CORS — Anthropic/OpenAI 모두 브라우저 직접 호출 가능.
 *   Anthropic: 2024 부터 anthropic-dangerous-direct-browser-access 헤더로 허용.
 *   OpenAI: 항상 허용.
 */
import { useSettingsStore } from '../store/settingsStore'

export type AiMode = 'summarize' | 'translate' | 'improve' | 'continue' | 'paper-cite'

const PROMPTS: Record<AiMode, (text: string) => string> = {
  summarize: (t) =>
    `다음 글을 한국어로 핵심만 5줄 이내로 요약. 불필요한 군더더기 없이 정보 밀도 높게.\n\n${t}`,
  translate: (t) =>
    `Translate the following Korean text to natural English. Preserve formatting (paragraphs, lists). Output only the translation:\n\n${t}`,
  improve: (t) =>
    `다음 한국어 글을 더 명확하고 매끄럽게 다듬어줘. 의미는 유지하되 어색한 표현·중복 제거. 결과 텍스트만 반환:\n\n${t}`,
  continue: (t) =>
    `다음 글의 흐름을 이어서 자연스럽게 1~2문단을 더 작성. 같은 어조·시제 유지:\n\n${t}`,
  'paper-cite': (t) =>
    `Extract candidate citation references from the following research-style text. Return JSON: {"refs":[{"author":"","year":"","title":"","venue":""}]}.\n\n${t}`,
}

export interface AiCallResult {
  ok: boolean
  text?: string
  error?: string
}

/** Anthropic Claude API 호출. */
async function callAnthropic(prompt: string, model: string, key: string): Promise<AiCallResult> {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!r.ok) {
      const err = await r.text()
      return { ok: false, error: `Anthropic ${r.status}: ${err.slice(0, 300)}` }
    }
    const data = await r.json()
    const text = (data.content || []).map((b: any) => b.text || '').join('')
    return { ok: true, text }
  } catch (e: any) {
    return { ok: false, error: 'Anthropic 네트워크 오류: ' + e.message }
  }
}

/** OpenAI Chat Completions API 호출. */
async function callOpenAI(prompt: string, model: string, key: string): Promise<AiCallResult> {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
      }),
    })
    if (!r.ok) {
      const err = await r.text()
      return { ok: false, error: `OpenAI ${r.status}: ${err.slice(0, 300)}` }
    }
    const data = await r.json()
    const text = data.choices?.[0]?.message?.content || ''
    return { ok: true, text }
  } catch (e: any) {
    return { ok: false, error: 'OpenAI 네트워크 오류: ' + e.message }
  }
}

/** 메인 진입점. settingsStore 의 provider 에 따라 적절한 API 호출. */
export async function runAi(mode: AiMode, text: string): Promise<AiCallResult> {
  const s = useSettingsStore.getState()
  const prompt = PROMPTS[mode](text)
  if (s.aiProvider === 'anthropic') {
    if (!s.anthropicKey) return { ok: false, error: '설정에서 Anthropic API 키를 입력하세요' }
    return callAnthropic(prompt, s.aiModel || 'claude-sonnet-4-6', s.anthropicKey)
  }
  if (s.aiProvider === 'openai') {
    if (!s.openaiKey) return { ok: false, error: '설정에서 OpenAI API 키를 입력하세요' }
    return callOpenAI(prompt, s.aiModel || 'gpt-4o-mini', s.openaiKey)
  }
  return { ok: false, error: 'AI 제공자가 설정되지 않음 — 설정 모달에서 Anthropic 또는 OpenAI 선택' }
}

export function aiConfigured(): boolean {
  const s = useSettingsStore.getState()
  if (s.aiProvider === 'anthropic') return !!s.anthropicKey
  if (s.aiProvider === 'openai') return !!s.openaiKey
  return false
}
