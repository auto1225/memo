# Supabase 연결 가이드

JustANotepad의 클라우드 동기화를 활성화하려면 Supabase 프로젝트가 필요합니다.
**5분이면 완료**되는 간단한 설정입니다.

## 1. Supabase 프로젝트 생성

1. https://supabase.com 접속 → **"Start your project"** 클릭
2. GitHub 계정으로 로그인
3. **"New Project"** 클릭
4. 설정:
   - **Name**: `justanotepad`
   - **Database Password**: 안전한 비밀번호 생성 후 **저장**
   - **Region**: `Northeast Asia (Seoul) ap-northeast-2` 또는 `(Tokyo) ap-northeast-1` 권장
   - **Plan**: `Free` (MAU 5만까지 무료)
5. **"Create new project"** → 2분 대기

## 2. 데이터베이스 스키마 적용

1. 프로젝트 대시보드 → 왼쪽 메뉴 **"SQL Editor"**
2. **"+ New query"** 클릭
3. 저장소의 `supabase-schema.sql` 파일 전체 내용 복사
4. SQL Editor에 붙여넣기
5. **"Run"** 버튼 클릭
6. 하단에 `Schema 적용 완료` 메시지 확인

## 3. Google OAuth 설정

1. Supabase 대시보드 → **"Authentication"** → **"Providers"**
2. **Google** 찾아서 **"Enable"** 토글
3. Google Cloud Console 설정 (별도 안내):
   - https://console.cloud.google.com/apis/credentials
   - OAuth 2.0 클라이언트 ID 생성
   - 승인된 리디렉션 URI에 추가:
     ```
     https://[your-project-id].supabase.co/auth/v1/callback
     ```
   - Client ID + Secret 복사
4. Supabase에 Client ID · Secret 입력 → **Save**

## 4. Redirect URL 허용

1. Supabase → **"Authentication"** → **"URL Configuration"**
2. **Site URL**: `https://justanotepad.com`
3. **Redirect URLs**에 추가:
   ```
   https://justanotepad.com/app
   https://justanotepad.vercel.app/app
   http://localhost:*/app
   ```

## 5. API 키 획득

1. 대시보드 → 왼쪽 메뉴 맨 아래 **"Project Settings"** (톱니바퀴)
2. **"API"** 탭
3. 복사할 2가지:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Project API keys → `anon` `public`**: `eyJhbGc...` (긴 문자열)

⚠️ **`anon` 키는 공개 가능합니다** (Row Level Security로 보호됨)
⚠️ **`service_role` 키는 절대 클라이언트에 노출하지 마세요**

## 6. Vercel에 설정

Claude에게 **Project URL + anon key** 2가지만 알려주세요.
제가 Vercel 환경변수 또는 `config.js`로 주입하고 배포합니다.

## 완료 후 확인

앱 우측 상단에 **사람 아이콘 버튼** 표시되면 설정 완료:
- 클릭 → Google 로그인 팝업
- 로그인 후 자동으로 클라우드 저장 시작
- 다른 기기에서도 로그인하면 모든 데이터 동기화

## 트러블슈팅

**Q. 로그인 버튼이 안 보여요**
→ `config.js`가 배포되지 않았거나 `window.SUPABASE_URL` 설정 실패
→ 브라우저 콘솔에서 `window.JANSync?.enabled` 확인

**Q. 로그인 후 리다이렉트 실패**
→ Supabase "Redirect URLs"에 `/app` 경로 누락된 경우
→ URL Configuration 재확인

**Q. RLS 정책으로 접근 거부**
→ SQL 스키마가 제대로 실행됐는지 확인
→ SQL Editor에서 `select * from pg_policies;` 로 정책 조회

**Q. 동기화가 안 돼요**
→ 브라우저 콘솔에서 `[Sync]` 로그 확인
→ Network 탭에서 Supabase 요청 상태 확인

## 비용

| 사용량 | 무료 플랜 한계 | 초과 시 |
|--------|---------------|---------|
| 월 활성 사용자 (MAU) | 50,000 | Pro $25/월 |
| 데이터베이스 | 500 MB | $0.125/GB |
| 실시간 동시 연결 | 200 | $10/100 추가 |
| Storage | 1 GB | $0.021/GB |
| Egress | 5 GB | $0.09/GB |

**개인 메모장 용도로는 수만 명까지 무료로 충분합니다.**
