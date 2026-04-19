# 기본 AI (Gemini) 배포 가이드

JustANotepad의 "기본 AI (무료)" 기능을 활성화하는 3단계입니다.
API 키 없는 사용자도 가입만 하면 바로 AI를 쓸 수 있게 됩니다.

## 1단계. Google AI Studio API 키 발급 (무료)

1. https://aistudio.google.com/apikey 접속
2. **Create API key** 클릭
3. 키 복사 (`AIza…` 로 시작)

무료 티어: 1,500 요청/일, 1M 토큰/일 — 사용자 ~30명까지 커버 가능

## 2단계. Supabase에 시크릿 등록

Supabase 대시보드 → `rbscvtnfveakwjwrteux` 프로젝트 → **Project Settings → Edge Functions → Manage Secrets**

또는 CLI:
```bash
supabase secrets set GEMINI_API_KEY=AIza...
```

## 3단계. SQL 실행 (사용량 테이블 생성)

Supabase SQL Editor에서 `supabase-gemini-schema.sql` 내용 전체 복사 → Run.

## 4단계. Edge Function 배포

### 옵션 A: Supabase CLI (권장)
```bash
npm install -g supabase
supabase login
supabase link --project-ref rbscvtnfveakwjwrteux
supabase functions deploy gemini-proxy
```

### 옵션 B: 대시보드 수동 배포
1. Supabase 대시보드 → Edge Functions → **Create a new function**
2. 이름: `gemini-proxy`
3. 코드: `supabase/functions/gemini-proxy/index.ts` 내용 복사 · 붙여넣기
4. **Deploy** 클릭

## 확인

앱에서 로그인 후 AI 패널 열기 → "기본 AI (무료)" 선택 → 질문 → 응답이 오면 성공.

## 트러블슈팅

- **401 Unauthorized** → 로그인 세션 확인
- **429 Rate limit** → 하루 50회 한도. 다음 날 리셋.
- **500 GEMINI_API_KEY 미설정** → 2단계 재확인
- **502 AI 응답 실패** → Gemini 3/2.5가 아직 무료 티어에 없으면 자동으로 2.0으로 폴백됨. 그래도 실패면 Google AI Studio 키 한도 초과 가능성.

## 조정 가능한 값 (index.ts)

- `DAILY_LIMIT = 50` → 사용자당 하루 요청 수
- `MODELS = [...]` → 모델 우선순위 (앞에서부터 시도, 실패 시 다음)
- `maxOutputTokens: 1200` → 응답 최대 길이
