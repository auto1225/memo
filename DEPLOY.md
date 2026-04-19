# JustANotepad 전 플랫폼 배포 Runbook

4주 스프린트 — 전 플랫폼 스토어 등록까지.

---

## Week 1: PWA + Tauri 데스크톱 (무료)

### ✅ 이미 완료된 것 (이 세션에서)
- [x] 아이콘 19종 (16 ~ 1024px, maskable 포함) → `/icons/`
- [x] 강화된 `manifest.json` (share_target, file_handlers, protocol_handlers, shortcuts)
- [x] Tauri 2 프로젝트 스캐폴드 → `/src-tauri/`
- [x] 포스트잇 기능 코드 (시스템 트레이 + 항상 위에) → `src-tauri/src/main.rs`
- [x] 개인정보 처리방침 → `/privacy.html`
- [x] 이용약관 → `/terms.html`
- [x] 스토어 메타데이터 → `/store-metadata/`
- [x] GitHub Actions 자동 빌드 → `.github/workflows/`
- [x] package.json (Capacitor 의존성)

### 📋 사용자 실행 필요

#### 1. Rust 설치
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

#### 2. Tauri 로컬 빌드 (본인 OS용)
```bash
cd memo
npm install
npx tauri build
```
→ Windows면 `.msi`, Mac이면 `.dmg`, Linux면 `.deb`/`.AppImage` 생성

#### 3. 자동 빌드 트리거 (전 플랫폼)
```bash
git tag v1.0.0
git push origin v1.0.0
```
→ GitHub Actions가 Mac/Windows/Linux 빌드 전부 자동 생성 → Releases에 업로드

---

## Week 2: Microsoft Store + Google Play

### Microsoft Store (1시간 · 무료)

1. https://www.pwabuilder.com/ 접속
2. URL 입력: `https://justanotepad.com`
3. "Package For Stores" → Windows
4. MSIX 패키지 다운로드
5. https://partner.microsoft.com/dashboard → Windows & Xbox → Create new app
6. 이름 예약: "JustANotepad"
7. 패키지 업로드 + 스토어 정보 입력
8. 심사 (보통 당일~3일)

### Google Play (2~3시간)

#### 준비
- 서명 키 생성:
```bash
keytool -genkey -v -keystore android.keystore -alias justanotepad \
  -keyalg RSA -keysize 2048 -validity 10000
```
- 키스토어 비밀번호 기억 ([반드시 안전한 곳에 백업])
- GitHub Secrets에 base64 인코딩하여 등록:
```bash
base64 android.keystore | tr -d '\n' > android.keystore.base64
# 내용을 GitHub → Settings → Secrets → ANDROID_KEYSTORE_BASE64에 붙여넣기
```

#### Bubblewrap 로컬 빌드
```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://justanotepad.com/manifest.json
bubblewrap build
```
→ `app-release-bundle.aab` 생성

#### Play Console 제출
1. https://play.google.com/console 접속
2. 앱 만들기 → 이름: JustANotepad → 무료 → 한국/전 세계
3. "앱 콘텐츠" → 개인정보 처리방침 URL 입력
4. "내부 테스트" → AAB 업로드 → 출시
5. Data Safety: 이메일 + 메모 수집 고지
6. 콘텐츠 등급 설문 (전체이용가)
7. 스토어 등재 정보 (설명 · 스크린샷)
8. 프로덕션 출시 → 심사 1~3일

### Digital Asset Links (TWA 필수)
`.well-known/assetlinks.json` 파일 생성 필요. Google Play 서명 후 나오는 SHA-256 지문을 포함.
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.justanotepad.app",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FROM_PLAY_CONSOLE"]
  }
}]
```
→ https://justanotepad.com/.well-known/assetlinks.json 으로 접근 가능해야 함

---

## Week 3: Apple App Store (Mac 필수)

### 준비
- Mac 컴퓨터 (MacBook, Mac mini 등)
- Xcode 15+ 설치
- Apple Developer Program 가입 (이미 있음)
- 인증서 생성:
  1. developer.apple.com → Certificates → Create
  2. iOS Distribution 인증서
  3. App Store Provisioning Profile

### Capacitor 프로젝트 생성 (Mac에서)
```bash
cd memo
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```
→ Xcode 열림

### Xcode 설정
1. Signing & Capabilities → Team 선택
2. Bundle Identifier: `com.justanotepad.app`
3. Version: 1.0.0, Build: 1
4. App Category: Productivity

### App Store Connect
1. https://appstoreconnect.apple.com 접속
2. My Apps → + → New App
3. Platform: iOS, Name: JustANotepad
4. Bundle ID: com.justanotepad.app
5. Primary Language: 한국어

### 빌드 업로드
Xcode → Product → Archive → Distribute App → App Store Connect

### 심사 제출
1. App Store Connect에서 빌드 선택
2. 앱 설명 · 스크린샷 · 아이콘 업로드
3. App Privacy → 수집 정보 고지 (이메일, 콘텐츠)
4. Export Compliance → 암호화 사용 여부 (HTTPS만 — Yes, exempt)
5. Submit for Review → 1~7일 심사

### Apple의 대표적 리젝트 사유 대응
- "단순 WebView 래퍼" → Capacitor의 네이티브 플러그인 사용 (Preferences, StatusBar 등)
- "가입 강제" → 정당한 이유 명시 (동기화/다운로드)
- "결제 숨김" → 결제 없음이므로 해당 없음

---

## Week 4: 마무리

### 랜딩페이지 업데이트
각 플랫폼 다운로드 버튼 추가:
```html
<div class="download-row">
  <a href="https://github.com/.../releases">Windows 다운로드</a>
  <a href="https://github.com/.../releases">Mac 다운로드</a>
  <a href="https://apps.apple.com/...">App Store</a>
  <a href="https://play.google.com/...">Google Play</a>
  <a href="https://apps.microsoft.com/...">Microsoft Store</a>
</div>
```

### 마케팅
- 한국: 디스콰이엇, 생활코딩, 프로덕트 헌트 (영어) 
- 제로베이스 키워드: "가입 없이 쓰는 메모장" → "무료 AI 메모장"
- 블로그 포스팅 1개 작성

---

## 필수 GitHub Secrets 체크리스트

```
✅ GITHUB_TOKEN (자동)
☐ APPLE_CERTIFICATE (base64 .p12)
☐ APPLE_CERTIFICATE_PASSWORD
☐ APPLE_SIGNING_IDENTITY
☐ APPLE_ID
☐ APPLE_PASSWORD (app-specific password)
☐ APPLE_TEAM_ID
☐ ANDROID_KEYSTORE_BASE64
☐ ANDROID_KEYSTORE_PASSWORD
☐ ANDROID_KEY_ALIAS
☐ ANDROID_KEY_PASSWORD
```

---

## 트러블슈팅

### Tauri 빌드 실패 (Linux)
`apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev`

### Android Gradle 오류
JDK 17+ 필요

### iOS 아카이브 실패
Xcode → Preferences → Accounts에서 Apple ID 재로그인

### Google Play 내부 테스트 미노출
업로드 후 10분 정도 대기 필요 · 테스트 트랙에 테스터 이메일 등록

---

## 예상 타임라인

- **Week 1**: 오늘 시작 — Tauri 데스크톱 배포 (GitHub Releases에 바이너리)
- **Week 2**: Microsoft Store 승인 + Google Play 심사 시작
- **Week 3**: Google Play 출시 + App Store 심사 시작
- **Week 4**: App Store 출시 + 마케팅

**최대 4주 후 전 플랫폼 스토어 출시 완료.**
