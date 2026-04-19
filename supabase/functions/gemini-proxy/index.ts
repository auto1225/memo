// JustANotepad — Gemini Proxy Edge Function
// 사용자 인증 + 일일 한도 + Gemini 3 → 2.5 → 2.0 Flash 자동 폴백
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DAILY_LIMIT = 50; // 사용자당 하루 요청 수
const MODELS = ["gemini-3-flash", "gemini-2.5-flash", "gemini-2.0-flash"]; // 자동 폴백 순서

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1) 인증 확인
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return json(
        { error: "로그인이 필요합니다", code: "unauthorized" },
        401,
      );
    }

    // 2) 일일 한도 확인
    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await supabase
      .from("ai_usage")
      .select("requests")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    const used = usage?.requests ?? 0;
    if (used >= DAILY_LIMIT) {
      return json(
        {
          error:
            `오늘 무료 한도 ${DAILY_LIMIT}회 다 쓰셨어요. 본인 API 키를 넣으시면 무제한으로 쓰실 수 있어요.`,
          code: "rate_limit",
          remaining: 0,
          limit: DAILY_LIMIT,
        },
        429,
      );
    }

    // 3) Gemini 호출 (폴백 체인)
    const body = await req.json();
    const sys = body.sys || "당신은 도움이 되는 AI 어시스턴트입니다.";
    const userMsg = body.user || body.prompt || "";

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return json(
        { error: "서버 설정 오류 (GEMINI_API_KEY 미설정)" },
        500,
      );
    }

    let resultText = "";
    let usedModel = "";
    let lastError = "";
    for (const model of MODELS) {
      try {
        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sys }] },
            contents: [{ role: "user", parts: [{ text: userMsg }] }],
            generationConfig: {
              maxOutputTokens: 1200,
              temperature: 0.7,
            },
          }),
        });
        if (r.ok) {
          const d = await r.json();
          resultText = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          usedModel = model;
          break;
        } else {
          const err = await r.text();
          lastError = `${model}: ${r.status} ${err.slice(0, 120)}`;
          continue;
        }
      } catch (e) {
        lastError = `${model}: ${(e as Error).message}`;
        continue;
      }
    }

    if (!usedModel) {
      return json({ error: "AI 응답 실패: " + lastError }, 502);
    }

    // 4) 사용량 증가
    await supabase
      .from("ai_usage")
      .upsert(
        {
          user_id: user.id,
          date: today,
          requests: used + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,date" },
      );

    return json({
      text: resultText,
      model: usedModel,
      remaining: DAILY_LIMIT - used - 1,
      limit: DAILY_LIMIT,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
