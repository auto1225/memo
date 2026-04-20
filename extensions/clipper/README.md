# JustANotepad Web Clipper

현재 보고 있는 웹 페이지를 **JustANotepad 수신함**에 저장하는 Chrome/Edge 확장.

## 로컬에서 설치하기 (스토어 게시 전 테스트)

1. Chrome/Edge/Whale 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 토글 ON
3. **압축해제된 확장 프로그램 로드** → 이 폴더(`extensions/clipper`) 선택
4. 툴바에 `j.` 아이콘이 뜨면 클릭해서 팝업 열기

## 로그인 연결

확장은 자체 로그인 UI가 없습니다. 다음 중 하나:

- `justanotepad.com` 에 로그인한 뒤, 팝업의 **"로그인 확인"** 버튼 누르기
  → 웹 페이지와 연동된 landing-auth 스크립트가 session token을
  `chrome.storage.local`로 전달합니다 (externally connectable).

## 단축키

- `Ctrl+Shift+J` (Windows/Linux) 또는 `Cmd+Shift+J` (Mac): 현재 페이지 저장
- 우클릭 컨텍스트 메뉴: 전체 / 선택 영역 / 링크 저장 3종

## 데이터 흐름

`팝업 → supabase-shim.js → Supabase REST → cms_clips`

저장된 클립은:
- 사용자 앱(`/app?view=clips`)의 **수신함**에서 확인 · 노트로 변환
- 관리자 CMS(`/admin` → 콘텐츠 라이브러리 → 웹 클리퍼 수신함)에서 모든 사용자 클립 관리

## 파일 구조

```
manifest.json         Manifest V3
background.js         Service worker (context menu, keyboard shortcut)
popup.html            툴바 아이콘 팝업 UI
popup.js              팝업 로직
supabase-shim.js      Supabase REST 경량 래퍼
config.js             공개 설정 (URL, anon key)
icons/                아이콘 (16/32/48/128)
```

## 스토어 게시 체크리스트

- [ ] 프로덕션 anon key가 config.js에 맞게 설정되어 있음
- [ ] 스크린샷 1280x800 3장
- [ ] 개인정보처리방침 URL (`https://justanotepad.com/privacy`)
- [ ] `externally_connectable` 매니페스트에 justanotepad.com 추가 (다음 버전)
