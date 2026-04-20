/**
 * justanotepad · Lecture Mode Adapter (예시 구현)
 * --------------------------------------------------------------------------
 * lecture-mode.js 의 hook 지점을 실제로 연결하는 샘플 어댑터.
 *
 *   1) Supabase 에 세션 + 블록 + 카드 저장
 *   2) Copilot 카드 생성 (LLM) — OpenAI/Anthropic/Gemini 중 선택
 *   3) 수업 종료 요약/퀴즈/플래시카드 생성
 *
 * 통합 (app.html, lecture-mode.js 앞에):
 *   <script type="module" src="./lecture-adapter.js"></script>
 *   <script type="module" src="./lecture-mode.js"></script>
 *
 * 주의: AI API 호출은 반드시 "본인 서버(엣지 함수)" 경유로 하세요.
 *       브라우저에서 직접 키를 노출하면 절대 안 됩니다.
 *       아래 AI_ENDPOINT 는 자기 Vercel/Supabase 엣지 함수 URL 을 가리켜야 합니다.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';

  // ---- 설정 ----
  // 본인 환경에 맞게 한 줄만 교체하세요.
  const SUPABASE_URL  = 'https://rbscvtnfveakwjwrteux.supabase.co';
  const SUPABASE_ANON = 'sb_publishable_pOcoS24k7_qknydx17mGnw_YFygv4hB'; // publishable key — RLS로 보호됨, 브라우저 노출 안전
  const AI_ENDPOINT   = '/api/lecture-ai';                       // Vercel Edge Function (본인 소유)

  let supabase = null;
  async function getClient() {
    if (supabase) return supabase;
    // Supabase JS 를 동적 import. CDN 로 불러와도 OK.
    const mod = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = mod.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return supabase;
  }

  async function whoami() {
    const sb = await getClient();
    const { data } = await sb.auth.getUser();
    return data?.user || null;
  }

  // ==========================================================
  // 1) 세션 저장
  // ==========================================================
  async function saveSession(session) {
    const user = await whoami();
    if (!user) { console.warn('[lecture-adapter] not logged in; skip Supabase save'); return; }

    const sb = await getClient();

    // 세션 insert
    const { data: s, error } = await sb.from('lecture_sessions').insert({
      user_id: user.id,
      title: session.title,
      subject_name: session.subject,
      started_at: session.createdAt,
      duration_ms: session.durationMs,
      language: session.language || 'ko-KR'
    }).select().single();

    if (error) { console.warn('[lecture-adapter] session insert', error); return; }

    // 블록 bulk insert (1000개씩 분할)
    const blocks = session.blocks.map(b => ({
      session_id: s.id, user_id: user.id,
      type: b.type, text: b.text, meta: b.meta || {},
      time_ms: b.timeMs, confidence: b.meta?.confidence || null
    }));
    for (let i = 0; i < blocks.length; i += 1000) {
      const chunk = blocks.slice(i, i + 1000);
      const { error: e } = await sb.from('lecture_blocks').insert(chunk);
      if (e) console.warn('[lecture-adapter] blocks insert', e);
    }

    // 카드 insert
    if (session.cards?.length) {
      const rows = session.cards.map(c => ({
        session_id: s.id, user_id: user.id,
        kind: c.kind || 'ok', title: c.title, body: c.body,
        meta: c.meta ? { raw: c.meta } : {}
      }));
      await sb.from('lecture_cards').insert(rows);
    }

    // 타임라인 이벤트
    if (session.events?.length) {
      const rows = session.events.map(e => ({
        session_id: s.id, user_id: user.id,
        track: e.track, time_ms: e.t, label: e.label
      }));
      await sb.from('lecture_events').insert(rows);
    }

    console.log('[lecture-adapter] saved to Supabase', s.id);
    return s.id;
  }

  // ==========================================================
  // 2) Copilot 카드 생성 (엣지 함수 경유)
  // ==========================================================
  async function getCopilotCards(ctx) {
    try {
      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'copilot_cards', ctx })
      });
      if (!res.ok) throw new Error('AI ' + res.status);
      const data = await res.json();
      return Array.isArray(data?.cards) ? data.cards : [];
    } catch (e) {
      console.warn('[lecture-adapter] getCopilotCards failed', e);
      return [];
    }
  }

  // ==========================================================
  // 3) 수업 종료 후 요약·퀴즈·플래시카드
  // ==========================================================
  async function buildSummary(session) {
    try {
      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'build_summary', session })
      });
      if (!res.ok) throw new Error('AI ' + res.status);
      return await res.json(); // { summary, cards, quiz }
    } catch (e) {
      console.warn('[lecture-adapter] buildSummary failed', e);
      return null;
    }
  }

  // 전역 adapter 등록
  window.justanotepadLectureAdapter = Object.assign(
    {}, window.justanotepadLectureAdapter || {},
    {
      saveSession,
      getCopilotCards,
      buildSummary
    }
  );

  console.info('[lecture-adapter] ready. Endpoint:', AI_ENDPOINT);
})();
