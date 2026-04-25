/**
 * Phase 5+ — JustANotepad v2 AI Proxy
 * Vercel Serverless Function
 *
 * Endpoint: /api/v2-ai
 * 사용자가 자기 키 없이도 AI 도우미를 쓸 수 있게 서버에서 forward.
 * ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 가 Vercel env 에 설정되어야 함.
 *
 * Body: { provider: 'anthropic'|'openai', model?: string, prompt: string }
 * Response: { ok: bool, text?: string, error?: string }
 *
 * 보호:
 *   - POST 만 허용
 *   - origin 화이트리스트 (justanotepad.com)
 *   - 입력 길이 제한 (16KB)
 *   - 응답 길이 제한 (Anthropic 2048 tokens)
 *
 * 비용 보호: rate limit 은 Vercel 기본 또는 사용자가 추가 설정.
 */

const ALLOWED_ORIGINS = [
  'https://justanotepad.com',
  'https://www.justanotepad.com',
]

function setCors(res, origin) {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  setCors(res, origin)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST only' })
    return
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  body = body || {}

  const { provider, model, prompt } = body
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ ok: false, error: 'prompt 필요' })
    return
  }
  if (prompt.length > 16384) {
    res.status(400).json({ ok: false, error: 'prompt 너무 김 (16KB 초과)' })
    return
  }

  try {
    if (provider === 'anthropic') {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) {
        res.status(500).json({ ok: false, error: '서버에 Anthropic 키 미설정 — 자기 키 사용 모드로 전환하세요' })
        return
      }
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-sonnet-4-6',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!r.ok) {
        const errText = await r.text().catch(() => '')
        res.status(r.status).json({ ok: false, error: `Anthropic ${r.status}: ${errText.slice(0, 250)}` })
        return
      }
      const data = await r.json()
      const text = (data.content || []).map((b) => b.text || '').join('')
      res.status(200).json({ ok: true, text })
      return
    }

    if (provider === 'openai') {
      const key = process.env.OPENAI_API_KEY
      if (!key) {
        res.status(500).json({ ok: false, error: '서버에 OpenAI 키 미설정' })
        return
      }
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
        const errText = await r.text().catch(() => '')
        res.status(r.status).json({ ok: false, error: `OpenAI ${r.status}: ${errText.slice(0, 250)}` })
        return
      }
      const data = await r.json()
      const text = data.choices?.[0]?.message?.content || ''
      res.status(200).json({ ok: true, text })
      return
    }

    res.status(400).json({ ok: false, error: '지원하지 않는 provider' })
  } catch (e) {
    res.status(500).json({ ok: false, error: '프록시 실패: ' + (e?.message || String(e)) })
  }
}
