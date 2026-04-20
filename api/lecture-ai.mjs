// ============================================================================
// /api/lecture-ai  —  Vercel Edge Function (본인 레포 api/ 아래에 배치)
// ----------------------------------------------------------------------------
// 경로 예: memo/api/lecture-ai.js  (또는 .mjs)
// 환경변수(Vercel Project Settings): OPENAI_API_KEY  (또는 ANTHROPIC_API_KEY)
//
// 역할: 브라우저에서 오는 { task, ctx|session } 요청을 받아 LLM에 프록시.
//       브라우저에 API 키를 절대 노출하지 않기 위함.
// ----------------------------------------------------------------------------

export const config = { runtime: 'edge' };

const OPENAI_KEY = process.env.OPENAI_API_KEY;
// 모델은 필요에 따라 교체.
const MODEL_FAST   = 'gpt-4o-mini';
const MODEL_SMART  = 'gpt-4o';

// System prompt ---------------------------------------------------------------
const SYSTEM = `당신은 '강의 Copilot' 입니다. 학생이 수업 중 실시간으로 필기한 텍스트의
맥락을 읽고, 3가지 이하의 짧고 정확한 제안 카드를 생성합니다.

출력 형식은 반드시 JSON {"cards":[{...}, ...]} 으로만.
각 카드는 다음 스키마:
{
  "kind": "ok" | "warn" | "qz" | "kind",
  "title": "짧은 라벨 (8자 이내 권장)",
  "body":  "한두 문장. 근거가 있으면 인용.",
  "meta":  "근거/출처 한 줄",
  "cta":   ["채택", ...]
}
- 환각 금지. 모르면 카드 만들지 말 것.
- 학생 눈높이의 친절한 말투.
- 한국어 수업 맥락엔 한국어로, 영어면 영어로.`;

// Handlers --------------------------------------------------------------------
async function copilotCards(ctx) {
  if (!OPENAI_KEY) {
    return { cards: [{ kind: 'warn', title: 'AI 키 없음', body: '서버에 OPENAI_API_KEY 환경변수를 설정하세요.', meta: 'Edge Function', cta: ['확인'] }] };
  }

  const user = [
    `[과목] ${ctx.subject || '미지정'}`,
    `[제목] ${ctx.title || ''}`,
    `[언어] ${ctx.language || 'ko-KR'}`,
    '',
    '[최근 필기]',
    ctx.recentTranscript || '(없음)',
  ].join('\n');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type':'application/json', 'authorization':'Bearer ' + OPENAI_KEY },
    body: JSON.stringify({
      model: MODEL_FAST,
      response_format: { type: 'json_object' },
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user }
      ]
    })
  });
  if (!resp.ok) return { cards: [], error: await resp.text() };
  const j = await resp.json();
  try {
    const parsed = JSON.parse(j.choices?.[0]?.message?.content || '{"cards":[]}');
    return parsed;
  } catch {
    return { cards: [] };
  }
}

async function buildSummary(session) {
  if (!OPENAI_KEY) return null;

  const notes = (session.blocks || [])
    .filter(b => b.type !== 'system')
    .map(b => `[${(b.timeMs/1000)|0}s] ${b.text}`)
    .join('\n');

  const sys = `당신은 대학생의 강의노트를 5분 안에 완성해 주는 조수입니다.
아래 원본 필기를 근거로, 결과를 엄격한 JSON 한 개로 출력:
{
 "summary": "마크다운 본문. 3~6개 소제목.",
 "cards":   [ {"kind":"ok","title":"핵심 한줄","body":"...","meta":"...","cta":["채택"]} ],
 "quiz": {
   "multiple_choice":[ {"q":"...","choices":["A","B","C","D","E"],"answer":2,"explain":"..."} ],
   "short_answer":   [ {"q":"...","answer":"...","explain":"..."} ]
 }
}
- 근거 없는 말은 만들지 말 것.
- 수식은 LaTeX 로.
- 한국어 기본, 수업이 영어면 영어.`;

  const user = [
    `[과목] ${session.subject || '미지정'}`,
    `[제목] ${session.title || ''}`,
    `[길이] ${(session.durationMs/60000)|0} 분`,
    '',
    '[원본 필기]',
    notes.slice(0, 20000),  // 안전 한도
  ].join('\n');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type':'application/json', 'authorization':'Bearer ' + OPENAI_KEY },
    body: JSON.stringify({
      model: MODEL_SMART,
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ]
    })
  });
  if (!resp.ok) return { error: await resp.text() };
  const j = await resp.json();
  try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); }
  catch { return {}; }
}

// Entry -----------------------------------------------------------------------
export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  let body = {};
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }

  try {
    if (body.task === 'copilot_cards') {
      const out = await copilotCards(body.ctx || {});
      return Response.json(out);
    }
    if (body.task === 'build_summary') {
      const out = await buildSummary(body.session || {});
      return Response.json(out || {});
    }
    return new Response('unknown task', { status: 400 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
