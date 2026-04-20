// JustANotepad — Gemini Proxy (Vercel Serverless Function)
// 인증된 사용자만 / Gemini 3 → 2.5 → 2.0 Flash 자동 폴백
// 환경변수: GEMINI_API_KEY (Vercel 대시보드에서 설정)

const SUPABASE_URL = 'https://rbscvtnfveakwjwrteux.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pOcoS24k7_qknydx17mGnw_YFygv4hB';
const MODELS = ['gemini-3-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. 인증 헤더 확인
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: '로그인이 필요합니다', code: 'unauthorized' });
    }

    // 2. Supabase로 사용자 검증
    const userRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': auth
      }
    });
    if (!userRes.ok) {
      return res.status(401).json({ error: '유효하지 않은 세션', code: 'invalid_session' });
    }
    const user = await userRes.json();
    if (!user.id) {
      return res.status(401).json({ error: '사용자 정보 없음', code: 'no_user' });
    }

    // 3. 환경변수 확인
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({ error: '서버 설정 오류 (GEMINI_API_KEY 미설정)', code: 'no_key' });
    }

    // 4. 요청 본문 파싱
    const body = req.body || {};
    const sys = body.sys || '당신은 도움이 되는 한국어 AI 어시스턴트입니다.';
    const userMsg = body.user || body.prompt || '';
    const image = body.image;  // { mimeType, data (base64) } optional
    if (!userMsg && !image) return res.status(400).json({ error: '메시지가 비어있습니다' });

    // 5. Gemini 호출 (폴백 체인). 이미지가 있으면 멀티모달 parts 구성.
    const parts = [];
    if (userMsg) parts.push({ text: userMsg });
    if (image && image.data && image.mimeType) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    }

    let lastError = '';
    for (const model of MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sys }] },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              maxOutputTokens: image ? 2000 : 1200,   // vision responses can run longer
              temperature: image ? 0.2 : 0.7,         // vision → deterministic
            }
          })
        });
        if (r.ok) {
          const d = await r.json();
          const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
          return res.status(200).json({
            text,
            model,
            user_id: user.id
          });
        } else {
          const errTxt = await r.text();
          lastError = `${model}: ${r.status} — ${errTxt.slice(0, 150)}`;
        }
      } catch (e) {
        lastError = `${model}: ${e.message}`;
      }
    }

    return res.status(502).json({ error: 'AI 응답 실패: ' + lastError, code: 'upstream_error' });
  } catch (e) {
    return res.status(500).json({ error: e.message, code: 'internal_error' });
  }
}
