/**
 * JustANotepad — Roles Pack (추가 30 역할 + 고품질 템플릿)
 * --------------------------------------------------------------------------
 * app.html 의 ROLES 객체가 비어있지 않으면 이 파일이 추가 역할을 주입.
 * 기존 역할: 초/중/고/대/대학원/주니어/시니어/프리랜서/주부/노년 (10개)
 * 이 파일이 추가: 전문직·크리에이티브·라이프스타일·특수 직군 30개
 *
 * 각 역할 = { name, icon, color, desc, tools, templates }
 * 템플릿 = 해당 역할이 매일/매주 쓰는 실무 수준 워크플로우.
 * 이모지 사용 X, <svg> <use> 인라인.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.JAN_ROLES_EXTRA) return;

  // ---- SVG 헬퍼 (app.html 의 스프라이트 참조) ----
  const ic = (id, sz = 16) =>
    `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px;opacity:0.85;"><use href="#${id}"/></svg>`;
  const TODAY = () => {
    const d = new Date();
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  };
  const CB = (t = '') =>
    `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;"><input type="checkbox" style="margin:0;"/><span>&nbsp;${t}</span></div>`;
  const call = (kind, title, body) => {
    const c = { tip: 'var(--accent)', warn: '#ff9800', info: '#2196f3' }[kind] || 'var(--accent)';
    return `<div style="border-left:4px solid ${c};background:color-mix(in srgb, ${c} 10%, var(--paper));padding:8px 12px;margin:8px 0;border-radius:4px;"><strong style="font-size:12px;opacity:0.75;">${title}</strong><div style="margin-top:4px;font-size:13px;">${body}</div></div>`;
  };

  // 표준 섹션 헤더
  const sh = (iconId, title, sub = '') =>
    `<h2>${ic(iconId, 20)}${title}${sub ? `<span style="font-weight:normal;font-size:13px;color:color-mix(in srgb, var(--ink) 55%, var(--paper));margin-left:8px;">${sub}</span>` : ''}</h2>`;

  // ────────────────────────────────────────────────────────────────
  // Role Pack 정의 — 30개
  // ────────────────────────────────────────────────────────────────
  const R = {};

  // ========== PROFESSIONAL (전문직) ==========
  R['pm'] = {
    name: '기획자 (PM/PO)', icon: 'i-target', color: '#3f51b5',
    desc: 'PRD·Sprint·백로그·제품 지표', tools: ['dday', 'timetrack'],
    templates: [
      { name: 'PRD — Product Requirements Document', html: `
<h1>${ic('i-target',20)}PRD — <span contenteditable="true">[기능명]</span></h1>
<table style="width:100%;">
  <tr><th>문서 ID</th><td>PRD-${new Date().getFullYear()}-001</td><th>상태</th><td>초안/리뷰/승인</td></tr>
  <tr><th>작성자</th><td></td><th>마지막 업데이트</th><td>${TODAY()}</td></tr>
</table>
${sh('i-help','문제 정의','왜 이 기능이 필요한가')}
<table style="width:100%;"><tr><th>문제</th><td>해결할 고객의 문제</td></tr><tr><th>영향받는 사용자</th><td>세그먼트·볼륨</td></tr><tr><th>지금 어떻게 해결하고 있나</th><td>현재 우회책</td></tr><tr><th>안 하면 잃는 것</th><td>기회비용</td></tr></table>
${sh('i-target','성공 지표 (North Star)')}
<table style="width:100%;"><tr><th>지표</th><th>Baseline</th><th>목표</th><th>측정 방법</th></tr><tr><td>Primary</td><td></td><td></td><td></td></tr><tr><td>Secondary</td><td></td><td></td><td></td></tr><tr><td>Guardrail</td><td></td><td></td><td></td></tr></table>
${sh('i-sparkles','사용자 스토리')}
<p><b>페르소나:</b> </p><p><b>As a</b> __ , <b>I want to</b> __ , <b>so that</b> __</p>
${sh('i-list','요구사항 — MUST / SHOULD / COULD')}
<table style="width:100%;"><tr><th>우선순위</th><th>요구사항</th><th>수용 기준</th></tr><tr><td>MUST</td><td></td><td>Given/When/Then</td></tr><tr><td>SHOULD</td><td></td><td></td></tr><tr><td>COULD</td><td></td><td></td></tr></table>
${sh('i-warning','고려사항 · 엣지케이스')}
<ul><li><b>에러·예외:</b> </li><li><b>접근성:</b> </li><li><b>국제화:</b> </li><li><b>보안·프라이버시:</b> </li></ul>
${sh('i-calendar','릴리스 계획')}
<table style="width:100%;"><tr><th>단계</th><th>날짜</th><th>내용</th></tr><tr><td>디자인 리뷰</td><td></td><td></td></tr><tr><td>개발 시작</td><td></td><td></td></tr><tr><td>QA</td><td></td><td></td></tr><tr><td>내부 베타</td><td></td><td></td></tr><tr><td>출시 (GA)</td><td></td><td></td></tr></table>
${call('info','PRD 리뷰 체크','① 문제가 명확한가 ② 지표가 측정 가능한가 ③ 엣지케이스 커버 ④ 디자인·엔지 모두 읽음')}
`.trim() },
      { name: '스프린트 계획 (2주)', html: `
<h1>${ic('i-rocket',20)}스프린트 — <span contenteditable="true">#</span></h1>
<table style="width:100%;"><tr><th>기간</th><td>${TODAY()} ~ </td><th>스프린트 골</th><td contenteditable="true">한 문장</td></tr><tr><th>팀 capacity</th><td>__일×__명</td><th>Velocity</th><td>지난 3스프린트 평균 __</td></tr></table>
${sh('i-target','스프린트 목표')}<blockquote>이 스프린트 끝에 <b>무엇을 데모</b>할 수 있는가?</blockquote>
${sh('i-list-ol','커밋 티켓')}
<table style="width:100%;"><tr><th>#</th><th>티켓</th><th>담당</th><th>SP</th><th>리스크</th></tr><tr><td>1</td><td></td><td></td><td></td><td></td></tr><tr><td>2</td><td></td><td></td><td></td><td></td></tr><tr><td>3</td><td></td><td></td><td></td><td></td></tr><tr><th>합계 SP</th><th></th><th></th><th></th><th></th></tr></table>
${sh('i-warning','리스크 & 완화책')}<ul><li></li></ul>
${sh('i-check','데일리 스탠드업 메모')}
<table style="width:100%;"><tr><th>날짜</th><th>Highlight</th><th>블로커</th></tr><tr><td>D1</td><td></td><td></td></tr><tr><td>D2</td><td></td><td></td></tr></table>`.trim() },
      { name: '제품 지표 리뷰 (주간)', html: `
<h1>${ic('i-wordcloud',20)}제품 지표 주간 리뷰 — ${TODAY()}</h1>
<table style="width:100%;"><tr><th>지표</th><th>이번주</th><th>지난주</th><th>Δ%</th><th>WoW 추세</th><th>원인 가설</th></tr>
<tr><td>DAU</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>MAU</td><td></td><td></td><td></td><td></td><td></td></tr>
<tr><td>신규 가입</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>유지율 D7</td><td></td><td></td><td></td><td></td><td></td></tr>
<tr><td>전환율</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>매출</td><td></td><td></td><td></td><td></td><td></td></tr>
<tr><td>CAC</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>LTV</td><td></td><td></td><td></td><td></td><td></td></tr>
</table>
${sh('i-search','탐구가 필요한 이상 신호')}<ul><li></li></ul>
${sh('i-send','이번 주 액션')}${CB('')}${CB('')}${CB('')}`.trim() }
    ]
  };

  R['designer'] = {
    name: '디자이너 (UX/UI)', icon: 'i-palette', color: '#e91e63',
    desc: '디자인 리뷰·유저 리서치·디자인 시스템', tools: ['timetrack', 'dday'],
    templates: [
      { name: '디자인 리뷰 (피드백 수집)', html: `
<h1>${ic('i-palette',20)}디자인 리뷰 — <span contenteditable="true">[프로젝트/화면]</span></h1>
<table style="width:100%;"><tr><th>일시</th><td>${TODAY()}</td><th>Figma</th><td contenteditable="true">link</td></tr><tr><th>참석자</th><td></td><th>단계</th><td>와이어프레임/시안/고충실도</td></tr></table>
${sh('i-target','리뷰 목표','무엇을 결정하려 하는가')}<p></p>
${sh('i-thumbs-up','좋았던 점 (누가 → 무엇)')}<ul><li></li></ul>
${sh('i-thumbs-down','개선 포인트 — 심각도 구분')}
<table style="width:100%;"><tr><th>P</th><th>이슈</th><th>근거</th><th>제안</th><th>결정</th></tr><tr><td>P0</td><td>치명적</td><td></td><td></td><td></td></tr><tr><td>P1</td><td>중요</td><td></td><td></td><td></td></tr><tr><td>P2</td><td>나중에</td><td></td><td></td><td></td></tr></table>
${sh('i-help','의사결정 필요')}<ul><li></li></ul>
${sh('i-send','다음 액션')}${CB('')}${CB('')}`.trim() },
      { name: '유저 인터뷰 계획서', html: `
<h1>${ic('i-smile',20)}유저 인터뷰 계획 — <span contenteditable="true">[연구주제]</span></h1>
${sh('i-target','연구 질문')}<ol><li></li><li></li><li></li></ol>
${sh('i-list','섭외 기준 (스크리너)')}<table style="width:100%;"><tr><th>기준</th><th>포함/제외</th></tr><tr><td>세그먼트</td><td></td></tr><tr><td>제품 사용 빈도</td><td></td></tr><tr><td>나이·지역</td><td></td></tr></table>
${sh('i-help','인터뷰 가이드 (60분)')}<ol><li><b>아이스브레이킹 (5분):</b> </li><li><b>맥락·배경 (10분):</b> </li><li><b>과업 관찰 (20분):</b> </li><li><b>심층 질문 (20분):</b> </li><li><b>마무리 (5분):</b> </li></ol>
${call('warn','Mom Test 원칙','가정·의견 대신 <b>구체적 과거 사례</b>·<b>행동</b>을 물어볼 것')}
${sh('i-clipboard','인터뷰 후 24시간 내 요약')}`.trim() }
    ]
  };

  R['dev'] = {
    name: '개발자 (엔지니어)', icon: 'i-code', color: '#607d8b',
    desc: '기술 스펙·코드 리뷰·인시던트·학습 노트', tools: ['timetrack', 'dday'],
    templates: [
      { name: '기술 스펙 (RFC/Design Doc)', html: `
<h1>${ic('i-code',20)}기술 스펙 — <span contenteditable="true">[제목]</span></h1>
<table style="width:100%;"><tr><th>작성자</th><td></td><th>상태</th><td>초안/리뷰/승인</td></tr><tr><th>리뷰어</th><td></td><th>날짜</th><td>${TODAY()}</td></tr></table>
${sh('i-target','TL;DR (3줄)')}<p></p>
${sh('i-help','Context & 문제')}<p></p>
${sh('i-sparkles','목표 & 비목표')}<table style="width:100%;"><tr><th>In Scope</th><th>Out of Scope</th></tr><tr><td></td><td></td></tr></table>
${sh('i-folder','제안 설계 (아키텍처)')}<p>주요 컴포넌트, 데이터 흐름, DB 스키마…</p>
${sh('i-list-ol','대안과 trade-off')}<table style="width:100%;"><tr><th>옵션</th><th>장점</th><th>단점</th><th>선택</th></tr><tr><td>A</td><td></td><td></td><td>●</td></tr><tr><td>B</td><td></td><td></td><td></td></tr></table>
${sh('i-warning','리스크·보안·성능·마이그레이션')}<ul><li><b>성능:</b> p99, QPS 영향</li><li><b>보안:</b> 위협 모델</li><li><b>마이그레이션:</b> 기존 데이터 처리</li><li><b>롤백:</b> 실패시 전략</li></ul>
${sh('i-calendar','일정 & 마일스톤')}${CB('Design 리뷰 완료')}${CB('Feature flag 배포')}${CB('점진적 출시 10% → 50% → 100%')}${CB('문서·운영 가이드 업데이트')}`.trim() },
      { name: '코드 리뷰 체크리스트', html: `
<h1>${ic('i-check',20)}코드 리뷰 — PR #<span contenteditable="true"></span></h1>
<table style="width:100%;"><tr><th>PR 링크</th><td></td><th>작성자</th><td></td></tr><tr><th>타입</th><td>feat/fix/refactor/chore</td><th>사이즈</th><td>+__ / -__</td></tr></table>
${sh('i-check','기능성')}${CB('요구사항을 정확히 구현하는가')}${CB('엣지 케이스·에러 경로 커버')}${CB('기존 기능 regression 없음')}
${sh('i-sparkles','가독성')}${CB('변수·함수명이 명확')}${CB('주석은 "왜"만 설명 (무엇은 코드로)')}${CB('큰 함수는 작게 분리')}
${sh('i-warning','안전성')}${CB('입력 검증·SQL injection·XSS')}${CB('민감 정보 로그 없음')}${CB('동시성·경쟁 조건')}
${sh('i-wordcloud','성능')}${CB('N+1 쿼리 없음')}${CB('불필요한 렌더링 없음')}${CB('메모리 누수 가능성 확인')}
${sh('i-book','테스트')}${CB('단위 테스트 커버')}${CB('테스트가 실제 동작을 검증')}${CB('플래키 테스트 없음')}
${sh('i-quote','리뷰 코멘트 요약')}<ul><li></li></ul>`.trim() },
      { name: '인시던트 포스트모텀', html: `
<h1>${ic('i-warning',20)}인시던트 — <span contenteditable="true">[제목]</span></h1>
<table style="width:100%;"><tr><th>인시던트 ID</th><td>INC-${new Date().getFullYear()}-001</td><th>심각도</th><td>SEV1/2/3</td></tr><tr><th>발생</th><td></td><th>해결</th><td></td></tr><tr><th>총 시간</th><td>__분</td><th>영향</th><td>사용자 __명, 매출 __</td></tr></table>
${sh('i-clock','타임라인 (UTC)')}<table style="width:100%;"><tr><th>시각</th><th>이벤트</th><th>행동</th></tr><tr><td>T-0</td><td>첫 알람</td><td>온콜 페이지</td></tr><tr><td>T+5</td><td>증상 확인</td><td></td></tr><tr><td>T+N</td><td>해결</td><td></td></tr></table>
${sh('i-search','근본 원인 (5-Whys)')}<ol><li></li><li></li><li></li><li></li><li></li></ol>
${sh('i-thumbs-up','잘된 점')}<ul><li></li></ul>
${sh('i-thumbs-down','개선할 점')}<ul><li></li></ul>
${sh('i-send','액션 아이템')}<table style="width:100%;"><tr><th>할 일</th><th>담당</th><th>기한</th><th>타입</th></tr><tr><td></td><td></td><td></td><td>예방/감지/완화</td></tr></table>
${call('tip','블레임리스 원칙','사람 아닌 <b>시스템·프로세스</b>를 비판. "왜 그 결정이 당시에 합리적으로 보였나?"를 물어볼 것.')}`.trim() }
    ]
  };

  R['data'] = {
    name: '데이터 분석가', icon: 'i-wordcloud', color: '#00bcd4',
    desc: 'SQL·대시보드·리포트·가설 검증', tools: ['timetrack', 'dday'],
    templates: [
      { name: '분석 리포트 (Insight)', html: `
<h1>${ic('i-wordcloud',20)}분석 — <span contenteditable="true">[주제]</span></h1>
<table style="width:100%;"><tr><th>요청자</th><td></td><th>날짜</th><td>${TODAY()}</td></tr><tr><th>데이터 출처</th><td></td><th>기간</th><td></td></tr></table>
${sh('i-help','비즈니스 질문')}<blockquote><b>무엇을</b> 알고 싶은가? <b>답이 나오면 누가 무슨 결정</b>을 하는가?</blockquote><p></p>
${sh('i-target','분석 계획 & 가설')}<ul><li><b>가설 H1:</b> </li><li><b>가설 H2:</b> </li><li><b>통제 변수:</b> </li></ul>
${sh('i-list','핵심 발견 Top 3')}<ol><li><b></b> — 근거: </li><li><b></b> — 근거: </li><li><b></b> — 근거: </li></ol>
${sh('i-wordcloud','데이터 표')}<table style="width:100%;"><tr><th>세그먼트</th><th>지표 A</th><th>지표 B</th><th>지표 C</th></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><th>합계</th><th></th><th></th><th></th></tr></table>
${sh('i-send','추천 액션')}<table style="width:100%;"><tr><th>액션</th><th>예상 효과</th><th>비용</th><th>우선순위</th></tr><tr><td></td><td></td><td></td><td>H/M/L</td></tr></table>
${sh('i-warning','한계 & 주의')}<ul><li>데이터 품질·누락·샘플 크기·상관≠인과</li></ul>`.trim() },
      { name: 'SQL 쿼리 playbook', html: `
<h1>${ic('i-code',20)}SQL Playbook — <span contenteditable="true">[분석명]</span></h1>
<table style="width:100%;"><tr><th>DB</th><td>BigQuery/Snowflake/Postgres</td><th>예상 소요</th><td>__분</td></tr></table>
${sh('i-folder','테이블 스키마')}<table style="width:100%;"><tr><th>테이블</th><th>주요 컬럼</th><th>PK</th></tr><tr><td></td><td></td><td></td></tr></table>
${sh('i-code','쿼리')}<pre class="code">SELECT
  date_trunc('day', created_at) AS day,
  count(distinct user_id) AS dau,
  sum(amount) AS gmv
FROM orders
WHERE created_at >= current_date - 30
GROUP BY 1
ORDER BY 1;</pre>
${sh('i-sparkles','실행 결과 스냅샷')}<ul><li>행 수: </li><li>실행 시간: </li><li>이상치: </li></ul>
${sh('i-warning','퀄리티 체크')}${CB('NULL / 중복 검사')}${CB('합계·평균이 상식 범위')}${CB('타임존 일관성')}${CB('필터가 의도대로 (off-by-one 주의)')}`.trim() }
    ]
  };

  R['marketer'] = {
    name: '마케터', icon: 'i-send', color: '#ff5722',
    desc: '캠페인·콘텐츠·퍼널·경쟁분석', tools: ['dday', 'timetrack'],
    templates: [
      { name: '캠페인 브리프', html: `
<h1>${ic('i-send',20)}캠페인 — <span contenteditable="true">[캠페인명]</span></h1>
<table style="width:100%;"><tr><th>기간</th><td></td><th>예산</th><td>₩</td></tr><tr><th>담당</th><td></td><th>채널</th><td></td></tr></table>
${sh('i-target','목표 (SMART)')}<ul><li><b>인지:</b> 노출 __회</li><li><b>획득:</b> 가입 __명</li><li><b>매출:</b> ROAS __%</li></ul>
${sh('i-smile','타깃 페르소나')}<table style="width:100%;"><tr><th>세그먼트</th><th>페인포인트</th><th>인사이트 (왜 이 상품)</th></tr><tr><td></td><td></td><td></td></tr></table>
${sh('i-quote','메시지 & Creative')}<ul><li><b>한 문장 가치 제안:</b> </li><li><b>헤드라인 3가지:</b> </li><li><b>CTA:</b> </li><li><b>톤·스타일:</b> </li></ul>
${sh('i-calendar','일정 & 산출물')}<table style="width:100%;"><tr><th>날짜</th><th>산출물</th><th>담당</th></tr><tr><td></td><td>기획서</td><td></td></tr><tr><td></td><td>크리에이티브</td><td></td></tr><tr><td></td><td>런칭</td><td></td></tr></table>
${sh('i-wordcloud','KPI 측정')}<table style="width:100%;"><tr><th>채널</th><th>예산</th><th>노출</th><th>클릭</th><th>전환</th><th>ROAS</th></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><th>합계</th><th></th><th></th><th></th><th></th><th></th></tr></table>`.trim() },
      { name: '경쟁 분석', html: `
<h1>${ic('i-search',20)}경쟁 분석 — <span contenteditable="true">[카테고리]</span></h1>
<table style="width:100%;"><tr><th>경쟁사</th><th>타깃</th><th>가격</th><th>강점</th><th>약점</th><th>차별화 기회</th></tr><tr><td>A</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>B</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>C</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>당사</td><td></td><td></td><td></td><td></td><td></td></tr></table>
${sh('i-sparkles','포지셔닝')}<p>당사 = 유일하게 __ 를 __ 수준으로 제공하는 브랜드</p>
${sh('i-send','다음 액션')}<ol><li></li></ol>`.trim() }
    ]
  };

  R['sales'] = {
    name: '영업', icon: 'i-trophy', color: '#ffa726',
    desc: '리드·파이프라인·미팅 노트·클로징', tools: ['timetrack', 'dday'],
    templates: [
      { name: '영업 파이프라인', html: `
<h1>${ic('i-trophy',20)}파이프라인 — ${TODAY()}</h1>
<table style="width:100%;"><tr><th>단계</th><th>딜 수</th><th>예상 가액</th><th>가중치</th><th>가중 가액</th><th>이번 달 클로징</th></tr>
<tr><td>Qualified</td><td></td><td></td><td>10%</td><td></td><td></td></tr>
<tr><td>Meeting Set</td><td></td><td></td><td>25%</td><td></td><td></td></tr>
<tr><td>Proposal</td><td></td><td></td><td>50%</td><td></td><td></td></tr>
<tr><td>Negotiation</td><td></td><td></td><td>75%</td><td></td><td></td></tr>
<tr><td>Closed Won</td><td></td><td></td><td>100%</td><td></td><td></td></tr>
<tr><th>합계</th><th></th><th></th><th></th><th></th><th></th></tr>
</table>
${sh('i-target','이번 달 목표')}<ul><li>할당량: ₩</li><li>커밋: ₩</li><li>업사이드: ₩</li></ul>
${sh('i-warning','위험 딜')}<ul><li></li></ul>`.trim() },
      { name: '디스커버리 콜 노트', html: `
<h1>${ic('i-quote',20)}디스커버리 — <span contenteditable="true">[고객사]</span></h1>
<table style="width:100%;"><tr><th>고객</th><td></td><th>직책</th><td></td></tr><tr><th>회사</th><td></td><th>산업·규모</th><td></td></tr></table>
${sh('i-help','BANT Plus')}<table style="width:100%;"><tr><th>Budget</th><td></td></tr><tr><th>Authority (의사결정자)</th><td></td></tr><tr><th>Need (문제)</th><td></td></tr><tr><th>Timeline</th><td></td></tr><tr><th>Champion (사내 아군)</th><td></td></tr></table>
${sh('i-search','고객 말 그대로 (녹취)')}<blockquote></blockquote>
${sh('i-warning','경쟁·대안 언급')}<ul><li></li></ul>
${sh('i-send','Next Steps')}<table style="width:100%;"><tr><th>할 일</th><th>담당 (우리/고객)</th><th>날짜</th></tr><tr><td></td><td></td><td></td></tr></table>`.trim() }
    ]
  };

  R['consultant'] = {
    name: '컨설턴트', icon: 'i-briefcase', color: '#455a64',
    desc: 'SCR 리포트·워크샵·프레임워크', tools: ['timetrack', 'dday'],
    templates: [{ name: 'SCR (Situation-Complication-Resolution) 보고', html: `
<h1>${ic('i-briefcase',20)}SCR 보고 — <span contenteditable="true">[주제]</span></h1>
${sh('i-info','Situation (현재 상황)')}<p>객관적 사실 — 고객이 동의할 수 있는 수준으로.</p>
${sh('i-warning','Complication (문제·변화)')}<p>왜 지금 행동이 필요한가.</p>
${sh('i-help','Question (답해야 할 질문)')}<p></p>
${sh('i-target','Resolution (권고)')}<ol><li>권고 1 — 근거·영향</li><li>권고 2 — 근거·영향</li><li>권고 3 — 근거·영향</li></ol>
${sh('i-list','실행 로드맵')}<table style="width:100%;"><tr><th>단계</th><th>기간</th><th>산출물</th><th>성공 지표</th></tr><tr><td>분석·진단</td><td></td><td></td><td></td></tr><tr><td>설계</td><td></td><td></td><td></td></tr><tr><td>실행</td><td></td><td></td><td></td></tr></table>`.trim() }]
  };

  R['founder'] = {
    name: '창업가·스타트업', icon: 'i-rocket', color: '#d32f2f',
    desc: 'BM·투자유치·OKR·위클리 CEO 리뷰', tools: ['dday', 'timetrack'],
    templates: [
      { name: '투자자 업데이트 (월간)', html: `
<h1>${ic('i-rocket',20)}투자자 업데이트 — <span contenteditable="true">[월]</span></h1>
${sh('i-trophy','Highlights (TL;DR 3줄)')}<ol><li></li><li></li><li></li></ol>
${sh('i-wordcloud','핵심 지표')}<table style="width:100%;"><tr><th>지표</th><th>이번달</th><th>지난달</th><th>MoM</th></tr><tr><td>MRR</td><td></td><td></td><td>%</td></tr><tr><td>신규 고객</td><td></td><td></td><td></td></tr><tr><td>Churn</td><td></td><td></td><td></td></tr><tr><td>Cash (런웨이)</td><td></td><td></td><td>__개월</td></tr></table>
${sh('i-thumbs-up','잘된 것')}<ul><li></li></ul>
${sh('i-thumbs-down','어려웠던 것 (투명하게)')}<ul><li></li></ul>
${sh('i-help','Ask (투자자에게 부탁할 것)')}<ul><li>채용 — 누구</li><li>소개 — 누구에게</li><li>자문 — 어떤 주제</li></ul>`.trim() },
      { name: '주간 CEO 리뷰', html: `
<h1>${ic('i-sparkles',20)}CEO 주간 리뷰 — ${TODAY()}</h1>
${sh('i-target','제품 (Product)')}<p></p>
${sh('i-wordcloud','성장 (Growth)')}<p></p>
${sh('i-users','팀·문화')}<p></p>
${sh('i-folder','운영·재무')}<p></p>
${sh('i-warning','이번 주 리스크·고민')}<p></p>
${sh('i-send','다음 주 Top 3')}${CB('')}${CB('')}${CB('')}`.trim() }
    ]
  };

  R['hr'] = {
    name: '인사·HR', icon: 'i-users', color: '#9c27b0',
    desc: '채용·온보딩·퍼포먼스 리뷰', tools: ['dday', 'timetrack'],
    templates: [
      { name: '채용 인터뷰 스코어카드', html: `
<h1>${ic('i-users',20)}인터뷰 — <span contenteditable="true">[후보자]</span> / <span contenteditable="true">[직무]</span></h1>
<table style="width:100%;"><tr><th>일시</th><td>${TODAY()}</td><th>라운드</th><td>1차/2차/최종</td></tr><tr><th>면접관</th><td></td><th>형식</th><td>코딩/시스템/행동/케이스</td></tr></table>
${sh('i-target','평가 항목 (5점 만점)')}
<table style="width:100%;"><tr><th>역량</th><th>점수</th><th>근거 (구체적 행동·답변)</th></tr><tr><td>직무 전문성</td><td></td><td></td></tr><tr><td>문제 해결력</td><td></td><td></td></tr><tr><td>커뮤니케이션</td><td></td><td></td></tr><tr><td>협업·리더십</td><td></td><td></td></tr><tr><td>성장성</td><td></td><td></td></tr><tr><td>문화 적합성</td><td></td><td></td></tr><tr><th>평균</th><th></th><th></th></tr></table>
${sh('i-help','추천')}<p>Strong Hire / Hire / No Hire / Strong No — <b>결정:</b> </p><p><b>이유 (한 문장):</b> </p>`.trim() },
      { name: '신입 온보딩 30-60-90', html: `
<h1>${ic('i-heart',20)}온보딩 — <span contenteditable="true">[신입 이름]</span></h1>
${sh('i-target','30일 — 적응 & 문화')}
${CB('팀원 1:1 모두 마침 (__명)')}
${CB('제품·서비스 사용 경험 완료')}
${CB('주요 프로세스 문서 읽음')}
${CB('도구 셋업 완료 (GitHub/Slack/Jira…)')}
${CB('첫 작은 기여 (문서 수정·버그 픽스)')}
${sh('i-sparkles','60일 — 기여 시작')}${CB('주도 프로젝트 1건 착수')}${CB('다른 팀과 협업 1건')}${CB('스탠드업·회고 적극 참여')}
${sh('i-trophy','90일 — 독립적 기여')}${CB('주 프로젝트 마일스톤 1건 달성')}${CB('OKR 에 자기 KR 포함')}${CB('팀 관례·개선 제안 1건')}
${sh('i-quote','매주 체크인 질문')}<ul><li>이번 주 가장 배운 것?</li><li>막혔던 것 / 헷갈리는 것?</li><li>도움이 필요한 것?</li></ul>`.trim() }
    ]
  };

  R['finance'] = {
    name: '재무·회계', icon: 'i-stats', color: '#388e3c',
    desc: '월마감·예산·현금흐름·감사', tools: ['ledger', 'dday'],
    templates: [
      { name: '월 마감 체크리스트', html: `
<h1>${ic('i-stats',20)}월 마감 — <span contenteditable="true">[YYYY.MM]</span></h1>
${sh('i-calendar','D-3')}${CB('청구서 발행 완료')}${CB('미수금 리마인드')}
${sh('i-calendar','D-1')}${CB('재고 실사')}${CB('카드·계좌 잔고 스크린샷')}
${sh('i-calendar','D0 (월말)')}${CB('수익 인식 리뷰')}${CB('비용 발생 기준 정리')}${CB('감가상각 계산')}${CB('외화 환산')}
${sh('i-calendar','D+3')}${CB('시산표 1차 출력')}${CB('예산 대비 실적 비교')}${CB('이상항목 소명 요청')}
${sh('i-calendar','D+7')}${CB('손익계산서 최종')}${CB('현금흐름표')}${CB('이사회·경영진 리포트')}${CB('감사 대비 문서 보관')}`.trim() },
      { name: '예산 vs 실적 분석', html: `
<h1>${ic('i-wordcloud',20)}예산 vs 실적 — <span contenteditable="true">[월/분기]</span></h1>
<table style="width:100%;"><tr><th>항목</th><th>예산</th><th>실적</th><th>차이</th><th>%</th><th>소명</th></tr><tr><td>매출</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>매출원가</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>매출총이익</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>인건비</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>마케팅</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>R&amp;D</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>일반관리비</td><td></td><td></td><td></td><td></td><td></td></tr><tr><th>영업이익</th><th></th><th></th><th></th><th></th><th></th></tr></table>`.trim() }
    ]
  };

  R['lawyer'] = {
    name: '법무·변호사', icon: 'i-folder', color: '#5d4037',
    desc: '판례·계약 리뷰·자문 기록·기일관리', tools: ['dday', 'timetrack'],
    templates: [
      { name: '계약 리뷰 체크리스트', html: `
<h1>${ic('i-folder',20)}계약 리뷰 — <span contenteditable="true">[계약명]</span></h1>
<table style="width:100%;"><tr><th>상대방</th><td></td><th>유형</th><td>용역/공급/NDA/M&amp;A</td></tr><tr><th>금액</th><td></td><th>기간</th><td></td></tr></table>
${sh('i-check','조항별 체크')}
${CB('당사자·대표자·주소 정확')}${CB('계약 목적 명확')}${CB('이행 범위 구체')}${CB('대금·지급 조건')}
${CB('보증·책임 제한 (캡)')}${CB('비밀유지 조항')}${CB('지식재산권 귀속')}${CB('위약금·해지 조건')}
${CB('준거법·관할')}${CB('불가항력')}${CB('양도 금지')}${CB('변경·갱신 절차')}
${sh('i-warning','주요 리스크')}<table style="width:100%;"><tr><th>조항</th><th>리스크</th><th>협상 제안</th></tr><tr><td></td><td></td><td></td></tr></table>
${sh('i-send','다음 액션')}${CB('수정 제안서 작성')}${CB('내부 승인 (법무/재무/리드)')}${CB('최종 서명')}`.trim() }
    ]
  };

  // ========== MEDICAL (의료) ==========
  R['doctor'] = {
    name: '의사', icon: 'i-heart', color: '#e53935',
    desc: '진료·수술·학회·환자기록', tools: ['dday', 'timetrack'],
    templates: [
      { name: 'SOAP 진료기록', html: `
<h1>${ic('i-heart',20)}진료 노트 — <span contenteditable="true">[환자 ID/이니셜]</span></h1>
<table style="width:100%;"><tr><th>일시</th><td>${TODAY()}</td><th>방문</th><td>초진/재진</td></tr></table>
${sh('i-quote','S — Subjective (환자 주관)')}<p><b>주호소(Chief Complaint):</b> </p><p><b>현병력(HPI):</b> 발현·경과·악화/완화 요인</p><p><b>과거력·가족력·약물력:</b> </p>
${sh('i-search','O — Objective (검진·검사)')}<p><b>바이탈:</b> BP __/__ · HR __ · T __</p><p><b>신체 검진:</b> </p><p><b>검사 결과:</b> </p>
${sh('i-sparkles','A — Assessment (평가·감별)')}<ol><li>주진단: </li><li>감별진단 1: </li><li>감별진단 2: </li></ol>
${sh('i-send','P — Plan (계획)')}<ul><li><b>추가 검사:</b> </li><li><b>처방:</b> </li><li><b>처치:</b> </li><li><b>환자 교육:</b> </li><li><b>추적:</b> </li></ul>`.trim() },
      { name: '학회·논문 요약', html: `
<h1>${ic('i-book',20)}문헌 리뷰 — <span contenteditable="true">[논문 제목]</span></h1>
<table style="width:100%;"><tr><th>저자</th><td></td><th>저널</th><td></td></tr><tr><th>연도</th><td></td><th>DOI</th><td></td></tr></table>
${sh('i-target','PICO')}<ul><li><b>Population:</b> </li><li><b>Intervention:</b> </li><li><b>Comparison:</b> </li><li><b>Outcome:</b> </li></ul>
${sh('i-help','핵심 결론')}<p></p>
${sh('i-wordcloud','주요 결과 (수치)')}<table style="width:100%;"><tr><th>지표</th><th>군</th><th>대조군</th><th>P/CI</th></tr><tr><td></td><td></td><td></td><td></td></tr></table>
${sh('i-warning','제한점 & 임상 적용')}<p></p>`.trim() }
    ]
  };

  R['nurse'] = {
    name: '간호사', icon: 'i-heart', color: '#f06292',
    desc: '환자 인계·처치 기록·근무표', tools: ['dday', 'timetrack'],
    templates: [{ name: 'SBAR 인계 노트', html: `
<h1>${ic('i-heart',20)}SBAR 인계 — ${TODAY()}</h1>
${sh('i-info','S — Situation')}<p><b>환자:</b> __ (__ 세/성별)</p><p><b>주호소:</b> </p><p><b>현재 상태 (AVPU):</b> </p>
${sh('i-folder','B — Background')}<p><b>진단:</b> </p><p><b>수술·처치 이력:</b> </p><p><b>주요 약물:</b> </p><p><b>알레르기:</b> </p>
${sh('i-search','A — Assessment')}<p><b>바이탈 (3회 이상):</b> </p><p><b>통증 (NRS):</b> </p><p><b>I/O:</b> </p><p><b>변화된 증상:</b> </p>
${sh('i-send','R — Recommendation')}<ul><li><b>즉시 관찰:</b> </li><li><b>의사 notify 기준:</b> </li><li><b>검사·처치 예정:</b> </li></ul>`.trim() }]
  };

  R['pharmacist'] = {
    name: '약사', icon: 'i-list', color: '#80cbc4',
    desc: '복약상담·처방 검토·재고', tools: ['dday'],
    templates: [{ name: '복약상담 기록', html: `
<h1>${ic('i-list',20)}복약상담 — ${TODAY()}</h1>
<table style="width:100%;"><tr><th>환자</th><td></td><th>나이·체중</th><td></td></tr></table>
${sh('i-folder','처방 약품')}<table style="width:100%;"><tr><th>약품</th><th>용량</th><th>용법</th><th>복용 기간</th></tr><tr><td></td><td></td><td></td><td></td></tr></table>
${sh('i-warning','상호작용·금기 체크')}${CB('약물-약물 상호작용 확인')}${CB('음식·알코올 주의')}${CB('임신·수유·소아 고려')}${CB('간·신기능 조정 필요성')}
${sh('i-quote','환자 안내 사항')}<ul><li><b>복용 시간·방법:</b> </li><li><b>부작용 주의:</b> </li><li><b>보관:</b> </li><li><b>잔여·재방문:</b> </li></ul>`.trim() }]
  };

  // ========== EDUCATION & RESEARCH ==========
  R['teacher'] = {
    name: '교사·강사', icon: 'i-book', color: '#43a047',
    desc: '수업계획·학생기록·평가', tools: ['timetable', 'dday'],
    templates: [
      { name: '수업 지도안 (45분)', html: `
<h1>${ic('i-book',20)}수업 지도안 — <span contenteditable="true">[과목/단원]</span></h1>
<table style="width:100%;"><tr><th>날짜</th><td>${TODAY()}</td><th>대상</th><td>__학년 __반</td></tr><tr><th>차시</th><td>__/__</td><th>교재</th><td></td></tr></table>
${sh('i-target','학습 목표')}<ol><li>지식: </li><li>기능: </li><li>태도: </li></ol>
${sh('i-calendar','활동 계획')}<table style="width:100%;"><tr><th>단계</th><th>시간</th><th>교사 활동</th><th>학생 활동</th><th>자료</th></tr><tr><td>도입</td><td>5분</td><td>동기유발·목표 제시</td><td></td><td></td></tr><tr><td>전개 1</td><td>15분</td><td></td><td></td><td></td></tr><tr><td>전개 2</td><td>15분</td><td></td><td></td><td></td></tr><tr><td>정리·평가</td><td>10분</td><td>핵심 요약·형성평가</td><td></td><td></td></tr></table>
${sh('i-check','평가')}<ul><li><b>형성평가:</b> </li><li><b>과제:</b> </li></ul>
${sh('i-warning','예상 어려움 & 대처')}<ul><li></li></ul>`.trim() },
      { name: '학생 상담 기록', html: `
<h1>${ic('i-smile',20)}학생 상담 — <span contenteditable="true">[학생명]</span></h1>
<table style="width:100%;"><tr><th>날짜</th><td>${TODAY()}</td><th>동석자</th><td>학부모 여부</td></tr></table>
${sh('i-quote','주요 논의')}<ul><li><b>주호소:</b> 학업/교우/가정/진로</li><li><b>학생 말 (녹취 요지):</b> </li></ul>
${sh('i-sparkles','강점 & 관심사')}<p></p>
${sh('i-warning','우려 사항')}<p></p>
${sh('i-send','합의된 계획')}<table style="width:100%;"><tr><th>할 일</th><th>누가</th><th>기한</th></tr><tr><td></td><td>학생</td><td></td></tr><tr><td></td><td>교사</td><td></td></tr><tr><td></td><td>학부모</td><td></td></tr></table>`.trim() }
    ]
  };

  R['researcher'] = {
    name: '연구원', icon: 'i-sparkles', color: '#673ab7',
    desc: '실험·논문·그랜트·학회', tools: ['dday', 'timetrack'],
    templates: [{ name: '그랜트 제안서 아웃라인', html: `
<h1>${ic('i-sparkles',20)}그랜트 제안 — <span contenteditable="true">[과제명]</span></h1>
<table style="width:100%;"><tr><th>기관</th><td></td><th>총 예산</th><td></td></tr><tr><th>기간</th><td></td><th>PI</th><td></td></tr></table>
${sh('i-target','Specific Aims (1페이지 요약)')}<ol><li><b>Aim 1:</b> </li><li><b>Aim 2:</b> </li><li><b>Aim 3:</b> </li></ol>
${sh('i-info','Significance (왜 중요한가)')}<p></p>
${sh('i-sparkles','Innovation (기존과 뭐가 다른가)')}<p></p>
${sh('i-list-ol','Approach (방법론)')}<p>예비 데이터·실험 설계·통계·위험 및 대안</p>
${sh('i-wordcloud','예산')}<table style="width:100%;"><tr><th>항목</th><th>Y1</th><th>Y2</th><th>Y3</th></tr><tr><td>인건비</td><td></td><td></td><td></td></tr><tr><td>장비·소모품</td><td></td><td></td><td></td></tr><tr><td>기타</td><td></td><td></td><td></td></tr><tr><th>합계</th><th></th><th></th><th></th></tr></table>`.trim() }]
  };

  // ========== CREATIVE ==========
  R['writer'] = {
    name: '작가·저자', icon: 'i-note', color: '#5c6bc0',
    desc: '글쓰기·원고·퇴고·출판', tools: ['dday', 'timetrack'],
    templates: [
      { name: '소설·장편 아웃라인 (3막)', html: `
<h1>${ic('i-note',20)}작품 — <span contenteditable="true">[제목]</span></h1>
<table style="width:100%;"><tr><th>장르</th><td></td><th>목표 분량</th><td>__자</td></tr><tr><th>타깃 독자</th><td></td><th>Elevator pitch</th><td>한 문장</td></tr></table>
${sh('i-users','등장인물')}<table style="width:100%;"><tr><th>이름</th><th>역할</th><th>욕망</th><th>장애물</th><th>변화</th></tr><tr><td></td><td>주인공</td><td></td><td></td><td></td></tr><tr><td></td><td>적대자</td><td></td><td></td><td></td></tr></table>
${sh('i-target','1막 — Setup (25%)')}<ul><li><b>일상 세계:</b> </li><li><b>촉발 사건 (Inciting Incident):</b> </li><li><b>플롯 포인트 1 (주인공 결단):</b> </li></ul>
${sh('i-redo','2막 — Confrontation (50%)')}<ul><li><b>상승 시련:</b> </li><li><b>중간점 (Midpoint 전환):</b> </li><li><b>모든 것을 잃음 (All is Lost):</b> </li><li><b>플롯 포인트 2:</b> </li></ul>
${sh('i-trophy','3막 — Resolution (25%)')}<ul><li><b>클라이맥스:</b> </li><li><b>결말·여운:</b> </li></ul>`.trim() },
      { name: '집필 일일 기록', html: `
<h1>${ic('i-note',20)}집필 일지 — ${TODAY()}</h1>
<table style="width:100%;"><tr><th>목표 자수</th><td></td><th>실제 자수</th><td></td></tr><tr><th>집필 시간</th><td></td><th>누적 (프로젝트)</th><td></td></tr></table>
${sh('i-sparkles','오늘 진행된 장면')}<p></p>
${sh('i-help','고민·막힌 지점')}<p></p>
${sh('i-send','내일 이어갈 것 (다음 문단 3줄 메모)')}<p></p>`.trim() }
    ]
  };

  R['journalist'] = {
    name: '기자·언론인', icon: 'i-search', color: '#1976d2',
    desc: '취재·팩트체크·기사', tools: ['dday', 'timetrack'],
    templates: [{ name: '기사 취재 노트', html: `
<h1>${ic('i-search',20)}취재 — <span contenteditable="true">[기사 주제]</span></h1>
${sh('i-help','5W1H 체크')}<table style="width:100%;"><tr><th>누가 (Who)</th><td></td></tr><tr><th>언제 (When)</th><td></td></tr><tr><th>어디서 (Where)</th><td></td></tr><tr><th>무엇을 (What)</th><td></td></tr><tr><th>왜 (Why)</th><td></td></tr><tr><th>어떻게 (How)</th><td></td></tr></table>
${sh('i-users','취재원')}<table style="width:100%;"><tr><th>이름·소속</th><th>입장</th><th>인용 허용 여부</th><th>확보 시점</th></tr><tr><td></td><td></td><td>실명/익명</td><td></td></tr></table>
${sh('i-check','팩트 체크')}${CB('핵심 사실 2개 이상 교차확인')}${CB('공식 문서·기록으로 확인')}${CB('반대 입장 청취')}${CB('법적 리스크 검토')}
${sh('i-quote','핵심 인용문')}<blockquote></blockquote>`.trim() }]
  };

  R['creator'] = {
    name: '크리에이터·유튜버', icon: 'i-speaker', color: '#f44336',
    desc: '기획·대본·썸네일·분석', tools: ['dday', 'timetrack'],
    templates: [
      { name: '콘텐츠 기획서 (영상 1편)', html: `
<h1>${ic('i-speaker',20)}콘텐츠 — <span contenteditable="true">[제목]</span></h1>
<table style="width:100%;"><tr><th>플랫폼</th><td>YT/IG/TikTok</td><th>길이</th><td></td></tr><tr><th>목표</th><td>조회/구독/수익</td><th>업로드</th><td></td></tr></table>
${sh('i-target','한 줄 훅 (첫 3초)')}<p></p>
${sh('i-help','시청자가 얻을 가치')}<p></p>
${sh('i-list-ol','대본 구조')}<ol><li><b>Hook (0-3초):</b> </li><li><b>약속 (3-10초):</b> 보면 이걸 얻어요</li><li><b>본문 1:</b> </li><li><b>본문 2:</b> </li><li><b>본문 3:</b> </li><li><b>CTA (구독/다음 영상):</b> </li></ol>
${sh('i-palette','썸네일·제목')}<ul><li><b>썸네일 텍스트 3단어:</b> </li><li><b>제목 3안:</b> </li></ul>
${sh('i-check','촬영 체크')}${CB('조명·오디오·배경 세팅')}${CB('저작권 자료 확인')}${CB('B-roll·자료화면 확보')}`.trim() },
      { name: '조회수·분석 (주간)', html: `
<h1>${ic('i-wordcloud',20)}주간 채널 분석 — ${TODAY()}</h1>
<table style="width:100%;"><tr><th>채널</th><th>조회</th><th>시청시간</th><th>구독 변화</th><th>수익</th></tr><tr><td>이번주</td><td></td><td></td><td></td><td></td></tr><tr><td>지난주</td><td></td><td></td><td></td><td></td></tr><tr><td>Δ</td><td></td><td></td><td></td><td></td></tr></table>
${sh('i-trophy','최고 성과 영상')}<ul><li></li></ul>
${sh('i-thumbs-down','부진한 영상 → 왜')}<ul><li></li></ul>
${sh('i-send','다음 주 실험')}${CB('')}`.trim() }
    ]
  };

  R['chef'] = {
    name: '요리사·셰프', icon: 'i-bucket', color: '#ff7043',
    desc: '레시피·재고·메뉴 기획', tools: ['shop', 'meal'],
    templates: [{ name: '레시피 개발 카드', html: `
<h1>${ic('i-bucket',20)}레시피 — <span contenteditable="true">[메뉴명]</span></h1>
<table style="width:100%;"><tr><th>카테고리</th><td></td><th>1인분 원가</th><td>₩</td></tr><tr><th>조리시간</th><td></td><th>난이도</th><td>★☆☆</td></tr></table>
${sh('i-list','재료 (1인 기준)')}<table style="width:100%;"><tr><th>재료</th><th>용량</th><th>단가</th><th>원가</th></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><th>합계</th><th></th><th></th><th></th></tr></table>
${sh('i-list-ol','조리법')}<ol><li><b>(10분) 준비:</b> </li><li><b>(5분) 1단계:</b> </li><li><b>(15분) 2단계:</b> </li><li><b>(5분) 플레이팅:</b> </li></ol>
${sh('i-sparkles','플레이팅·서빙')}<p></p>
${sh('i-quote','시식 피드백')}<ul><li></li></ul>`.trim() }]
  };

  // ========== LIFESTYLE ==========
  R['athlete'] = {
    name: '운동선수·트레이너', icon: 'i-flame', color: '#f4511e',
    desc: '훈련일지·시합준비·회복', tools: ['timetrack', 'dday'],
    templates: [{ name: '훈련 일지 (일일)', html: `
<h1>${ic('i-flame',20)}훈련 — ${TODAY()}</h1>
<table style="width:100%;"><tr><th>종목</th><td></td><th>컨디션 (1-10)</th><td></td></tr><tr><th>수면</th><td>__h</td><th>RHR</th><td>__ bpm</td></tr></table>
${sh('i-target','오늘 목표 (운동·기술·회복)')}<p></p>
${sh('i-list','워크아웃')}<table style="width:100%;"><tr><th>종목</th><th>세트</th><th>반복</th><th>중량/강도</th><th>RPE</th></tr><tr><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></table>
${sh('i-heart','회복·영양')}<ul><li><b>단백질:</b> __g</li><li><b>수분:</b> __L</li><li><b>스트레칭·마사지:</b> </li></ul>
${sh('i-thumbs-up','잘된 것 / 내일 개선')}<ul><li></li></ul>`.trim() }]
  };

  R['yoga'] = {
    name: '요가·명상', icon: 'i-heart', color: '#66bb6a',
    desc: '수련일지·호흡·마음챙김', tools: ['timetrack', 'dday'],
    templates: [{ name: '명상 일지', html: `
<h1>${ic('i-heart',20)}명상 — ${TODAY()}</h1>
<table style="width:100%;"><tr><th>수련</th><td>아사나/프라나야마/명상</td><th>시간</th><td>__분</td></tr></table>
${sh('i-target','의도 (Sankalpa)')}<p></p>
${sh('i-quote','수련 중 관찰')}<ul><li><b>몸 (감각·긴장):</b> </li><li><b>호흡 (깊이·리듬):</b> </li><li><b>마음 (생각 패턴):</b> </li></ul>
${sh('i-sparkles','통찰·감사')}<p></p>`.trim() }]
  };

  R['traveler'] = {
    name: '여행가·탐험가', icon: 'i-globe', color: '#26c6da',
    desc: '여행기·루트플래닝·지출', tools: ['dday', 'ledger'],
    templates: [{ name: '여행기 (하루)', html: `
<h1>${ic('i-globe',20)}여행기 — ${TODAY()} · <span contenteditable="true">[장소]</span></h1>
<table style="width:100%;"><tr><th>이동</th><td></td><th>지출</th><td>₩</td></tr><tr><th>날씨</th><td></td><th>만난 사람</th><td></td></tr></table>
${sh('i-sparkles','하이라이트 (사진 넣기 좋은 장면 3)')}<ol><li></li><li></li><li></li></ol>
${sh('i-quote','오늘의 발견·배움')}<p></p>
${sh('i-warning','아쉬웠던 것·다음엔 이렇게')}<p></p>
${sh('i-send','추천할 것 (지인에게)')}<ul><li></li></ul>`.trim() }]
  };

  R['parent'] = {
    name: '학부모', icon: 'i-heart', color: '#ffb300',
    desc: '자녀 학업·상담·활동 관리', tools: ['dday', 'ledger'],
    templates: [{ name: '자녀 성장 기록 (주간)', html: `
<h1>${ic('i-heart',20)}자녀 기록 — ${TODAY()}</h1>
<table style="width:100%;"><tr><th>자녀</th><td></td><th>학년·나이</th><td></td></tr></table>
${sh('i-sparkles','이번 주 성장·긍정 순간')}<ul><li></li></ul>
${sh('i-warning','걱정·상담 필요')}<ul><li></li></ul>
${sh('i-target','학업·활동')}<table style="width:100%;"><tr><th>영역</th><th>이번 주</th><th>다음 주 계획</th></tr><tr><td>학업</td><td></td><td></td></tr><tr><td>운동·예체능</td><td></td><td></td></tr><tr><td>친구·사회성</td><td></td><td></td></tr><tr><td>건강</td><td></td><td></td></tr></table>
${sh('i-check','학교·학원 일정')}${CB('')}${CB('')}`.trim() }]
  };

  R['pet'] = {
    name: '반려동물 양육', icon: 'i-heart', color: '#ab47bc',
    desc: '건강·예방접종·행동 관찰', tools: ['dday', 'vital'],
    templates: [{ name: '반려동물 건강일지', html: `
<h1>${ic('i-heart',20)}반려동물 — <span contenteditable="true">[이름]</span></h1>
<table style="width:100%;"><tr><th>종·품종</th><td></td><th>나이</th><td></td></tr><tr><th>체중</th><td>__ kg</td><th>마지막 검진</th><td></td></tr></table>
${sh('i-wordcloud','오늘 상태')}<table style="width:100%;"><tr><th>식욕</th><td></td><th>배변</th><td>횟수·상태</td></tr><tr><th>활동량</th><td></td><th>수면</th><td></td></tr><tr><th>특이사항</th><td colspan="3">긁음·구토·설사·울음</td></tr></table>
${sh('i-calendar','예방접종·약')}<table style="width:100%;"><tr><th>종류</th><th>최근 날짜</th><th>다음 날짜</th></tr><tr><td>광견병</td><td></td><td></td></tr><tr><td>종합 백신</td><td></td><td></td></tr><tr><td>심장사상충</td><td></td><td></td></tr></table>`.trim() }]
  };

  // ========== SPECIALIZED ==========
  R['investor'] = {
    name: '투자자·재테크', icon: 'i-trophy', color: '#00897b',
    desc: '포트폴리오·종목 분석·시장 일지', tools: ['ledger', 'dday'],
    templates: [
      { name: '종목 분석 (한 장)', html: `
<h1>${ic('i-wordcloud',20)}종목 분석 — <span contenteditable="true">[티커/이름]</span></h1>
<table style="width:100%;"><tr><th>현재가</th><td></td><th>시가총액</th><td></td></tr><tr><th>P/E</th><td></td><th>P/B</th><td></td></tr><tr><th>배당수익률</th><td></td><th>섹터</th><td></td></tr></table>
${sh('i-target','투자 가설 (한 문장)')}<p></p>
${sh('i-thumbs-up','Bull Case (강세 시나리오)')}<ul><li></li></ul>
${sh('i-thumbs-down','Bear Case (약세 시나리오)')}<ul><li></li></ul>
${sh('i-warning','리스크')}<ul><li></li></ul>
${sh('i-check','Buy/Sell 기준')}<table style="width:100%;"><tr><th>매수 트리거</th><td></td></tr><tr><th>목표 주가</th><td></td></tr><tr><th>손절가</th><td></td></tr><tr><th>보유 기간</th><td></td></tr></table>`.trim() },
      { name: '월간 포트폴리오 리뷰', html: `
<h1>${ic('i-trophy',20)}포트폴리오 — <span contenteditable="true">[월]</span></h1>
<table style="width:100%;"><tr><th>자산</th><th>평가액</th><th>비중</th><th>MoM</th><th>YTD</th></tr><tr><td>현금</td><td></td><td>%</td><td></td><td></td></tr><tr><td>주식</td><td></td><td>%</td><td></td><td></td></tr><tr><td>채권</td><td></td><td>%</td><td></td><td></td></tr><tr><td>부동산</td><td></td><td>%</td><td></td><td></td></tr><tr><td>대체</td><td></td><td>%</td><td></td><td></td></tr><tr><th>합계</th><th></th><th>100%</th><th></th><th></th></tr></table>
${sh('i-send','리밸런싱')}${CB('목표 비중에서 5%p 이상 이탈 종목 조정')}`.trim() }
    ]
  };

  R['realtor'] = {
    name: '부동산 중개', icon: 'i-folder', color: '#6d4c41',
    desc: '매물·계약·고객 관리', tools: ['dday', 'timetrack'],
    templates: [{ name: '매물 브리핑', html: `
<h1>${ic('i-folder',20)}매물 — <span contenteditable="true">[주소]</span></h1>
<table style="width:100%;"><tr><th>유형</th><td>아파트/오피스텔/단독</td><th>면적</th><td>전용 __㎡</td></tr><tr><th>층/방/욕실</th><td></td><th>준공</th><td></td></tr><tr><th>매매·전세·월세</th><td></td><th>가격</th><td></td></tr></table>
${sh('i-sparkles','장점 Top 3')}<ol><li></li><li></li><li></li></ol>
${sh('i-warning','단점·주의')}<ul><li></li></ul>
${sh('i-check','현장 체크리스트')}${CB('채광·통풍')}${CB('소음·이웃')}${CB('누수·곰팡이')}${CB('수압·배수')}${CB('단열·결로')}${CB('주차·엘리베이터')}
${sh('i-info','주변 인프라')}<p>학군·교통·상권·병원·공원…</p>`.trim() }]
  };

  R['publicServant'] = {
    name: '공무원·공공기관', icon: 'i-clipboard', color: '#546e7a',
    desc: '민원·정책·회계·공문', tools: ['dday', 'ledger'],
    templates: [{ name: '민원 처리 기록', html: `
<h1>${ic('i-clipboard',20)}민원 — ${TODAY()}</h1>
<table style="width:100%;"><tr><th>접수번호</th><td></td><th>접수일</th><td>${TODAY()}</td></tr><tr><th>민원인</th><td></td><th>채널</th><td>방문/전화/온라인</td></tr></table>
${sh('i-quote','민원 내용 (원문)')}<blockquote></blockquote>
${sh('i-folder','관련 법령·규정')}<ul><li></li></ul>
${sh('i-search','검토 사항')}<p></p>
${sh('i-send','처리 결과')}<table style="width:100%;"><tr><th>구분</th><th>내용</th></tr><tr><td>처리 방침</td><td>수용/부분수용/불수용</td></tr><tr><td>근거</td><td></td></tr><tr><td>회신 방법·일자</td><td></td></tr></table>`.trim() }]
  };

  R['nonprofit'] = {
    name: '비영리·자선활동', icon: 'i-heart', color: '#7cb342',
    desc: '프로그램·펀드레이징·자원봉사', tools: ['dday', 'timetrack'],
    templates: [{ name: '프로그램 임팩트 리포트', html: `
<h1>${ic('i-heart',20)}임팩트 리포트 — <span contenteditable="true">[프로그램]</span></h1>
<table style="width:100%;"><tr><th>기간</th><td></td><th>예산</th><td></td></tr><tr><th>수혜자 수</th><td></td><th>자원봉사자</td><td></td></tr></table>
${sh('i-target','목표 vs 실적')}<table style="width:100%;"><tr><th>지표</th><th>목표</th><th>실적</th></tr><tr><td>수혜자</td><td></td><td></td></tr><tr><td>프로그램 횟수</td><td></td><td></td></tr><tr><td>만족도 (NPS)</td><td></td><td></td></tr></table>
${sh('i-quote','수혜자 스토리 (1-2명)')}<blockquote></blockquote>
${sh('i-warning','도전·배움')}<p></p>
${sh('i-send','다음 분기 계획')}${CB('')}`.trim() }]
  };

  R['therapist'] = {
    name: '상담사·심리치료', icon: 'i-smile', color: '#9575cd',
    desc: '상담 세션·사례·수퍼비전', tools: ['dday', 'timetrack'],
    templates: [{ name: '상담 세션 기록 (SOAP)', html: `
<h1>${ic('i-smile',20)}상담 세션 — <span contenteditable="true">[내담자 ID]</span></h1>
<table style="width:100%;"><tr><th>회차</th><td></td><th>날짜</th><td>${TODAY()}</td></tr><tr><th>시간</th><td>__분</td><th>형식</th><td>대면/화상</td></tr></table>
${sh('i-quote','S — 내담자 주관')}<p><b>주호소:</b> </p><p><b>이번 주 경험:</b> </p>
${sh('i-search','O — 관찰')}<p><b>외모·태도:</b> </p><p><b>정서 상태:</b> </p><p><b>비언어:</b> </p>
${sh('i-sparkles','A — 평가')}<p><b>치료 목표 진척:</b> </p><p><b>진단·개념화 업데이트:</b> </p>
${sh('i-send','P — 계획')}<ul><li><b>다음 세션 초점:</b> </li><li><b>숙제:</b> </li><li><b>위험 평가 (자해·타해):</b> </li></ul>`.trim() }]
  };

  R['architect'] = {
    name: '건축·설계', icon: 'i-columns', color: '#8d6e63',
    desc: '프로젝트·디자인 리뷰·BIM', tools: ['dday', 'timetrack'],
    templates: [{ name: '건축 프로젝트 브리프', html: `
<h1>${ic('i-columns',20)}프로젝트 — <span contenteditable="true">[이름]</span></h1>
<table style="width:100%;"><tr><th>건축주</th><td></td><th>대지 주소</th><td></td></tr><tr><th>대지 면적</th><td>__㎡</td><th>연면적 목표</th><td>__㎡</td></tr><tr><th>용도</th><td></td><th>예산</th><td></td></tr></table>
${sh('i-target','디자인 컨셉 (한 문장)')}<p></p>
${sh('i-list','법규·조례')}<ul><li><b>용적률·건폐율:</b> </li><li><b>높이 제한:</b> </li><li><b>주차 대수:</b> </li><li><b>피난·소방:</b> </li></ul>
${sh('i-calendar','일정')}<table style="width:100%;"><tr><th>단계</th><th>기간</th><th>산출물</th></tr><tr><td>기획·계획</td><td></td><td></td></tr><tr><td>기본·실시설계</td><td></td><td></td></tr><tr><td>허가</td><td></td><td></td></tr><tr><td>시공 감리</td><td></td><td></td></tr><tr><td>준공</td><td></td><td></td></tr></table>`.trim() }]
  };

  R['musician'] = {
    name: '음악가·작곡가', icon: 'i-speaker', color: '#ec407a',
    desc: '작곡·연습·공연·세션', tools: ['timetrack', 'dday'],
    templates: [{ name: '연습 일지', html: `
<h1>${ic('i-speaker',20)}연습 — ${TODAY()}</h1>
<table style="width:100%;"><tr><th>악기</th><td></td><th>총 시간</th><td>__분</td></tr></table>
${sh('i-target','오늘 초점')}<p>테크닉 1개 + 레퍼토리 1곡</p>
${sh('i-list','연습 구성')}<table style="width:100%;"><tr><th>항목</th><th>시간</th><th>BPM</th><th>메모</th></tr><tr><td>워밍업 / 스케일</td><td>15분</td><td></td><td></td></tr><tr><td>테크닉</td><td>20분</td><td></td><td></td></tr><tr><td>레퍼토리</td><td>30분</td><td></td><td></td></tr><tr><td>초견·편곡·작곡</td><td>15분</td><td></td><td></td></tr></table>
${sh('i-sparkles','오늘 돌파·깨달음')}<p></p>
${sh('i-warning','내일 이어갈 과제')}<p></p>`.trim() }]
  };

  // ========== FINAL 5 ==========
  R['farmer'] = {
    name: '농부·원예', icon: 'i-heart', color: '#689f38',
    desc: '작물·수확·병해충·판매', tools: ['dday', 'ledger'],
    templates: [{ name: '작물 관리 일지', html: `
<h1>${ic('i-heart',20)}작물 — <span contenteditable="true">[작물명/품종]</span></h1>
<table style="width:100%;"><tr><th>파종일</th><td></td><th>예상 수확</th><td></td></tr><tr><th>면적</th><td></td><th>위치</th><td></td></tr></table>
${sh('i-calendar','주요 시기')}${CB('파종')}${CB('이식·가식')}${CB('솎아내기')}${CB('추비 1차')}${CB('추비 2차')}${CB('수확')}
${sh('i-warning','병해충 기록')}<table style="width:100%;"><tr><th>날짜</th><th>증상</th><th>방제</th></tr><tr><td></td><td></td><td></td></tr></table>
${sh('i-wordcloud','수확·판매')}<table style="width:100%;"><tr><th>수확량</th><th>단가</th><th>매출</th></tr><tr><td></td><td></td><td></td></tr><tr><th>합계</th><th></th><th></th></tr></table>`.trim() }]
  };

  R['coach'] = {
    name: '코치·멘토', icon: 'i-users', color: '#00acc1',
    desc: '세션·목표 추적·회고', tools: ['timetrack', 'dday'],
    templates: [{ name: '코칭 세션 (GROW)', html: `
<h1>${ic('i-users',20)}코칭 — <span contenteditable="true">[고객]</span></h1>
<table style="width:100%;"><tr><th>회차</th><td></td><th>날짜</th><td>${TODAY()}</td></tr></table>
${sh('i-target','G — Goal (목표)')}<p><b>오늘 세션 목표:</b> </p><p><b>장기 목표:</b> </p>
${sh('i-search','R — Reality (현실)')}<p><b>현재 상태:</b> </p><p><b>방해 요인:</b> </p>
${sh('i-list','O — Options (선택지)')}<ol><li></li><li></li><li></li></ol>
${sh('i-send','W — Will / Way Forward')}${CB('')}${CB('')}${CB('')}
${sh('i-quote','고객 말 그대로')}<blockquote></blockquote>`.trim() }]
  };

  R['eventPlanner'] = {
    name: '이벤트·웨딩 플래너', icon: 'i-calendar', color: '#ec407a',
    desc: '행사 기획·계약·체크리스트', tools: ['dday', 'ledger'],
    templates: [{ name: '이벤트 기획 마스터 체크리스트', html: `
<h1>${ic('i-calendar',20)}이벤트 — <span contenteditable="true">[행사명]</span></h1>
<table style="width:100%;"><tr><th>일시·장소</th><td></td><th>인원</th><td>__명</td></tr><tr><th>예산</th><td></td><th>담당</th><td></td></tr></table>
${sh('i-calendar','D-90')}${CB('컨셉·예산 확정')}${CB('장소 답사·계약')}${CB('초대장 디자인')}
${sh('i-calendar','D-60')}${CB('베뉴 계약')}${CB('케이터링 견적')}${CB('사진·영상 계약')}
${sh('i-calendar','D-30')}${CB('RSVP 취합')}${CB('좌석 배치')}${CB('프로그램 큐시트')}${CB('대관·장비 최종 확인')}
${sh('i-calendar','D-1')}${CB('리허설')}${CB('당일 타임라인 공유')}${CB('응급 연락처 리스트')}
${sh('i-calendar','D+1')}${CB('업체·베뉴 감사 인사')}${CB('사진 전달')}${CB('정산')}
${sh('i-wordcloud','예산 상세')}<table style="width:100%;"><tr><th>항목</th><th>예산</th><th>실제</th></tr><tr><td>장소</td><td></td><td></td></tr><tr><td>케이터링</td><td></td><td></td></tr><tr><td>촬영</td><td></td><td></td></tr><tr><td>꽃·장식</td><td></td><td></td></tr><tr><td>음향·조명</td><td></td><td></td></tr><tr><td>기타</td><td></td><td></td></tr><tr><th>합계</th><th></th><th></th></tr></table>`.trim() }]
  };

  R['podcaster'] = {
    name: '팟캐스터·라디오', icon: 'i-mic', color: '#7e57c2',
    desc: '에피소드·게스트·편집', tools: ['dday', 'timetrack'],
    templates: [{ name: '에피소드 기획서', html: `
<h1>${ic('i-mic',20)}에피소드 — <span contenteditable="true">[제목]</span></h1>
<table style="width:100%;"><tr><th>에피소드 번호</th><td></td><th>예상 길이</th><td>__분</td></tr><tr><th>게스트</th><td></td><th>포맷</th><td>인터뷰/솔로/패널</td></tr></table>
${sh('i-target','리스너가 얻을 것 (약속)')}<p></p>
${sh('i-list-ol','흐름 (5막)')}<ol><li><b>오프닝 훅 (0-60초):</b> </li><li><b>게스트 소개·맥락 (3분):</b> </li><li><b>본문 — 핵심 주제 3개 (25분):</b> </li><li><b>개인적 스토리·교훈 (8분):</b> </li><li><b>CTA·클로징 (3분):</b> </li></ol>
${sh('i-help','질문 리스트 (우선순위)')}<ol><li></li><li></li><li></li></ol>
${sh('i-check','프로덕션 체크')}${CB('장비·마이크 테스트')}${CB('녹음 시작 시 "Hi this is…"')}${CB('노이즈 체크')}${CB('게스트 동의서')}`.trim() }]
  };

  R['gamer'] = {
    name: '게이머·e스포츠', icon: 'i-target', color: '#c2185b',
    desc: '게임 로그·전략·연습', tools: ['timetrack', 'dday'],
    templates: [{ name: '게임 세션 분석', html: `
<h1>${ic('i-target',20)}게임 세션 — ${TODAY()}</h1>
<table style="width:100%;"><tr><th>게임</th><td></td><th>플레이 시간</th><td>__h</td></tr><tr><th>랭크</th><td></td><th>승률</th><td>__%</td></tr></table>
${sh('i-trophy','하이라이트·잘한 플레이')}<ul><li></li></ul>
${sh('i-thumbs-down','실수·나빴던 결정')}<ul><li></li></ul>
${sh('i-search','적팀·맵·메타 분석')}<p></p>
${sh('i-send','다음 세션 목표')}${CB('피지컬·에임')}${CB('특정 챔프·무기 숙련')}${CB('팀 커뮤니케이션 패턴')}`.trim() }]
  };

  // ────────────────────────────────────────────────────────────────
  // Tool definitions needed by some roles (opener placeholders)
  // ────────────────────────────────────────────────────────────────
  const EXTRA_TOOLS = {
    // 기존 ROLE_TOOLS 에 없는 새 도구가 있으면 여기에 추가.
    // 현재는 기존 도구(dday, timetrack, ledger, vital, shop, meal, timetable, gpa)만 사용.
  };

  // ---- 외부 노출 ----
  window.JAN_ROLES_EXTRA = R;
  window.JAN_ROLES_EXTRA_TOOLS = EXTRA_TOOLS;
  console.info('[JAN Roles Pack] ' + Object.keys(R).length + '개 추가 역할 로드됨');
})();
