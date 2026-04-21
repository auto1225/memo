/**
 * JustANotepad — Professional Templates (Pro Pack)
 * --------------------------------------------------------------------------
 * 상업용 수준의 전문 템플릿 15종.
 *
 * 과거 템플릿 문제:
 *   - body 가 순수 마크다운 (## 제목 + 불릿) 이라 단순 텍스트처럼 보였음.
 *   - 표, 색상 구분, 체크박스, 예시 값, 가이드 문구가 없어서 "그냥 탭 추가" 수준.
 *
 * 이 파일은:
 *   - body 필드를 **리치 HTML** 로 제공 (app-integration.js 가 <로 시작하는
 *     body 는 markdown 변환 없이 그대로 insert).
 *   - 표, 체크박스, 섹션 구분선, 가이드 프롬프트, 실제 예시 행 포함.
 *   - app.html 의 theme 변수 (--accent, --paper-edge, --ink) 를 쓰므로
 *     7가지 테마 (노랑/벌꿀/분홍/민트/라벤더/블루/다크) 모두 자연스러움.
 *   - 날짜/사용자 이름 같은 placeholder 는 작성시 치환.
 *
 * 사용법:
 *   window.JAN_BUILTIN_TEMPLATES = [ {slug, name, category, description,
 *     body (HTML), icon, is_official:true}, ... ]
 *   template-picker.js 가 DB 템플릿과 merge 해서 그리드에 표시.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.JAN_BUILTIN_TEMPLATES) return;

  // ---- 공통 partials ----
  // Tip: editor 안에 있으면 .page CSS 가 자동 적용되므로 inline style 최소화.
  // 색상도 CSS var 참조해서 theme 반응형.
  const TODAY = () => {
    const d = new Date();
    return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.`;
  };

  // 섹션 라벨 (컬러 칩 형태) — 테마 변수로 자동 색 맞춤
  const chip = (txt, bg = 'var(--accent)') =>
    `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${bg};color:var(--ink);font-size:11px;font-weight:700;letter-spacing:0.04em;margin-right:6px;">${txt}</span>`;

  const HR = `<hr>`;
  // 점선 구분 — 시각적 breathing
  const HRDOT = `<hr style="border-top:1px dashed var(--paper-edge);">`;

  // 빈 체크박스 리스트 아이템
  const CB = (txt = '') =>
    `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;"><input type="checkbox" style="margin:0;"/><span>&nbsp;${txt}</span></div>`;

  // 메타 행: 키: 값 inline
  const meta = (label, value = '') =>
    `<div style="display:flex;gap:8px;margin:2px 0;"><strong style="min-width:88px;color:color-mix(in srgb, var(--accent) 50%, var(--ink));">${label}</strong><span contenteditable="true" style="flex:1;">${value}</span></div>`;

  // ---------------- Templates ----------------
  const T = [];

  // 1. 일기 (Daily Journal) — 감정 추적 + 감사 + 배움 + 내일 계획
  T.push({
    slug: 'pro-daily-journal',
    name: '📔 일기 (프로)',
    category: '일상',
    description: '하이라이트·감정·감사·배움·내일 계획을 한 장에. 감정 5단계 트래커 포함.',
    icon: '📔',
    is_official: true,
    body: `
<h1>${TODAY()} 일기</h1>
<div style="margin:4px 0 12px;color:color-mix(in srgb, var(--ink) 60%, var(--paper));font-size:12px;">
  ${chip('오늘의 기록')} 작성 5분 · 읽기 1분
</div>

<table style="width:100%;margin-bottom:10px;">
  <tr>
    <th style="width:140px;">오늘의 기분</th>
    <td>😞 나쁨 &nbsp;·&nbsp; 😕 별로 &nbsp;·&nbsp; 😐 보통 &nbsp;·&nbsp; 🙂 좋음 &nbsp;·&nbsp; 😄 최고<br>
        <em style="color:color-mix(in srgb, var(--ink) 55%, var(--paper));">→ 해당 항목에 볼드 처리</em></td>
  </tr>
  <tr>
    <th>에너지 (1-10)</th>
    <td contenteditable="true"></td>
  </tr>
  <tr>
    <th>수면 시간</th>
    <td contenteditable="true"></td>
  </tr>
  <tr>
    <th>날씨 / 기온</th>
    <td contenteditable="true"></td>
  </tr>
</table>

<h2>✨ 오늘의 하이라이트</h2>
<blockquote>오늘 가장 기억에 남는 한 장면을 한 문장으로.</blockquote>
<ul><li></li></ul>

<h2>🙏 감사한 일 3가지</h2>
<ol>
  <li></li>
  <li></li>
  <li></li>
</ol>

<h2>📚 오늘 배운 것</h2>
<ul>
  <li><strong>인사이트:</strong> </li>
  <li><strong>실수 → 교훈:</strong> </li>
</ul>

<h2>💬 오늘 나눈 대화</h2>
<table style="width:100%;">
  <tr><th style="width:140px;">누구와</th><th>요지 / 느낌</th></tr>
  <tr><td></td><td></td></tr>
  <tr><td></td><td></td></tr>
</table>

<h2>🎯 내일 할 일 (Top 3)</h2>
${CB('')}
${CB('')}
${CB('')}

${HRDOT}
<p style="color:color-mix(in srgb, var(--ink) 55%, var(--paper));font-size:12px;">
  <em>오늘의 한 줄: </em><span contenteditable="true"></span>
</p>
`.trim()
  });

  // 2. 주간 플래너 — 7일 캘린더 + 주간 목표
  T.push({
    slug: 'pro-weekly-planner',
    name: '📅 주간 플래너 (프로)',
    category: '플래너',
    description: '이번 주 목표·우선순위 3·7일 스케줄·주간 회고까지 한 페이지 완결.',
    icon: '📅',
    is_official: true,
    body: `
<h1>📅 ${TODAY()} 이 있는 주</h1>

<h2>🎯 이번 주 성공 기준 (3가지를 넘지 말 것)</h2>
<ol>
  <li><strong></strong> — 왜 중요한가? </li>
  <li><strong></strong> — 왜 중요한가? </li>
  <li><strong></strong> — 왜 중요한가? </li>
</ol>

<h2>🗓️ 7일 일정</h2>
<table style="width:100%;">
  <tr>
    <th style="width:14%;">월</th><th style="width:14%;">화</th><th style="width:14%;">수</th>
    <th style="width:14%;">목</th><th style="width:14%;">금</th><th style="width:15%;">토</th><th>일</th>
  </tr>
  <tr style="vertical-align:top;height:120px;">
    <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
  </tr>
</table>

<h2>✅ 이번 주 해치울 일 (MIT — Most Important Tasks)</h2>
${CB('')}
${CB('')}
${CB('')}
${CB('')}
${CB('')}

<h2>⏳ 기다리는 일 (Waiting-for)</h2>
<table style="width:100%;">
  <tr><th style="width:30%;">무엇</th><th style="width:25%;">누구에게</th><th>기한</th></tr>
  <tr><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td></tr>
</table>

<h2>📊 지표 확인 (Weekly Metrics)</h2>
<table style="width:100%;">
  <tr><th>지표</th><th>지난주</th><th>이번주 목표</th><th>실제</th><th>Δ</th></tr>
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
</table>

${HR}
<h2>🔄 주간 회고 (금요일/일요일에 채우기)</h2>
<table style="width:100%;">
  <tr><th style="width:140px;">잘된 것</th><td></td></tr>
  <tr><th>아쉬운 것</th><td></td></tr>
  <tr><th>다음 주 바꿀 것</th><td></td></tr>
</table>
`.trim()
  });

  // 3. 회의록
  T.push({
    slug: 'pro-meeting-minutes',
    name: '🤝 회의록 (프로)',
    category: '비즈니스',
    description: '참석자·안건·결정사항·액션아이템(담당·기한)까지 표준 회의록 포맷.',
    icon: '🤝',
    is_official: true,
    body: `
<h1>🤝 회의록 — <span contenteditable="true" style="border-bottom:1px dashed var(--paper-edge);">[회의 주제]</span></h1>

<table style="width:100%;margin-bottom:10px;">
  <tr><th style="width:120px;">일시</th><td>${TODAY()}  : ~ :</td></tr>
  <tr><th>장소</th><td contenteditable="true">회의실 / Zoom / Teams</td></tr>
  <tr><th>작성자</th><td contenteditable="true"></td></tr>
</table>

<h2>👥 참석자</h2>
<table style="width:100%;">
  <tr><th style="width:25%;">이름</th><th style="width:25%;">소속/직함</th><th>역할</th></tr>
  <tr><td></td><td></td><td>진행자</td></tr>
  <tr><td></td><td></td><td>기록자</td></tr>
  <tr><td></td><td></td><td>의사결정자</td></tr>
</table>

<h2>🎯 회의 목적</h2>
<blockquote>이 회의가 끝났을 때 <strong>무엇이 결정되어 있어야 하는가</strong>를 한 문장으로.</blockquote>
<p></p>

<h2>📋 안건 (Agenda)</h2>
<ol>
  <li><strong></strong> — 발표자:  · 예상 ( )분</li>
  <li><strong></strong> — 발표자:  · 예상 ( )분</li>
  <li><strong></strong> — 발표자:  · 예상 ( )분</li>
</ol>

${HR}

<h2>💬 논의 내용</h2>
<h3>1. </h3>
<ul><li></li></ul>

<h3>2. </h3>
<ul><li></li></ul>

<h2>✅ 결정사항</h2>
<table style="width:100%;">
  <tr><th style="width:60%;">결정 내용</th><th>근거 / 반대 의견</th></tr>
  <tr><td></td><td></td></tr>
  <tr><td></td><td></td></tr>
</table>

<h2>🎬 액션 아이템 (Action Items)</h2>
<table style="width:100%;">
  <tr><th style="width:45%;">무엇을</th><th style="width:20%;">누가</th><th style="width:20%;">언제까지</th><th>상태</th></tr>
  <tr><td></td><td></td><td></td><td>⚪ 예정</td></tr>
  <tr><td></td><td></td><td></td><td>⚪ 예정</td></tr>
  <tr><td></td><td></td><td></td><td>⚪ 예정</td></tr>
</table>

<h2>📌 다음 회의</h2>
<ul>
  <li><strong>일시:</strong> </li>
  <li><strong>주요 의제:</strong> </li>
  <li><strong>사전 준비:</strong> </li>
</ul>
`.trim()
  });

  // 4. 1:1 미팅
  T.push({
    slug: 'pro-one-on-one',
    name: '🎯 1:1 미팅',
    category: '비즈니스',
    description: '매니저·멤버 1:1용. 근황·업무·커리어·피드백·다음 1:1 안건까지.',
    icon: '🎯',
    is_official: true,
    body: `
<h1>🎯 1:1 — <span contenteditable="true">[상대방 이름]</span></h1>
<p style="color:color-mix(in srgb, var(--ink) 55%, var(--paper));">${TODAY()} · 이전 1:1: <span contenteditable="true"></span></p>

<h2>💭 근황 (5분)</h2>
<ul><li></li></ul>

<h2>💼 업무 진행 (15분)</h2>
<table style="width:100%;">
  <tr><th style="width:40%;">진행 중인 일</th><th>상태 / 블로커</th></tr>
  <tr><td></td><td></td></tr>
  <tr><td></td><td></td></tr>
</table>

<h2>🌱 커리어 / 성장 (5분)</h2>
<ul>
  <li><strong>배우고 있는 것:</strong> </li>
  <li><strong>다음 스텝:</strong> </li>
  <li><strong>필요한 지원:</strong> </li>
</ul>

<h2>💬 피드백 (양방향)</h2>
<table style="width:100%;">
  <tr><th style="width:50%;">매니저 → 멤버</th><th>멤버 → 매니저</th></tr>
  <tr style="vertical-align:top;height:80px;"><td></td><td></td></tr>
</table>

<h2>🎬 액션 아이템</h2>
${CB('')}
${CB('')}

<h2>📌 다음 1:1 안건 미리</h2>
<ul><li></li></ul>
`.trim()
  });

  // 5. 프로젝트 킥오프
  T.push({
    slug: 'pro-project-kickoff',
    name: '🚀 프로젝트 킥오프',
    category: '프로젝트',
    description: '범위·목표·일정·역할(RACI)·리스크·성공 지표까지 런칭 전 필수 문서.',
    icon: '🚀',
    is_official: true,
    body: `
<h1>🚀 <span contenteditable="true">[프로젝트명]</span> 킥오프</h1>

<table style="width:100%;margin-bottom:10px;">
  <tr><th style="width:120px;">기간</th><td contenteditable="true">${TODAY()} → </td></tr>
  <tr><th>프로젝트 리드</th><td contenteditable="true"></td></tr>
  <tr><th>스폰서</th><td contenteditable="true"></td></tr>
  <tr><th>예산</th><td contenteditable="true"></td></tr>
</table>

<h2>🎯 목표 (Why)</h2>
<blockquote>이 프로젝트가 <strong>왜</strong> 지금 필요한가? 안 하면 무엇이 문제인가?</blockquote>
<p></p>

<h2>📦 범위 (What)</h2>
<table style="width:100%;">
  <tr><th style="width:50%;">포함 (In Scope)</th><th>제외 (Out of Scope)</th></tr>
  <tr style="vertical-align:top;height:100px;"><td></td><td></td></tr>
</table>

<h2>📅 마일스톤</h2>
<table style="width:100%;">
  <tr><th style="width:25%;">마일스톤</th><th style="width:20%;">날짜</th><th>산출물</th></tr>
  <tr><td>킥오프</td><td>${TODAY()}</td><td>이 문서</td></tr>
  <tr><td>MVP 시연</td><td></td><td></td></tr>
  <tr><td>베타 오픈</td><td></td><td></td></tr>
  <tr><td>정식 런칭</td><td></td><td></td></tr>
</table>

<h2>👥 RACI (Responsible · Accountable · Consulted · Informed)</h2>
<table style="width:100%;">
  <tr><th>활동</th><th>R</th><th>A</th><th>C</th><th>I</th></tr>
  <tr><td>의사결정</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>실행</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>품질 검수</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>릴리스</td><td></td><td></td><td></td><td></td></tr>
</table>

<h2>⚠️ 리스크 & 완화책</h2>
<table style="width:100%;">
  <tr><th style="width:45%;">리스크</th><th style="width:15%;">영향 (상/중/하)</th><th style="width:15%;">가능성</th><th>완화책</th></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
</table>

<h2>📊 성공 지표 (Success Metrics)</h2>
<ol>
  <li><strong>Primary:</strong>  (목표값: )</li>
  <li><strong>Secondary:</strong>  (목표값: )</li>
  <li><strong>Guardrail:</strong>  (넘지 말아야 할 값: )</li>
</ol>
`.trim()
  });

  // 6. 독서 노트
  T.push({
    slug: 'pro-book-notes',
    name: '📖 독서 노트',
    category: '학습',
    description: '책 메타·핵심 인용·내 생각·실천 사항까지 지식을 내 것으로.',
    icon: '📖',
    is_official: true,
    body: `
<h1>📖 <span contenteditable="true">[책 제목]</span></h1>

<table style="width:100%;margin-bottom:10px;">
  <tr><th style="width:100px;">저자</th><td contenteditable="true"></td></tr>
  <tr><th>출판/연도</th><td contenteditable="true"></td></tr>
  <tr><th>분량</th><td contenteditable="true">페이지</td></tr>
  <tr><th>읽은 기간</th><td contenteditable="true">${TODAY()} — </td></tr>
  <tr><th>평점</th><td>★★★★★ (☆ 로 변경)</td></tr>
  <tr><th>한 줄 요약</th><td contenteditable="true"></td></tr>
</table>

<h2>💡 왜 읽었나</h2>
<blockquote>이 책을 통해 <strong>어떤 질문에 답하고</strong> 싶었는가?</blockquote>
<p></p>

<h2>🗝️ 핵심 메시지 (3가지)</h2>
<ol>
  <li><strong></strong> — </li>
  <li><strong></strong> — </li>
  <li><strong></strong> — </li>
</ol>

<h2>📌 인상 깊은 인용</h2>
<table style="width:100%;">
  <tr><th style="width:60px;">페이지</th><th style="width:55%;">인용</th><th>내 생각</th></tr>
  <tr><td></td><td><blockquote style="margin:0;border:0;padding:0;"></blockquote></td><td></td></tr>
  <tr><td></td><td><blockquote style="margin:0;border:0;padding:0;"></blockquote></td><td></td></tr>
  <tr><td></td><td><blockquote style="margin:0;border:0;padding:0;"></blockquote></td><td></td></tr>
</table>

<h2>🎬 내 삶에 적용할 3가지</h2>
${CB('')}
${CB('')}
${CB('')}

<h2>🔗 관련 도서 / 다음 읽을 것</h2>
<ul><li></li></ul>
`.trim()
  });

  // 7. 콘텐츠 리뷰 (영화/시리즈/유튜브)
  T.push({
    slug: 'pro-media-review',
    name: '🎬 영화·콘텐츠 리뷰',
    category: '학습',
    description: '스포일러 없는 요약·인상적 장면·평점·추천 여부까지.',
    icon: '🎬',
    is_official: true,
    body: `
<h1>🎬 <span contenteditable="true">[제목]</span></h1>

<table style="width:100%;margin-bottom:10px;">
  <tr><th style="width:100px;">장르</th><td contenteditable="true"></td></tr>
  <tr><th>러닝타임</th><td contenteditable="true"></td></tr>
  <tr><th>감독/크리에이터</th><td contenteditable="true"></td></tr>
  <tr><th>본 날짜</th><td>${TODAY()}</td></tr>
  <tr><th>시청 플랫폼</th><td contenteditable="true"></td></tr>
  <tr><th>내 평점</th><td>★★★★★ (스토리/연출/연기/재관람)</td></tr>
</table>

<h2>✂️ 스포일러 없는 한 줄</h2>
<blockquote contenteditable="true"></blockquote>

<h2>👍 좋았던 점</h2>
<ul><li></li></ul>

<h2>👎 아쉬운 점</h2>
<ul><li></li></ul>

<h2>💬 가장 인상 깊었던 장면</h2>
<p><strong>(스포일러 주의)</strong> </p>

<h2>🎯 추천 여부</h2>
<ul>
  <li><strong>이런 사람에게 추천:</strong> </li>
  <li><strong>이런 사람에게 비추천:</strong> </li>
</ul>
`.trim()
  });

  // 8. SOP (표준 운영 절차)
  T.push({
    slug: 'pro-sop',
    name: '📝 SOP · 표준 운영 절차',
    category: '비즈니스',
    description: '반복 업무를 누구든 같은 품질로 실행하도록. 버전·오너·트리거 명시.',
    icon: '📝',
    is_official: true,
    body: `
<h1>📝 SOP — <span contenteditable="true">[절차명]</span></h1>

<table style="width:100%;margin-bottom:10px;">
  <tr><th style="width:120px;">버전</th><td>v1.0 (최초 작성 ${TODAY()})</td></tr>
  <tr><th>오너</th><td contenteditable="true"></td></tr>
  <tr><th>리뷰 주기</th><td contenteditable="true">6개월마다</td></tr>
  <tr><th>적용 대상</th><td contenteditable="true"></td></tr>
</table>

<h2>🎯 목적 (Why)</h2>
<blockquote>이 절차가 <strong>왜</strong> 필요한가? 지키지 않으면 무엇이 잘못되나?</blockquote>
<p></p>

<h2>⚡ 트리거 (언제 이 절차를 실행하나)</h2>
<ul><li></li></ul>

<h2>📋 사전 준비물</h2>
<ul>
  <li><strong>권한:</strong> </li>
  <li><strong>도구:</strong> </li>
  <li><strong>데이터:</strong> </li>
</ul>

<h2>🪜 절차 (Step-by-Step)</h2>
<table style="width:100%;">
  <tr><th style="width:50px;">#</th><th>무엇을</th><th style="width:25%;">어떻게 (링크/스크린샷)</th><th style="width:10%;">완료 기준</th></tr>
  <tr><td>1</td><td></td><td></td><td></td></tr>
  <tr><td>2</td><td></td><td></td><td></td></tr>
  <tr><td>3</td><td></td><td></td><td></td></tr>
</table>

<h2>🚨 예외 / 에스컬레이션</h2>
<ul>
  <li><strong>이런 상황이면:</strong>  → <strong>누구에게:</strong> </li>
</ul>

<h2>📊 품질 체크</h2>
${CB('산출물이 체크리스트를 통과했는가')}
${CB('관련자 통보 완료')}
${CB('기록 / 로그 저장')}
`.trim()
  });

  // 9. 고객 인터뷰
  T.push({
    slug: 'pro-user-interview',
    name: '👤 고객 인터뷰',
    category: '리서치',
    description: 'Mom Test 원칙 기반 질문·녹취 요지·인사이트·다음 액션까지.',
    icon: '👤',
    is_official: true,
    body: `
<h1>👤 고객 인터뷰 — <span contenteditable="true">[상대 이니셜 또는 ID]</span></h1>

<table style="width:100%;margin-bottom:10px;">
  <tr><th style="width:100px;">일시</th><td>${TODAY()}</td></tr>
  <tr><th>채널</th><td contenteditable="true">오프라인 / 전화 / 화상</td></tr>
  <tr><th>인터뷰어</th><td contenteditable="true"></td></tr>
  <tr><th>인터뷰이</th><td contenteditable="true">나이·직업·세그먼트</td></tr>
  <tr><th>목적</th><td contenteditable="true">무엇을 검증하려 함</td></tr>
</table>

<h2>🧭 인터뷰 가이드라인 (Mom Test)</h2>
<blockquote>
  ① 미래 가정("하시겠어요?") 대신 <strong>과거 행동</strong>("마지막으로 ~한 게 언제?")을 물어라.<br>
  ② 문제를 먼저 물어라. 솔루션은 <strong>그 다음</strong>.<br>
  ③ 침묵을 두려워하지 말 것. 3초 기다리면 진짜 얘기가 나온다.
</blockquote>

<h2>❓ 핵심 질문 (녹취 요지)</h2>
<table style="width:100%;">
  <tr><th style="width:35%;">질문</th><th>답변 요지</th></tr>
  <tr><td>최근 <em>관련 상황</em> 을 겪은 게 언제입니까?</td><td></td></tr>
  <tr><td>그때 어떻게 해결했습니까?</td><td></td></tr>
  <tr><td>그 방법의 가장 불편한 점은?</td><td></td></tr>
  <tr><td>그 불편을 해결하는 데 돈/시간을 써본 적 있나요?</td><td></td></tr>
  <tr><td>누구에게 이 문제를 상담하십니까?</td><td></td></tr>
</table>

<h2>💡 관찰 (말보다 행동 · 표정 · 단어 선택)</h2>
<ul><li></li></ul>

<h2>🎯 인사이트 (사실 vs 해석 구분)</h2>
<table style="width:100%;">
  <tr><th style="width:50%;">사실 (고객이 한 말/행동)</th><th>해석 (내 가설)</th></tr>
  <tr><td></td><td></td></tr>
  <tr><td></td><td></td></tr>
</table>

<h2>🔄 다음 액션</h2>
${CB('추가 확인할 질문')}
${CB('유사 세그먼트 ( )명 추가 인터뷰')}
${CB('가설 업데이트 → 링크: ')}
`.trim()
  });

  // 10. 제안서 / 견적서
  T.push({
    slug: 'pro-proposal',
    name: '💼 제안서 · 견적서',
    category: '비즈니스',
    description: '표지·문제·솔루션·작업범위·견적표·일정·조건까지 영업 완결형.',
    icon: '💼',
    is_official: true,
    body: `
<h1>💼 제안서 — <span contenteditable="true">[프로젝트명]</span></h1>
<table style="width:100%;margin-bottom:10px;">
  <tr><th style="width:100px;">수신</th><td contenteditable="true"></td></tr>
  <tr><th>발신</th><td contenteditable="true"></td></tr>
  <tr><th>제안일</th><td>${TODAY()}</td></tr>
  <tr><th>유효기간</th><td contenteditable="true">30일</td></tr>
  <tr><th>문서 버전</th><td>v1.0</td></tr>
</table>

<h2>1. 배경 · 문제 정의</h2>
<blockquote>고객이 겪는 문제를 <strong>고객의 언어로</strong>. 숫자 1개 이상 포함.</blockquote>
<p></p>

<h2>2. 제안하는 솔루션</h2>
<ul>
  <li><strong>접근 방식:</strong> </li>
  <li><strong>차별점:</strong> </li>
  <li><strong>기대 효과:</strong> </li>
</ul>

<h2>3. 작업 범위 (Scope of Work)</h2>
<table style="width:100%;">
  <tr><th style="width:50px;">#</th><th>산출물</th><th style="width:20%;">세부 내용</th><th style="width:15%;">기간</th></tr>
  <tr><td>1</td><td></td><td></td><td></td></tr>
  <tr><td>2</td><td></td><td></td><td></td></tr>
  <tr><td>3</td><td></td><td></td><td></td></tr>
</table>

<h2>4. 일정</h2>
<table style="width:100%;">
  <tr><th>단계</th><th>기간</th><th>주요 이벤트</th></tr>
  <tr><td>킥오프</td><td></td><td>계약 체결 후 3영업일 내</td></tr>
  <tr><td>중간 리뷰</td><td></td><td></td></tr>
  <tr><td>최종 납품</td><td></td><td></td></tr>
</table>

<h2>5. 견적 (VAT 별도)</h2>
<table style="width:100%;">
  <tr><th>항목</th><th style="width:15%;">수량</th><th style="width:20%;">단가</th><th style="width:20%;">금액</th></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
  <tr><th colspan="3" style="text-align:right;">합계</th><th></th></tr>
</table>

<h2>6. 결제 조건</h2>
<ul>
  <li>계약금 30% (계약 체결시)</li>
  <li>중도금 30% (중간 리뷰 승인시)</li>
  <li>잔금 40% (최종 납품 후 7일 내)</li>
</ul>

<h2>7. 제외 사항 (Out of Scope)</h2>
<ul><li></li></ul>

<h2>8. 가정 및 제한 (Assumptions)</h2>
<ul><li></li></ul>

${HR}
<p style="text-align:right;">서명: ________________  날짜: ${TODAY()}</p>
`.trim()
  });

  // 11. 발표 스크립트
  T.push({
    slug: 'pro-presentation',
    name: '🎤 발표 스크립트',
    category: '비즈니스',
    description: '슬라이드별 대본·시간 배분·예상 Q&A까지 떨림을 대비한 무대 원고.',
    icon: '🎤',
    is_official: true,
    body: `
<h1>🎤 발표 — <span contenteditable="true">[주제]</span></h1>

<table style="width:100%;margin-bottom:10px;">
  <tr><th style="width:120px;">청중</th><td contenteditable="true">직함·수·전문지식 수준</td></tr>
  <tr><th>장소 / 시간</th><td contenteditable="true"></td></tr>
  <tr><th>할당 시간</th><td contenteditable="true">( )분 (발표 + Q&A)</td></tr>
  <tr><th>1줄 메시지</th><td contenteditable="true">청중이 돌아가면서 기억해야 할 단 한 문장</td></tr>
</table>

<h2>🎯 3가지 핵심 포인트</h2>
<ol>
  <li><strong></strong></li>
  <li><strong></strong></li>
  <li><strong></strong></li>
</ol>

<h2>📑 슬라이드 구성</h2>
<table style="width:100%;">
  <tr><th style="width:50px;">#</th><th style="width:25%;">슬라이드 제목</th><th>핵심 문장 (대본)</th><th style="width:60px;">시간</th></tr>
  <tr><td>1</td><td>오프닝·훅</td><td></td><td>1분</td></tr>
  <tr><td>2</td><td>문제 제기</td><td></td><td>2분</td></tr>
  <tr><td>3</td><td>핵심 1</td><td></td><td></td></tr>
  <tr><td>4</td><td>핵심 2</td><td></td><td></td></tr>
  <tr><td>5</td><td>핵심 3</td><td></td><td></td></tr>
  <tr><td>6</td><td>행동 유도 (CTA)</td><td></td><td>1분</td></tr>
</table>

<h2>❓ 예상 Q&A</h2>
<table style="width:100%;">
  <tr><th style="width:50%;">질문</th><th>답변 키워드</th></tr>
  <tr><td></td><td></td></tr>
  <tr><td></td><td></td></tr>
</table>

<h2>✅ 리허설 체크</h2>
${CB('시간 측정 — 할당시간 ±10% 이내')}
${CB('기기 / 어댑터 점검')}
${CB('백업 (PDF · USB · 클라우드)')}
${CB('첫 30초 암기')}
${CB('물 / 손수건 / 무선 리모컨')}
`.trim()
  });

  // 12. 여행 계획
  T.push({
    slug: 'pro-travel',
    name: '✈️ 여행 계획',
    category: '일상',
    description: '일정·예산·체크리스트·연락처·예약 링크까지. 공항에서 꺼내 쓰는 노트.',
    icon: '✈️',
    is_official: true,
    body: `
<h1>✈️ 여행 — <span contenteditable="true">[목적지]</span></h1>

<table style="width:100%;margin-bottom:10px;">
  <tr><th style="width:120px;">기간</th><td contenteditable="true">${TODAY()} — </td></tr>
  <tr><th>동행자</th><td contenteditable="true"></td></tr>
  <tr><th>비행편</th><td contenteditable="true">가는 편  · 오는 편 </td></tr>
  <tr><th>숙소</th><td contenteditable="true">이름 · 주소 · 체크인/체크아웃</td></tr>
  <tr><th>현지 연락처</th><td contenteditable="true">대사관 · 가이드</td></tr>
</table>

<h2>🗓️ 일정</h2>
<table style="width:100%;">
  <tr><th style="width:60px;">일차</th><th style="width:80px;">날짜</th><th>오전</th><th>오후</th><th>저녁</th></tr>
  <tr><td>1</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>2</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>3</td><td></td><td></td><td></td><td></td></tr>
</table>

<h2>💰 예산</h2>
<table style="width:100%;">
  <tr><th>항목</th><th style="width:20%;">예산</th><th style="width:20%;">실제</th><th>메모</th></tr>
  <tr><td>항공</td><td></td><td></td><td></td></tr>
  <tr><td>숙박</td><td></td><td></td><td></td></tr>
  <tr><td>식사</td><td></td><td></td><td></td></tr>
  <tr><td>교통</td><td></td><td></td><td></td></tr>
  <tr><td>관광/액티비티</td><td></td><td></td><td></td></tr>
  <tr><td>기타</td><td></td><td></td><td></td></tr>
  <tr><th>합계</th><th></th><th></th><th></th></tr>
</table>

<h2>🧳 짐 체크리스트</h2>
<table style="width:100%;">
  <tr><th style="width:33%;">필수</th><th style="width:33%;">의류</th><th>전자/기타</th></tr>
  <tr style="vertical-align:top;"><td>
    ${CB('여권 + 복사본')}
    ${CB('비자 / 입국서류')}
    ${CB('카드 + 현금')}
    ${CB('여행자 보험')}
  </td><td>
    ${CB('속옷 · 양말')}
    ${CB('상의 · 하의')}
    ${CB('편한 신발')}
    ${CB('우산/우비')}
  </td><td>
    ${CB('핸드폰 + 충전기')}
    ${CB('어댑터/멀티탭')}
    ${CB('카메라')}
    ${CB('상비약')}
  </td></tr>
</table>

<h2>🔗 예약 / 확인번호</h2>
<ul>
  <li><strong>항공:</strong> </li>
  <li><strong>숙소:</strong> </li>
  <li><strong>렌터카/교통패스:</strong> </li>
</ul>
`.trim()
  });

  // 13. OKR
  T.push({
    slug: 'pro-okr',
    name: '🎯 OKR 설정',
    category: '플래너',
    description: '분기 Objective 1개 · Key Result 3-5개 · Confidence 트래킹.',
    icon: '🎯',
    is_official: true,
    body: `
<h1>🎯 OKR — <span contenteditable="true">[개인/팀명]</span> · <span contenteditable="true">[분기]</span></h1>

<h2>🌟 Objective</h2>
<blockquote>
  <strong>정성적 · 영감을 주는 · 한 분기 안에 끝낼 수 있는</strong> 한 문장.<br>
  <em>나쁜 예: "매출 증대"  / 좋은 예: "신규 고객이 첫 주에 아하! 하는 제품으로 만든다"</em>
</blockquote>
<p></p>

<h2>📊 Key Results (3-5개)</h2>
<table style="width:100%;">
  <tr>
    <th style="width:40%;">KR — 측정 가능한 결과</th>
    <th style="width:15%;">Baseline</th>
    <th style="width:15%;">Target</th>
    <th style="width:15%;">현재값</th>
    <th>Confidence</th>
  </tr>
  <tr><td>KR1. </td><td></td><td></td><td></td><td>5/10</td></tr>
  <tr><td>KR2. </td><td></td><td></td><td></td><td>5/10</td></tr>
  <tr><td>KR3. </td><td></td><td></td><td></td><td>5/10</td></tr>
</table>

<h2>🧭 주요 이니셔티브 (Initiatives)</h2>
<blockquote>KR 을 달성하기 위해 <strong>무엇을 할 것인가</strong>. KR 마다 2-3개.</blockquote>
<ul>
  <li><strong>KR1 → </strong> </li>
  <li><strong>KR2 → </strong> </li>
  <li><strong>KR3 → </strong> </li>
</ul>

<h2>⚠️ 리스크 / 의존성</h2>
<ul><li></li></ul>

<h2>🔄 주간 체크인</h2>
<table style="width:100%;">
  <tr><th style="width:100px;">주차</th><th>진행</th><th>블로커</th><th>다음 주 초점</th></tr>
  <tr><td>W1</td><td></td><td></td><td></td></tr>
  <tr><td>W2</td><td></td><td></td><td></td></tr>
  <tr><td>W3</td><td></td><td></td><td></td></tr>
  <tr><td>W4</td><td></td><td></td><td></td></tr>
</table>

${HR}
<h2>📝 분기 말 회고</h2>
<ul>
  <li><strong>달성도:</strong> ( )% (0.7 이상이면 적절히 야심)</li>
  <li><strong>가장 큰 배움:</strong> </li>
  <li><strong>다음 분기 바꿀 것:</strong> </li>
</ul>
`.trim()
  });

  // 14. 스프린트 회고
  T.push({
    slug: 'pro-sprint-retro',
    name: '🔄 스프린트 회고',
    category: '프로젝트',
    description: 'Start / Stop / Continue · 투표·루트코즈·액션 아이템까지.',
    icon: '🔄',
    is_official: true,
    body: `
<h1>🔄 회고 — <span contenteditable="true">[스프린트 #]</span></h1>

<table style="width:100%;margin-bottom:10px;">
  <tr><th style="width:120px;">기간</th><td contenteditable="true"></td></tr>
  <tr><th>참여자</th><td contenteditable="true"></td></tr>
  <tr><th>퍼실리테이터</th><td contenteditable="true"></td></tr>
</table>

<h2>📊 스프린트 결과 요약</h2>
<table style="width:100%;">
  <tr><th style="width:33%;">계획 포인트</th><th style="width:33%;">완료 포인트</th><th>캐리오버 포인트</th></tr>
  <tr><td></td><td></td><td></td></tr>
</table>

<h2>🟢 Start (시작하면 좋을 것)</h2>
<ul><li></li></ul>

<h2>🔴 Stop (멈추는 게 나은 것)</h2>
<ul><li></li></ul>

<h2>🟡 Continue (계속 잘하는 것)</h2>
<ul><li></li></ul>

<h2>🗳️ 투표 (가장 중요한 이슈 Top 3)</h2>
<ol>
  <li><strong></strong> — 득표: </li>
  <li><strong></strong> — 득표: </li>
  <li><strong></strong> — 득표: </li>
</ol>

<h2>🔍 루트코즈 분석 (Top 1 이슈)</h2>
<table style="width:100%;">
  <tr><th style="width:120px;">Why 1</th><td></td></tr>
  <tr><th>Why 2</th><td></td></tr>
  <tr><th>Why 3</th><td></td></tr>
  <tr><th>Why 4</th><td></td></tr>
  <tr><th>Why 5 (근본 원인)</th><td></td></tr>
</table>

<h2>🎬 액션 아이템 (다음 스프린트 전까지)</h2>
<table style="width:100%;">
  <tr><th style="width:55%;">실험</th><th style="width:20%;">담당</th><th>성공 기준</th></tr>
  <tr><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td></tr>
</table>
`.trim()
  });

  // 15. 건강 트래킹
  T.push({
    slug: 'pro-health-tracker',
    name: '🏃 건강 트래킹',
    category: '일상',
    description: '체중·식단·운동·수면·컨디션 일일 기록. 주간 요약 포함.',
    icon: '🏃',
    is_official: true,
    body: `
<h1>🏃 건강 — ${TODAY()}</h1>

<table style="width:100%;margin-bottom:10px;">
  <tr>
    <th style="width:20%;">체중</th><td contenteditable="true">kg</td>
    <th style="width:20%;">수면</th><td contenteditable="true">시간</td>
  </tr>
  <tr>
    <th>공복 혈당</th><td contenteditable="true"></td>
    <th>심박(안정)</th><td contenteditable="true"></td>
  </tr>
  <tr>
    <th>혈압</th><td contenteditable="true">/</td>
    <th>기분 (1-10)</th><td contenteditable="true"></td>
  </tr>
</table>

<h2>🍽️ 식단</h2>
<table style="width:100%;">
  <tr><th style="width:80px;">시간</th><th style="width:80px;">식사</th><th>메뉴</th><th style="width:120px;">칼로리/단백질</th></tr>
  <tr><td></td><td>아침</td><td></td><td></td></tr>
  <tr><td></td><td>점심</td><td></td><td></td></tr>
  <tr><td></td><td>간식</td><td></td><td></td></tr>
  <tr><td></td><td>저녁</td><td></td><td></td></tr>
</table>

<h2>💧 수분</h2>
<p>${CB('200ml')}${CB('200ml')}${CB('200ml')}${CB('200ml')}${CB('200ml')}${CB('200ml')}${CB('200ml')}${CB('200ml')}</p>

<h2>💪 운동</h2>
<table style="width:100%;">
  <tr><th style="width:30%;">종목</th><th style="width:20%;">세트×반복</th><th style="width:15%;">중량</th><th>메모</th></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
</table>

<h2>🧘 컨디션 메모</h2>
<ul>
  <li><strong>통증/피로:</strong> </li>
  <li><strong>에너지 피크 시간대:</strong> </li>
  <li><strong>오늘 배운 것:</strong> </li>
</ul>
`.trim()
  });

  // ---- 외부 공개 ----
  window.JAN_BUILTIN_TEMPLATES = T;
  // 빠른 접근용 map
  window.JAN_BUILTIN_TEMPLATE_MAP = Object.fromEntries(T.map(t => [t.slug, t]));
  console.info('[JAN Pro Templates] ' + T.length + '개 로드 완료');
})();
