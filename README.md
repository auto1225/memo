<div align="center">
  <img src="logo.svg" alt="JustANotepad" width="180" />

  # JustANotepad

  ***it was supposed to be just a notepad.***

  브라우저에서 바로 쓰는 단일 HTML 파일 메모장. 시작은 그냥 메모장이었는데… 어쩌다 보니 여기까지.
</div>

---

## 주요 기능

### 핵심 편집
- **리치 텍스트**: 글꼴·크기(pt)·색상·정렬·첨자·제목(H1~H3)·표·코드블록
- **6종 배경**: 줄노트·모눈·점격·무지·오선지·코넬 노트
- **손글씨/펜 모드**: 필압 감지, 팜 리젝션, Bézier 부드러운 곡선
- **찾아바꾸기** (정규식·대소문자·단어 단위)
- **탭/워크스페이스/태그/즐겨찾기**

### AI 기능 (멀티 프로바이더: OpenAI / Gemini / Claude)
- **AI Vision OCR**: 손글씨 → 텍스트 / LaTeX 수식 / Markdown 표
- **요약·개선·이어쓰기·번역·질문·플래시카드 자동 생성**
- **명함 자동 추출**: 이름·회사·직책·연락처·SNS 구조화 파싱

### 명함관리 (Business Cards)
- 촬영·업로드·드래그앤드롭·클립보드 붙여넣기
- **16개 SNS 플랫폼**: LinkedIn, X, Facebook, Instagram, KakaoTalk, WeChat, WhatsApp, Line, Telegram, GitHub, YouTube, TikTok, Naver, Threads, Slack, Discord
- URL 자동 감지 → 올바른 플랫폼으로 이동
- **iOS/Android 연락처 연동**: Web Contacts API + vCard(.vcf) + QR 코드
- 미팅 히스토리, 즐겨찾기, 그룹, 통계, 중복 검사

### 회의 노트 (CLOVA Note 스타일)
- 녹음 + 실시간 받아쓰기(ko-KR)
- AI 화자분리 / 요약 / 키워드 / 액션 아이템 추출

### 생산성
- **인앱 웹 브라우저**: 8개 검색엔진
- **15 수식 템플릿**: 분수·적분·행렬·극한·조건식
- **300+ 특수문자**: 수학·그리스·화살표·단위
- **갤러리 뷰**: 썸네일 카드, 7 스마트 필터
- **캘린더**: 날짜 자동 인식, 오늘 메모
- **플래시카드·워드 클라우드·포모도로 타이머**
- **링크 프리뷰 카드** (YouTube/GitHub 썸네일)

### 내보내기 & 보안
- PDF / Word(DOCX) / HTML / Markdown / SRT / TXT
- 탭 암호화 (AES-GCM)
- Windows 전체 폰트 지원 (queryLocalFonts API)

## 사용법

`sticky-memo.html` 파일을 브라우저에서 열면 바로 사용 가능.

### 권장 환경
- Chrome / Edge 109+ (MathML, queryLocalFonts, Contacts API 지원)
- 마이크·스타일러스는 기기/브라우저 권한 필요
- AI 기능은 OpenAI/Gemini/Claude 중 하나의 API 키 필요 (무료 옵션은 Gemini 추천)

### 바탕화면 앱으로 설치
1. 파일을 Chrome/Edge로 열기
2. 주소창 우측의 "앱 설치" 또는 메뉴 → 앱으로 설치
3. 독립 창으로 뜨면서 바탕화면 아이콘 생성
4. 모바일에서는 "홈 화면에 추가"

## 브랜드

<div align="center">
  <table>
    <tr>
      <td align="center">
        <img src="favicon.svg" width="48" height="48" /><br>
        <sub>Favicon (32×32)</sub>
      </td>
      <td align="center">
        <img src="logo.svg" width="120" /><br>
        <sub>Full Logo (400×400)</sub>
      </td>
    </tr>
  </table>
</div>

**컬러 팔레트** (Lavender 테마)
- Primary: `#8A5FD1`
- Dark: `#5B3DA8`
- Paper: `#F4E9FF`
- Ink: `#3A2E55`

**타이포그래피**
- Logo wordmark: *Georgia italic bold* — 손글씨 메모 느낌
- UI: system sans-serif

## 파일 구조

- `sticky-memo.html` — 단일 HTML 파일, 모든 기능 내장
- `logo.svg` — 로고 (풀 버전, README/소개용)
- `favicon.svg` — 파비콘

## 라이선스

개인 사용 및 커스터마이징 자유.

---

<div align="center">
  <sub>Made with (too much) time · <i>it really was supposed to be just a notepad.</i></sub>
</div>
