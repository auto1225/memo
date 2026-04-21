/**
 * JustANotepad — Professional Templates (Pro Pack v2)
 * --------------------------------------------------------------------------
 * 상업용 최고 수준 템플릿 15종 — 전수 개편 버전.
 *
 * 설계 원칙:
 *   - 각 템플릿은 10-15개 섹션, 실무진이 실제 사용하는 깊이.
 *   - 표는 자동 계산 엔진(table-calc.js) 친화적 — <th>합계</th> 포함.
 *   - 프로페셔널 내용: 프레임워크(RACI, OKR, CBI, Mom Test, 5-Whys, JTBD 등).
 *   - contenteditable placeholder 로 즉시 입력 가능.
 *   - 베스트 프랙티스 blockquote 로 방법론 가이드 포함.
 *   - 예시 행 일부 prefill 로 작성법 시연.
 *   - 이모지 0 (SVG 스프라이트 참조만 사용).
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.JAN_BUILTIN_TEMPLATES) return;

  // ---- SVG helpers ----
  const icon = (id, size = 16) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px;opacity:0.85;"><use href="#${id}"/></svg>`;
  const tileIcon = (id) =>
    `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#${id}"/></svg>`;

  const TODAY = () => {
    const d = new Date();
    return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.`;
  };

  const HR = `<hr>`;
  const HRDOT = `<hr style="border-top:1px dashed var(--paper-edge);">`;

  const CB = (txt = '') =>
    `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;"><input type="checkbox" style="margin:0;"/><span>&nbsp;${txt}</span></div>`;

  const starRow = `${icon('i-star',14)}${icon('i-star',14)}${icon('i-star',14)}${icon('i-star',14)}${icon('i-star',14)}`;

  // Callout box — 베스트 프랙티스, 팁, 경고
  const callout = (kind, title, body) => {
    const colors = {
      tip:  { bg: 'color-mix(in srgb, var(--accent) 12%, var(--paper))', stripe: 'var(--accent)' },
      warn: { bg: 'color-mix(in srgb, #ff9800 12%, var(--paper))',        stripe: '#ff9800' },
      info: { bg: 'color-mix(in srgb, #2196f3 10%, var(--paper))',        stripe: '#2196f3' },
    };
    const c = colors[kind] || colors.tip;
    return `<div style="border-left:4px solid ${c.stripe};background:${c.bg};padding:8px 12px;margin:8px 0;border-radius:4px;">
  <strong style="font-size:12px;opacity:0.75;letter-spacing:0.04em;">${title}</strong>
  <div style="margin-top:4px;font-size:13px;">${body}</div>
</div>`;
  };

  // 섹션 헤더 — h2 + 보조 설명
  const sh = (iconId, title, sub = '') =>
    `<h2>${icon(iconId,20)}${title}${sub ? `<span style="font-weight:normal;font-size:13px;color:color-mix(in srgb, var(--ink) 55%, var(--paper));margin-left:8px;">${sub}</span>` : ''}</h2>`;

  // 프로그레스 바 (진행률 시각화)
  const progress = (label, pct = 0) =>
    `<div style="margin:4px 0;"><div style="font-size:12px;display:flex;justify-content:space-between;"><span>${label}</span><span>${pct}%</span></div>
      <div style="background:color-mix(in srgb, var(--paper-edge) 50%, var(--paper));height:6px;border-radius:3px;overflow:hidden;">
        <div style="background:var(--accent);width:${pct}%;height:100%;"></div>
      </div></div>`;

  const T = [];

  // ──────────────────────────────────────────────────────────────────
  // 1. 일기 — Deep daily journal (morning + evening + trends)
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-daily-journal', name: '일기 (프로)', category: '일상',
    description: '아침 계획 + 저녁 성찰 + 감정·에너지 추적. 일주일 누적으로 패턴 발견.',
    icon: 'i-note', is_official: true,
    body: `
<h1>${icon('i-note',20)}${TODAY()} 일기</h1>
<p style="color:color-mix(in srgb, var(--ink) 55%, var(--paper));font-size:12px;">
  작성 시간 5-10분 · 아침 3분 계획 + 저녁 5분 성찰
</p>

<table style="width:100%;">
  <tr>
    <th style="width:14%;">기분</th>
    <td>1 (나쁨) · <b>2</b> · 3 · 4 · 5 (최고)</td>
    <th style="width:14%;">에너지</th>
    <td>1 · 2 · 3 · <b>4</b> · 5</td>
  </tr>
  <tr>
    <th>수면</th><td>__시간 (품질: 나쁨/보통/좋음)</td>
    <th>집중도</th><td>1-10</td>
  </tr>
  <tr>
    <th>날씨</th><td>맑음/흐림/비 · __°C</td>
    <th>특이사항</th><td></td>
  </tr>
</table>

${HRDOT}
${sh('i-sparkles','아침 의도 설정','오늘 하루를 시작하기 전 3분')}

<blockquote>
  오늘을 <strong>최고의 하루</strong>로 만들려면 단 한 가지 무엇을 해야 하는가?
</blockquote>
<p style="font-size:15px;"><b>오늘의 한 가지 승리:</b> </p>

${sh('i-target','오늘 반드시 할 일 (MIT — Most Important Tasks)','3개를 넘지 말 것')}
${CB('')}
${CB('')}
${CB('')}

<h3>기대와 걱정</h3>
<table style="width:100%;">
  <tr><th style="width:50%;">기대되는 것</th><th>걱정되는 것</th></tr>
  <tr><td></td><td></td></tr>
</table>

${HR}
${sh('i-heart','저녁 성찰','잠들기 전 5분')}

${sh('i-sparkles','오늘의 하이라이트')}
<blockquote>오늘 가장 의미 있었던 한 장면 — 사진처럼 기억에 남을 순간.</blockquote>
<ul><li></li></ul>

${sh('i-heart','감사한 일 3가지','구체적으로, 처음 감사한 것일수록 좋음')}
<ol>
  <li><b></b> — 왜 감사한가: </li>
  <li><b></b> — 왜 감사한가: </li>
  <li><b></b> — 왜 감사한가: </li>
</ol>

${sh('i-book','오늘 배운 것')}
<table style="width:100%;">
  <tr><th style="width:25%;">카테고리</th><th>배움·깨달음</th></tr>
  <tr><td>지식/스킬</td><td></td></tr>
  <tr><td>자신에 대해</td><td></td></tr>
  <tr><td>사람·관계</td><td></td></tr>
  <tr><td>실수 → 교훈</td><td></td></tr>
</table>

${sh('i-quote','오늘 나눈 의미 있는 대화')}
<table style="width:100%;">
  <tr><th style="width:22%;">누구와</th><th style="width:20%;">어디/상황</th><th>핵심 내용·느낌</th></tr>
  <tr><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td></tr>
</table>

${sh('i-target','오늘 진척','0-100%')}
<table style="width:100%;">
  <tr><th style="width:40%;">MIT 항목</th><th style="width:15%;">상태</th><th>회고 (왜 완료/미완료?)</th></tr>
  <tr><td></td><td>__%</td><td></td></tr>
  <tr><td></td><td>__%</td><td></td></tr>
  <tr><td></td><td>__%</td><td></td></tr>
</table>

${sh('i-warning','소모한 것 / 회피한 것')}
<ul>
  <li><b>시간 낭비 1:</b>  → 다음에 방지할 방법: </li>
  <li><b>회피한 어려운 일:</b>  → 왜 미뤘나: </li>
</ul>

${sh('i-target','내일 할 일 Top 3')}
${CB('')}
${CB('')}
${CB('')}

${HRDOT}
${callout('tip','오늘의 한 줄 (내일 아침 나에게)', '<span contenteditable="true" style="display:inline-block;min-width:300px;border-bottom:1px dashed var(--paper-edge);">내일의 나에게 전하는 메시지…</span>')}

<h3 style="font-size:14px;margin-top:20px;">주간 트렌드 보기</h3>
<p style="font-size:12px;color:color-mix(in srgb, var(--ink) 55%, var(--paper));">
  일주일 쌓이면 <b>기분·에너지·수면</b> 셀만 색으로 훑어도 패턴이 보인다.
  좋은 기분이 몰려 있던 날 공통점은 무엇이었나?
</p>
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 2. 주간 플래너 — Strategic week planning
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-weekly-planner', name: '주간 플래너 (프로)', category: '플래너',
    description: '전략적 주간 계획 — OKR 연결·MIT·시간 블록·지표·회고까지.',
    icon: 'i-calendar', is_official: true,
    body: `
<h1>${icon('i-calendar',20)}주간 플래너 — ${TODAY()} 주</h1>

<table style="width:100%;">
  <tr>
    <th style="width:20%;">이번 주 테마</th>
    <td contenteditable="true">한 단어로 정의 (예: "실행", "고객", "회복")</td>
  </tr>
  <tr>
    <th>연결된 분기 OKR</th>
    <td contenteditable="true">어느 KR 에 기여하는가</td>
  </tr>
  <tr>
    <th>주간 에너지</th>
    <td>시작: __/10 · 예상 종료: __/10</td>
  </tr>
</table>

${sh('i-target','이번 주 성공 기준 (3가지 이내)','금요일에 "성공했다"고 말할 수 있으려면?')}
<ol>
  <li><b></b><br><small style="color:color-mix(in srgb, var(--ink) 50%, var(--paper));">구체적 증거: __ / 중요성: __</small></li>
  <li><b></b><br><small style="color:color-mix(in srgb, var(--ink) 50%, var(--paper));">구체적 증거: __ / 중요성: __</small></li>
  <li><b></b><br><small style="color:color-mix(in srgb, var(--ink) 50%, var(--paper));">구체적 증거: __ / 중요성: __</small></li>
</ol>

${sh('i-calendar','7일 시간 블록','집중시간(파워워크)·회의·학습·여백 배분')}
<table style="width:100%;">
  <tr>
    <th style="width:9%;">시간</th>
    <th style="width:13%;">월</th><th style="width:13%;">화</th><th style="width:13%;">수</th>
    <th style="width:13%;">목</th><th style="width:13%;">금</th><th style="width:13%;">토</th><th>일</th>
  </tr>
  <tr><th>AM 깊은 작업</th><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><th>PM 회의/협업</th><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><th>저녁 학습/운동</th><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
</table>

${sh('i-check','MIT — Most Important Tasks')}
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:45%;">할 일</th><th style="width:15%;">예상시간</th><th style="width:15%;">마감</th><th>상태</th></tr>
  <tr><td>1</td><td></td><td>h</td><td></td><td>예정</td></tr>
  <tr><td>2</td><td></td><td>h</td><td></td><td>예정</td></tr>
  <tr><td>3</td><td></td><td>h</td><td></td><td>예정</td></tr>
  <tr><td>4</td><td></td><td>h</td><td></td><td>예정</td></tr>
  <tr><td>5</td><td></td><td>h</td><td></td><td>예정</td></tr>
  <tr><th>합계</th><th></th><th></th><th></th><th></th></tr>
</table>

${sh('i-clock','기다리는 일 (Waiting-for)','다른 사람 응답 대기 — 자동 팔로업 트리거')}
<table style="width:100%;">
  <tr><th style="width:35%;">무엇</th><th style="width:20%;">누구에게</th><th style="width:15%;">요청일</th><th style="width:15%;">리마인드</th><th>에스컬레이션</th></tr>
  <tr><td></td><td></td><td></td><td>__일 후</td><td></td></tr>
</table>

${sh('i-wordcloud','주간 지표 (Weekly Scorecard)')}
<table style="width:100%;">
  <tr><th>지표</th><th style="width:13%;">지난주</th><th style="width:13%;">목표</th><th style="width:13%;">실제</th><th style="width:10%;">Δ</th><th>메모</th></tr>
  <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><th>합계</th><th></th><th></th><th></th><th></th><th></th></tr>
</table>

${sh('i-bell','주간 의례 (체크리스트)','매주 동일하게 반복할 점검')}
${CB('Inbox Zero (이메일/슬랙)')}
${CB('지난 주 미완료 항목 정리 or 버리기')}
${CB('이번 주 캘린더 리뷰 + 방어시간 설정')}
${CB('OKR 진척도 업데이트')}
${CB('1:1 · 커피챗 일정 확정')}
${CB('운동 3회 스케줄링')}
${CB('재정/가계부 리뷰')}

${HR}
${sh('i-redo','주간 회고','금요일 or 일요일 저녁 10분')}

<table style="width:100%;">
  <tr><th style="width:20%;">잘된 것 (Win)</th><td></td></tr>
  <tr><th>아쉬운 것 (Lose)</th><td></td></tr>
  <tr><th>배운 것 (Learn)</th><td></td></tr>
  <tr><th>다음 주 실험 (Try)</th><td></td></tr>
</table>

${callout('tip','실행률이 낮다면', '할 일 수를 줄이세요. 5개를 50% 하는 것보다 <b>3개를 100% 하는 편이 언제나 낫습니다</b>.')}
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 3. 회의록 — Enterprise-grade with Decision Log + Action Items
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-meeting-minutes', name: '회의록 (프로)', category: '비즈니스',
    description: '참석자·안건·의사결정 로그·액션아이템·파킹랏까지. 분산팀·감사·계약 근거 수준.',
    icon: 'i-clipboard', is_official: true,
    body: `
<h1>${icon('i-clipboard',20)}회의록 — <span contenteditable="true" style="border-bottom:1px dashed var(--paper-edge);">[회의 주제]</span></h1>

<table style="width:100%;">
  <tr><th style="width:15%;">회의 ID</th><td>MTG-${new Date().getFullYear()}-<span contenteditable="true">001</span></td>
      <th style="width:15%;">회의 유형</th><td>의사결정 / 정보공유 / 브레인스토밍 / 기타</td></tr>
  <tr><th>일시</th><td>${TODAY()}  :  ~  :</td>
      <th>장소/채널</th><td>회의실 __ / Zoom / Google Meet / Teams</td></tr>
  <tr><th>녹화/녹취</th><td>동의 확인 ☐ · 저장 위치: </td>
      <th>기록자</th><td></td></tr>
  <tr><th>선행 문서</th><td colspan="3">회의 자료 / 이전 회의록 / 관련 티켓</td></tr>
</table>

${sh('i-target','회의 목적 & 성공 기준')}
<blockquote>
  <b>이 회의가 끝났을 때 무엇이 결정되어 있어야 하는가?</b> (= 이게 없으면 회의를 잡지 말아야 함)
</blockquote>
<ul>
  <li><b>목적:</b> </li>
  <li><b>성공 기준 (회의가 잘 끝났다고 판단할 기준):</b> </li>
  <li><b>비목적 (이 회의에서 다루지 않을 것):</b> </li>
</ul>

${sh('i-list','참석자 & 역할')}
<table style="width:100%;">
  <tr><th style="width:18%;">이름</th><th style="width:22%;">소속/직함</th><th style="width:18%;">역할(R/A/C/I)</th><th style="width:10%;">참석</th><th>사전배포 자료</th></tr>
  <tr><td></td><td></td><td>의사결정자(A)</td><td>☑</td><td>읽음 ☐</td></tr>
  <tr><td></td><td></td><td>실행(R)</td><td>☑</td><td>읽음 ☐</td></tr>
  <tr><td></td><td></td><td>자문(C)</td><td>☑</td><td></td></tr>
  <tr><td></td><td></td><td>정보수신(I)</td><td>☐</td><td>회의록 송부</td></tr>
</table>

${sh('i-list-ol','안건 (Agenda)')}
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:35%;">안건</th><th style="width:15%;">발표자</th><th style="width:10%;">시간</th><th>목적(결정/공유/논의)</th></tr>
  <tr><td>1</td><td></td><td></td><td>(  )분</td><td></td></tr>
  <tr><td>2</td><td></td><td></td><td>(  )분</td><td></td></tr>
  <tr><td>3</td><td></td><td></td><td>(  )분</td><td></td></tr>
  <tr><th>합계</th><th></th><th></th><th></th><th></th></tr>
</table>

${HR}
${sh('i-quote','논의 내용 (안건별)')}
<h3>1. </h3>
<ul>
  <li><b>요점:</b> </li>
  <li><b>쟁점:</b> </li>
  <li><b>의견 A:</b> (누가) </li>
  <li><b>의견 B:</b> (누가) </li>
</ul>

<h3>2. </h3>
<ul><li></li></ul>

${sh('i-check','의사결정 로그 (Decision Log)','나중에 감사·분쟁 발생 시 근거')}
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:40%;">결정 내용</th><th style="width:15%;">근거</th><th style="width:15%;">반대/유보</th><th>결정자</th></tr>
  <tr><td>D-1</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>D-2</td><td></td><td></td><td></td><td></td></tr>
</table>

${sh('i-send','액션 아이템 (Action Items)','SMART — Specific, Measurable, Assignee, Realistic, Time-bound')}
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:40%;">무엇을</th><th style="width:15%;">누가</th><th style="width:15%;">언제까지</th><th style="width:10%;">중요도</th><th>상태</th></tr>
  <tr><td>A-1</td><td></td><td></td><td></td><td>H/M/L</td><td>예정</td></tr>
  <tr><td>A-2</td><td></td><td></td><td></td><td>H/M/L</td><td>예정</td></tr>
  <tr><td>A-3</td><td></td><td></td><td></td><td>H/M/L</td><td>예정</td></tr>
</table>

${sh('i-clock','파킹랏 (Parking Lot)','오늘 논의하지 않기로 한 주제 — 다음 회의로')}
<ul><li></li></ul>

${sh('i-pin','다음 회의')}
<table style="width:100%;">
  <tr><th style="width:20%;">일시</th><td></td></tr>
  <tr><th>주요 안건</th><td></td></tr>
  <tr><th>사전 준비</th><td></td></tr>
  <tr><th>참석 예정자</th><td></td></tr>
</table>

${callout('tip','회의록을 보낼 때', '요약을 <b>본문 상단 3줄</b>로: "결정 N개, 액션 N개, 다음 회의 언제" — 참석자들이 한 번에 스캔 가능.')}
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 4. 1:1 미팅 — CBI feedback + growth + wellbeing
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-one-on-one', name: '1:1 미팅', category: '비즈니스',
    description: 'CBI 프레임워크 기반 1:1. 근황·성장·차단요소·양방향 피드백·약속 추적.',
    icon: 'i-target', is_official: true,
    body: `
<h1>${icon('i-target',20)}1:1 — <span contenteditable="true">[멤버 이름]</span></h1>

<table style="width:100%;">
  <tr><th style="width:18%;">일시</th><td>${TODAY()} · 격주 / 매주</td>
      <th style="width:18%;">이전 1:1</th><td contenteditable="true">YYYY-MM-DD</td></tr>
  <tr><th>멤버 현재 무드</th><td>😞 · 😐 · 🙂 · 😄 · 😄 (해당에 ●)</td>
      <th>에너지 레벨</th><td>__/10</td></tr>
  <tr><th>이 1:1 목적</th><td colspan="3" contenteditable="true">정기 점검 / 특정 이슈 / 커리어 대화 / 피드백 전달</td></tr>
</table>

${sh('i-quote','체크인 — 근황 · 무드 (5분)','일 얘기 말고 사람으로서 어떤 상태인지')}
<ul>
  <li><b>이번 주/2주 가장 기억에 남는 일:</b> </li>
  <li><b>개인적으로 (일 밖) 큰 일 있었는가:</b> </li>
  <li><b>에너지를 뺏기는 것:</b> </li>
  <li><b>에너지를 주는 것:</b> </li>
</ul>

${sh('i-clipboard','업무 진행 · 차단요소 (15분)')}
<table style="width:100%;">
  <tr><th style="width:35%;">진행 중인 일</th><th style="width:15%;">상태</th><th>블로커 (내가 도울 것)</th></tr>
  <tr><td></td><td>진행/지연/완료</td><td></td></tr>
  <tr><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td></tr>
</table>

${sh('i-sparkles','성장 · 커리어 (5분)','분기마다 1번은 반드시 다루기')}
<table style="width:100%;">
  <tr><th style="width:25%;">배우고 있는 스킬</th><td></td></tr>
  <tr><th>다음 스트레치 목표</th><td></td></tr>
  <tr><th>필요한 지원</th><td>시간/예산/연결/멘토링…</td></tr>
  <tr><th>3개월 뒤 성장 모습</th><td></td></tr>
</table>

${sh('i-thumbs-up','피드백 (CBI 프레임워크)','Context · Behavior · Impact 순으로 구체적으로')}

<h3 style="margin-top:12px;">매니저 → 멤버 (강점 & 개선)</h3>
${callout('info','CBI 예시', '<b>C(상황)</b> 어제 리뷰 회의에서 고객이 까다로운 질문을 던졌을 때… <b>B(행동)</b> 데이터를 근거로 침착하게 반박했고… <b>I(영향)</b> 고객이 계약을 연장하기로 결정했다.')}
<table style="width:100%;">
  <tr><th style="width:16%;">강점/긍정</th><td></td></tr>
  <tr><th>개선 포인트</th><td></td></tr>
  <tr><th>구체적 행동 요청</th><td></td></tr>
</table>

<h3>멤버 → 매니저 (어떤 지원이 필요한가)</h3>
<table style="width:100%;">
  <tr><th style="width:16%;">더 해줬으면</th><td></td></tr>
  <tr><th>덜 해줬으면</th><td></td></tr>
  <tr><th>계속 해줬으면</th><td></td></tr>
</table>

${sh('i-send','액션 아이템 (양쪽)')}
<table style="width:100%;">
  <tr><th style="width:45%;">할 일</th><th style="width:20%;">담당</th><th>마감</th></tr>
  <tr><td></td><td>매니저</td><td></td></tr>
  <tr><td></td><td>멤버</td><td></td></tr>
</table>

${sh('i-pin','다음 1:1 전까지 체크')}
${CB('약속한 피드백/자료 전달')}
${CB('차단요소 중 하나 제거')}
${CB('다음 1:1 안건 초대장에 미리 메모')}

${callout('warn','피해야 할 1:1 안티패턴', '① 상태 보고만 받고 끝 ② 내가 80% 말함 ③ 피드백을 "잘 하고 있어요"로 회피 ④ 감정적 이슈를 건너뜀.')}
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 5. 프로젝트 킥오프 — ENTERPRISE GRADE (대대적 업그레이드)
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-project-kickoff', name: '프로젝트 킥오프', category: '프로젝트',
    description: '프로젝트 차터 수준 — 목적·범위·일정·RACI·이해관계자·리스크·예산·커뮤니케이션 계획·의존성.',
    icon: 'i-rocket', is_official: true,
    body: `
<h1>${icon('i-rocket',20)}프로젝트 킥오프 — <span contenteditable="true" style="border-bottom:1px dashed var(--paper-edge);">[프로젝트명]</span></h1>
<p style="color:color-mix(in srgb, var(--ink) 55%, var(--paper));font-size:12px;">
  프로젝트 차터 버전: v1.0 · 최종 수정: ${TODAY()} · 상태: 초안/승인 대기/승인됨
</p>

${callout('info','이 문서를 잘 쓰는 법', '킥오프 <b>이전</b>에 스폰서와 프로젝트 리드가 함께 작성. 킥오프 미팅에서 이 문서로 이해관계자 정렬. 모든 범위 논의는 이 문서를 기준점으로.')}

<h2>${icon('i-info',20)}1. 프로젝트 기본 정보</h2>
<table style="width:100%;">
  <tr><th style="width:18%;">프로젝트명</th><td contenteditable="true"></td></tr>
  <tr><th>프로젝트 코드</th><td contenteditable="true">예: PROJ-2026-001</td></tr>
  <tr><th>스폰서 (책임자)</th><td contenteditable="true">의사결정 최종 권한자</td></tr>
  <tr><th>프로젝트 리드</th><td contenteditable="true">일상 실행 책임자</td></tr>
  <tr><th>기간</th><td contenteditable="true">${TODAY()} ~ </td></tr>
  <tr><th>예산 총액</th><td contenteditable="true">₩ / $</td></tr>
  <tr><th>우선순위</th><td>P0 (전사 최우선) / P1 (부서 최우선) / P2 / P3</td></tr>
</table>

<h2>${icon('i-target',20)}2. 왜 (Why) — 비즈니스 케이스</h2>
<table style="width:100%;">
  <tr><th style="width:25%;">현재 문제</th><td>지금 안 하면 발생하는 손실·위험·기회비용</td></tr>
  <tr><th>기회 (Opportunity)</th><td>이 프로젝트가 열어주는 새로운 가능성</td></tr>
  <tr><th>이 프로젝트를 안 하면?</th><td>Do-nothing 시나리오의 결과</td></tr>
  <tr><th>왜 지금(Now)?</th><td>타이밍이 중요한 이유</td></tr>
</table>

<h2>${icon('i-folder',20)}3. 무엇을 (What) — 범위 정의</h2>

<h3>3.1 포함·제외 범위</h3>
<table style="width:100%;">
  <tr><th style="width:50%;">포함 (In Scope)</th><th>제외 (Out of Scope)</th></tr>
  <tr style="vertical-align:top;height:120px;"><td></td><td></td></tr>
</table>

<h3>3.2 산출물 (Deliverables)</h3>
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:30%;">산출물</th><th style="width:25%;">수용 기준 (Acceptance)</th><th style="width:15%;">책임자</th><th>목표일</th></tr>
  <tr><td>D1</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>D2</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>D3</td><td></td><td></td><td></td><td></td></tr>
</table>

<h3>3.3 가정 & 제약</h3>
<table style="width:100%;">
  <tr><th style="width:50%;">가정 (Assumptions)</th><th>제약 (Constraints)</th></tr>
  <tr style="vertical-align:top;height:80px;"><td>예: 고객사 API 가 안정적으로 제공됨</td><td>예: 예산 2억 초과 불가</td></tr>
</table>

<h2>${icon('i-list',20)}4. 이해관계자 분석 (Stakeholder Map)</h2>
<table style="width:100%;">
  <tr><th style="width:18%;">이름·역할</th><th style="width:13%;">그룹</th><th style="width:13%;">영향력</th><th style="width:13%;">관심도</th><th style="width:15%;">입장</th><th>참여 전략</th></tr>
  <tr><td></td><td>내부/외부</td><td>H/M/L</td><td>H/M/L</td><td>찬성/중립/반대</td><td>상시 보고/월간/킥오프만</td></tr>
  <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
</table>

<h2>${icon('i-list',20)}5. RACI 매트릭스</h2>
${callout('info','RACI 규칙', '<b>R</b>(Responsible) 실행 · <b>A</b>(Accountable) 책임 1명만 · <b>C</b>(Consulted) 양방향 자문 · <b>I</b>(Informed) 일방향 통보')}
<table style="width:100%;">
  <tr><th>활동</th><th style="width:8%;">스폰서</th><th style="width:8%;">PM</th><th style="width:8%;">개발</th><th style="width:8%;">디자인</th><th style="width:8%;">QA</th><th style="width:8%;">마케팅</th><th style="width:8%;">법무</th></tr>
  <tr><td>전략 결정</td><td>A</td><td>R</td><td>C</td><td>C</td><td>I</td><td>C</td><td>I</td></tr>
  <tr><td>일정 관리</td><td>I</td><td>A/R</td><td>C</td><td>C</td><td>C</td><td>I</td><td>I</td></tr>
  <tr><td>구현</td><td>I</td><td>A</td><td>R</td><td>R</td><td>C</td><td>I</td><td>I</td></tr>
  <tr><td>품질 검수</td><td>I</td><td>A</td><td>C</td><td>C</td><td>R</td><td>I</td><td>I</td></tr>
  <tr><td>외부 커뮤니케이션</td><td>C</td><td>R</td><td>I</td><td>I</td><td>I</td><td>A</td><td>C</td></tr>
  <tr><td>리스크 관리</td><td>A</td><td>R</td><td>C</td><td>C</td><td>C</td><td>C</td><td>C</td></tr>
  <tr><td>런칭 승인</td><td>A</td><td>R</td><td>C</td><td>C</td><td>C</td><td>C</td><td>C</td></tr>
</table>

<h2>${icon('i-calendar',20)}6. 마일스톤 & 일정</h2>
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:25%;">마일스톤</th><th style="width:15%;">목표일</th><th style="width:25%;">주요 산출물</th><th>Go/No-Go 기준</th></tr>
  <tr><td>M0</td><td>킥오프</td><td>${TODAY()}</td><td>이 차터 승인</td><td>스폰서 sign-off</td></tr>
  <tr><td>M1</td><td>발견·분석 완료</td><td></td><td>요구사항·리서치 보고서</td><td>이해관계자 합의</td></tr>
  <tr><td>M2</td><td>MVP 시연</td><td></td><td>동작하는 프로토타입</td><td>핵심 시나리오 통과</td></tr>
  <tr><td>M3</td><td>베타 오픈</td><td></td><td>제한 사용자 대상 배포</td><td>품질 게이트 통과</td></tr>
  <tr><td>M4</td><td>정식 런칭</td><td></td><td>전체 사용자 배포</td><td>성공 지표 X% 달성</td></tr>
  <tr><td>M5</td><td>프로젝트 종료</td><td></td><td>회고·문서화·전달</td><td>운영 팀 인수</td></tr>
</table>

<h2>${icon('i-warning',20)}7. 리스크 레지스터 (상시 업데이트)</h2>
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:25%;">리스크</th><th style="width:10%;">영향</th><th style="width:10%;">가능성</th><th style="width:10%;">점수</th><th style="width:30%;">완화 계획</th><th>소유자</th></tr>
  <tr><td>R1</td><td></td><td>1-5</td><td>1-5</td><td>곱</td><td></td><td></td></tr>
  <tr><td>R2</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td>R3</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><th>합계</th><th></th><th></th><th></th><th></th><th></th><th></th></tr>
</table>
${callout('tip','리스크 우선순위', '점수(영향×가능성) ≥ 15 = 매주 점검, 10-14 = 격주, 10 미만 = 월간. 가장 큰 리스크부터 완화.')}

<h2>${icon('i-link',20)}8. 의존성 (Dependencies)</h2>
<table style="width:100%;">
  <tr><th style="width:35%;">의존 항목</th><th style="width:20%;">주체(내부/외부)</th><th style="width:15%;">필요 시점</th><th>실패 시 대안</th></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
</table>

<h2>${icon('i-wordcloud',20)}9. 예산 상세</h2>
<table style="width:100%;">
  <tr><th>항목</th><th style="width:12%;">계획</th><th style="width:12%;">실제</th><th style="width:10%;">Δ</th><th>비고</th></tr>
  <tr><td>인건비</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>외주</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>라이선스·SaaS</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>인프라·호스팅</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>마케팅</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>예비비 (10%)</td><td></td><td></td><td></td><td></td></tr>
  <tr><th>합계</th><th></th><th></th><th></th><th></th></tr>
</table>

<h2>${icon('i-trophy',20)}10. 성공 지표 (Success Metrics)</h2>
<table style="width:100%;">
  <tr><th style="width:20%;">지표 유형</th><th style="width:35%;">지표</th><th style="width:15%;">현재(Baseline)</th><th style="width:15%;">목표(Target)</th><th>측정 방법</th></tr>
  <tr><td>주요 (Primary)</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>부가 (Secondary)</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>가드레일 (Guardrail)</td><td></td><td></td><td>넘으면 안 됨</td><td></td></tr>
</table>

<h2>${icon('i-send',20)}11. 커뮤니케이션 계획</h2>
<table style="width:100%;">
  <tr><th style="width:22%;">채널</th><th style="width:22%;">대상</th><th style="width:15%;">주기</th><th>내용</th></tr>
  <tr><td>주간 리포트</td><td>스폰서/이해관계자</td><td>매주 금요일</td><td>진척·리스크·결정사항</td></tr>
  <tr><td>일간 스탠드업</td><td>실행팀</td><td>매일 10분</td><td>어제/오늘/블로커</td></tr>
  <tr><td>마일스톤 데모</td><td>전사</td><td>마일스톤별</td><td>진척·피드백 수집</td></tr>
  <tr><td>긴급 에스컬레이션</td><td>스폰서</td><td>즉시</td><td>P0 리스크·범위 변경</td></tr>
</table>

<h2>${icon('i-check',20)}12. 킥오프 미팅 체크리스트</h2>
${CB('이 문서 사전 배포 (48시간 전)')}
${CB('이해관계자 초대 완료')}
${CB('스폰서 오프닝 인사 준비')}
${CB('각 팀 역할·약속사항 확인')}
${CB('첫 2주 스프린트 계획 수립')}
${CB('주간 리포트 템플릿 공유')}
${CB('질문·우려사항 회수 (파킹랏)')}

${HR}
<p style="text-align:right;margin-top:20px;">
  <b>승인 (Sign-off)</b><br>
  스폰서: ________________ 날짜: ____________<br>
  프로젝트 리드: ________________ 날짜: ____________<br>
  재무 승인: ________________ 날짜: ____________
</p>

${callout('warn','프로젝트가 실패하는 5대 이유', '① 범위가 모호함 ② 스폰서 부재 ③ 의존성 간과 ④ 이해관계자 불일치 ⑤ 성공 기준 없음. 이 문서는 이 5가지를 커버하도록 설계됨.')}
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 6. 독서 노트 — Deep reading + Feynman + application
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-book-notes', name: '독서 노트', category: '학습',
    description: 'Feynman 방식 + 핵심 메시지 재구성 + 실천 액션. 한 번 정리하면 평생 활용.',
    icon: 'i-book', is_official: true,
    body: `
<h1>${icon('i-book',20)}<span contenteditable="true">[책 제목]</span></h1>

<table style="width:100%;">
  <tr><th style="width:18%;">저자</th><td contenteditable="true"></td>
      <th style="width:18%;">출판 연도</th><td contenteditable="true"></td></tr>
  <tr><th>장르</th><td contenteditable="true">자기계발/비즈니스/소설/과학/철학…</td>
      <th>분량</th><td contenteditable="true">페이지 / 오디오 __시간</td></tr>
  <tr><th>읽은 기간</th><td>${TODAY()} — </td>
      <th>읽은 횟수</th><td>1회 / 재독 __회</td></tr>
  <tr><th>평점</th><td>${starRow}</td>
      <th>한 줄 요약</th><td contenteditable="true"></td></tr>
</table>

${sh('i-help','Why — 왜 읽었는가','독서 전 3분 자문')}
<table style="width:100%;">
  <tr><th style="width:25%;">답을 찾는 질문</th><td></td></tr>
  <tr><th>기대한 결과</th><td></td></tr>
  <tr><th>이 책을 선택한 이유</th><td>추천/서평/필요/관심사…</td></tr>
</table>

${sh('i-key','핵심 메시지 (1-3-5 원칙)','한 문장 · 3가지 · 5개 예')}
<table style="width:100%;">
  <tr><th style="width:20%;">1문장 요약</th><td>누가 읽어도 이해할 수준으로</td></tr>
  <tr><th>핵심 주장 3가지</th><td><ol><li></li><li></li><li></li></ol></td></tr>
  <tr><th>지지 증거 5개</th><td><ol><li></li><li></li><li></li><li></li><li></li></ol></td></tr>
</table>

${sh('i-quote','인상 깊은 인용 & 내 생각','페이지 적어두면 나중에 다시 찾기 쉬움')}
<table style="width:100%;">
  <tr><th style="width:8%;">페이지</th><th style="width:45%;">인용</th><th style="width:25%;">내 해석·반응</th><th>연결되는 것</th></tr>
  <tr><td></td><td><blockquote style="margin:0;border:0;padding:0;"></blockquote></td><td></td><td>다른 책/경험…</td></tr>
  <tr><td></td><td><blockquote style="margin:0;border:0;padding:0;"></blockquote></td><td></td><td></td></tr>
  <tr><td></td><td><blockquote style="margin:0;border:0;padding:0;"></blockquote></td><td></td><td></td></tr>
  <tr><td></td><td><blockquote style="margin:0;border:0;padding:0;"></blockquote></td><td></td><td></td></tr>
  <tr><td></td><td><blockquote style="margin:0;border:0;padding:0;"></blockquote></td><td></td><td></td></tr>
</table>

${sh('i-sparkles','Feynman 테스트','5살 아이에게 설명할 수 있는가?')}
<blockquote>
  이 책의 핵심을 <b>전공 없는 친구</b>에게 2분 안에 설명한다면?
</blockquote>
<p style="padding:10px;border:1px dashed var(--paper-edge);border-radius:4px;min-height:60px;" contenteditable="true"></p>

${sh('i-thumbs-up','동의 & 반대','무비판 수용 아닌 비평적 독서')}
<table style="width:100%;">
  <tr><th style="width:50%;">동의하는 주장</th><th>반대/의심스러운 주장</th></tr>
  <tr style="vertical-align:top;height:80px;"><td></td><td></td></tr>
</table>

${sh('i-send','실천 액션 — 내 삶에 적용할 3가지','구체적 행동으로 번역')}
<table style="width:100%;">
  <tr><th style="width:45%;">실천할 구체 행동</th><th style="width:15%;">언제부터</th><th style="width:15%;">성공 지표</th><th>1주일 후 체크</th></tr>
  <tr><td></td><td></td><td></td><td>☐ 실천함  ☐ 못함</td></tr>
  <tr><td></td><td></td><td></td><td>☐</td></tr>
  <tr><td></td><td></td><td></td><td>☐</td></tr>
</table>

${sh('i-link','연결 — 관련 도서·자료·인물')}
<table style="width:100%;">
  <tr><th style="width:30%;">연결 항목</th><th style="width:20%;">유형</th><th>연결 이유</th></tr>
  <tr><td></td><td>책/영상/논문/인물</td><td></td></tr>
  <tr><td></td><td></td><td></td></tr>
</table>

${sh('i-target','재독 판단')}
<ul>
  <li><b>언제 다시 읽을 가치가 있나:</b> </li>
  <li><b>다시 읽을 때 볼 장:</b> </li>
  <li><b>책장에 꽂을 섹션:</b> 참고서/영감/보관/기부</li>
</ul>

${callout('tip','더 잘 기억하려면', '다 읽고 나서 <b>24시간 뒤 / 1주 뒤 / 1달 뒤</b> 이 노트만 다시 스캔. 간격 반복이 기억을 고정.')}
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 7. 영화·콘텐츠 리뷰 — Structured analysis
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-media-review', name: '영화·콘텐츠 리뷰', category: '학습',
    description: '스토리·연출·연기 프레임워크. 단순 감상 아닌 분석적 리뷰.',
    icon: 'i-star', is_official: true,
    body: `
<h1>${icon('i-star',20)}<span contenteditable="true">[제목]</span></h1>

<table style="width:100%;">
  <tr><th style="width:15%;">유형</th><td>영화/드라마/애니/다큐/유튜브/팟캐스트</td>
      <th style="width:15%;">장르</th><td contenteditable="true"></td></tr>
  <tr><th>감독/크리에이터</th><td contenteditable="true"></td>
      <th>주연</th><td contenteditable="true"></td></tr>
  <tr><th>공개/제작</th><td contenteditable="true">YYYY / 제작국</td>
      <th>러닝타임</th><td contenteditable="true"></td></tr>
  <tr><th>본 날짜</th><td>${TODAY()}</td>
      <th>플랫폼</th><td contenteditable="true">넷플릭스/극장/유튜브…</td></tr>
</table>

${sh('i-wordcloud','평점 분해','단일 별점보다 차원별로')}
<table style="width:100%;">
  <tr><th>차원</th><th style="width:15%;">점수 (1-10)</th><th>근거</th></tr>
  <tr><td>스토리·구성</td><td></td><td></td></tr>
  <tr><td>연출·영상미</td><td></td><td></td></tr>
  <tr><td>연기·캐릭터</td><td></td><td></td></tr>
  <tr><td>음악·사운드</td><td></td><td></td></tr>
  <tr><td>재관람 의향</td><td></td><td></td></tr>
  <tr><th>평균</th><th></th><th></th></tr>
</table>

${sh('i-quote','스포일러 없는 한 줄 소개')}
<blockquote contenteditable="true" style="font-style:italic;">Twitter 280자 이내로</blockquote>

${sh('i-target','핵심 주제 · 메시지','작품이 전달하려는 본질')}
<ul>
  <li><b>표면 이야기:</b> 줄거리 차원에서 </li>
  <li><b>심층 주제:</b> 작품이 정말 말하려는 것 </li>
  <li><b>상징/은유:</b> 반복되는 이미지·모티프 </li>
</ul>

${sh('i-thumbs-up','좋았던 점')}
<ol>
  <li></li>
  <li></li>
  <li></li>
</ol>

${sh('i-thumbs-down','아쉬운 점')}
<ol>
  <li></li>
  <li></li>
</ol>

${sh('i-sparkles','가장 인상 깊었던 장면 (스포일러)')}
<table style="width:100%;">
  <tr><th style="width:30%;">장면</th><th>왜 인상적이었나</th></tr>
  <tr><td></td><td></td></tr>
  <tr><td></td><td></td></tr>
</table>

${sh('i-quote','기억에 남는 대사')}
<blockquote></blockquote>
<p style="font-size:12px;color:color-mix(in srgb, var(--ink) 50%, var(--paper));">— (캐릭터명)</p>

${sh('i-target','추천 & 비추천 페르소나')}
<table style="width:100%;">
  <tr><th style="width:50%;">이런 분에게 강추</th><th>이런 분에겐 비추</th></tr>
  <tr style="vertical-align:top;height:80px;"><td></td><td></td></tr>
</table>

${sh('i-link','함께 볼 작품')}
<ul>
  <li><b>주제가 비슷한:</b> </li>
  <li><b>감독의 다른 작품:</b> </li>
  <li><b>대비되는 관점의 작품:</b> </li>
</ul>

${callout('tip','리뷰를 더 풍성하게', '본 직후 <b>10분 안에</b> 감정 먼저 기록 → 하루 뒤 분석 섹션 → 일주일 뒤 추천/연결 추가. 시간차가 다른 깊이를 만든다.')}
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 8. SOP — Complete operational procedure
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-sop', name: 'SOP · 표준 운영 절차', category: '비즈니스',
    description: '인수인계·감사·ISO 대응 가능한 표준 운영 절차. 트리거·입력·단계·검증·예외까지.',
    icon: 'i-edit', is_official: true,
    body: `
<h1>${icon('i-edit',20)}SOP — <span contenteditable="true">[절차명]</span></h1>

<table style="width:100%;">
  <tr><th style="width:18%;">문서 ID</th><td contenteditable="true">SOP-[팀]-001</td>
      <th style="width:18%;">버전</th><td>v1.0</td></tr>
  <tr><th>최초 작성일</th><td>${TODAY()}</td>
      <th>최근 개정</th><td>${TODAY()}</td></tr>
  <tr><th>프로세스 오너</th><td contenteditable="true"></td>
      <th>승인자</th><td contenteditable="true"></td></tr>
  <tr><th>리뷰 주기</th><td>3개월 / 6개월 / 1년</td>
      <th>다음 리뷰</th><td contenteditable="true"></td></tr>
  <tr><th>대상 역할</th><td colspan="3">누가 이 SOP 를 실행해야 하는가</td></tr>
</table>

${sh('i-info','개정 이력')}
<table style="width:100%;">
  <tr><th style="width:10%;">버전</th><th style="width:15%;">날짜</th><th style="width:20%;">수정자</th><th>변경 내용</th></tr>
  <tr><td>v1.0</td><td>${TODAY()}</td><td></td><td>최초 작성</td></tr>
</table>

${sh('i-target','1. 목적 (Why)')}
<blockquote>
  이 절차가 <b>왜</b> 존재하는가? 지키지 않으면 어떤 문제가 발생하는가?
</blockquote>
<p></p>

${sh('i-bell','2. 트리거 — 언제 실행되나')}
<ul>
  <li><b>시간 기반:</b> 매주 월요일 9시 / 월말 영업일… </li>
  <li><b>이벤트 기반:</b> 신규 고객 가입 / 티켓 P0 발생… </li>
  <li><b>조건 기반:</b> 재고 __ 이하 시… </li>
</ul>

${sh('i-folder','3. 입력 — 시작 전 준비물')}
<table style="width:100%;">
  <tr><th style="width:25%;">유형</th><th style="width:40%;">항목</th><th>확보 방법</th></tr>
  <tr><td>권한 (Access)</td><td></td><td></td></tr>
  <tr><td>도구 (Tools)</td><td></td><td></td></tr>
  <tr><td>데이터 (Data)</td><td></td><td></td></tr>
  <tr><td>사람 (People)</td><td></td><td></td></tr>
  <tr><td>예산 (Budget)</td><td></td><td></td></tr>
</table>

${sh('i-list-ol','4. 절차 — 단계별 실행')}
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:30%;">무엇을</th><th style="width:30%;">어떻게 (화면·명령·링크)</th><th style="width:15%;">예상시간</th><th>완료 기준</th></tr>
  <tr><td>1</td><td></td><td></td><td>__분</td><td></td></tr>
  <tr><td>2</td><td></td><td></td><td>__분</td><td></td></tr>
  <tr><td>3</td><td></td><td></td><td>__분</td><td></td></tr>
  <tr><td>4</td><td></td><td></td><td>__분</td><td></td></tr>
  <tr><td>5</td><td></td><td></td><td>__분</td><td></td></tr>
  <tr><th>합계</th><th></th><th></th><th>__분</th><th></th></tr>
</table>

${sh('i-warning','5. 예외 처리 & 에스컬레이션')}
<table style="width:100%;">
  <tr><th style="width:35%;">이런 상황이 발생하면</th><th style="width:25%;">1차 대응</th><th style="width:20%;">2차 (에스컬레이션)</th><th>기록 위치</th></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
</table>

${sh('i-check','6. 품질 체크 — 각 실행 후')}
${CB('산출물이 정의된 기준을 충족하는가')}
${CB('관련 이해관계자에게 통보 완료')}
${CB('필수 기록·로그 저장')}
${CB('다음 단계 트리거 발송')}

${sh('i-wordcloud','7. 성과 지표')}
<table style="width:100%;">
  <tr><th>지표</th><th style="width:15%;">목표</th><th style="width:15%;">이번 달</th><th>측정 방법</th></tr>
  <tr><td>소요 시간 (평균)</td><td></td><td></td><td></td></tr>
  <tr><td>에러율</td><td></td><td></td><td></td></tr>
  <tr><td>고객 만족도</td><td></td><td></td><td></td></tr>
</table>

${sh('i-link','8. 관련 문서 · 링크')}
<ul>
  <li><b>상위 정책:</b> </li>
  <li><b>연관 SOP:</b> </li>
  <li><b>템플릿·양식:</b> </li>
  <li><b>학습 자료:</b> </li>
</ul>

${callout('warn','SOP 업데이트 기준', '① 3회 이상 같은 질문/실수 발생 ② 관련 정책·시스템 변경 ③ 6개월 주기 리뷰 시 — 이때 문서 버전 올리고 개정 이력 기록.')}
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 9. 고객 인터뷰 — JTBD + Mom Test + synthesis
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-user-interview', name: '고객 인터뷰', category: '리서치',
    description: 'Jobs-to-be-Done + Mom Test 프레임워크. 가설 검증부터 인사이트 종합까지.',
    icon: 'i-smile', is_official: true,
    body: `
<h1>${icon('i-smile',20)}고객 인터뷰 — <span contenteditable="true">[상대 ID/이니셜]</span></h1>

<table style="width:100%;">
  <tr><th style="width:18%;">인터뷰 번호</th><td>INT-${new Date().getFullYear()}-<span contenteditable="true">001</span></td>
      <th style="width:18%;">일시</th><td>${TODAY()}  :  ~  :</td></tr>
  <tr><th>채널</th><td>대면/화상/전화</td>
      <th>인터뷰어</th><td contenteditable="true"></td></tr>
  <tr><th>녹음 동의</th><td>☐ · 위치: </td>
      <th>공유 범위</th><td>팀/전사/비공개</td></tr>
</table>

${sh('i-smile','인터뷰이 프로필')}
<table style="width:100%;">
  <tr><th style="width:25%;">세그먼트</th><td contenteditable="true">얼리어답터/메인스트림/이탈자…</td></tr>
  <tr><th>나이·성별·지역</th><td contenteditable="true"></td></tr>
  <tr><th>직업·산업</th><td contenteditable="true"></td></tr>
  <tr><th>제품 사용 경험</th><td contenteditable="true">기간·빈도·주 용도</td></tr>
  <tr><th>섭외 경로</th><td contenteditable="true">당근·고객DB·프렌드오브프렌드…</td></tr>
</table>

${sh('i-target','이 인터뷰의 가설','인터뷰 전 30분 작성')}
<table style="width:100%;">
  <tr><th style="width:25%;">검증할 가설</th><td>"___ 세그먼트는 ___ 상황에서 ___ 때문에 ___ 을 필요로 한다"</td></tr>
  <tr><th>반증 시그널</th><td>이 가설이 틀렸다고 판단할 관찰은 무엇인가</td></tr>
  <tr><th>확증 시그널</th><td>이 가설이 맞다고 판단할 관찰은 무엇인가</td></tr>
</table>

${callout('info','The Mom Test — 3 원칙', '① 미래 가정("~하시겠어요?") 대신 <b>과거 행동</b>("마지막으로 ~한 게 언제?") ② 문제를 먼저, 솔루션은 나중 ③ 침묵 3초 기다리기 — 진짜 얘기는 거기서 나온다')}

${sh('i-help','핵심 질문 (JTBD 구조)','상황 · 동기 · 현재 솔루션 · 불편 · 대안 · 비용')}
<table style="width:100%;">
  <tr><th style="width:32%;">질문</th><th>답변 요약</th></tr>
  <tr><td><b>상황</b><br>최근 [관련 상황]이 있었던 게 언제입니까?</td><td></td></tr>
  <tr><td><b>동기</b><br>그때 무엇을 이루고 싶었습니까?</td><td></td></tr>
  <tr><td><b>현재 솔루션</b><br>어떻게 해결했습니까? 단계별로 알려주세요.</td><td></td></tr>
  <tr><td><b>불편</b><br>그 방법에서 가장 불편한 순간은?</td><td></td></tr>
  <tr><td><b>대안 탐색</b><br>다른 방법을 찾아봤거나 써본 적이 있나요?</td><td></td></tr>
  <tr><td><b>비용</b><br>그 문제를 해결하는 데 돈/시간을 쓸 의향이 있나요? 얼마까지?</td><td></td></tr>
  <tr><td><b>영향권</b><br>이 문제를 누구와 상담하나요? 누가 의사결정에 영향?</td><td></td></tr>
</table>

${sh('i-search','관찰 — 말보다 행동 · 표정','인터뷰 중 실시간 기록')}
<table style="width:100%;">
  <tr><th style="width:25%;">관찰 종류</th><th>구체적 내용</th></tr>
  <tr><td>반복된 단어·은어</td><td></td></tr>
  <tr><td>이야기할 때 표정·톤</td><td></td></tr>
  <tr><td>회피/망설인 주제</td><td></td></tr>
  <tr><td>자발적으로 꺼낸 이야기</td><td></td></tr>
  <tr><td>예상 밖 발언</td><td></td></tr>
</table>

${sh('i-quote','직접 인용 (그대로 녹취)','"마케팅 복붙" 에 최적')}
<blockquote style="font-style:italic;"></blockquote>
<blockquote style="font-style:italic;"></blockquote>
<blockquote style="font-style:italic;"></blockquote>

${sh('i-sparkles','인사이트 — 사실 vs 해석 분리')}
<table style="width:100%;">
  <tr><th style="width:50%;">사실 (고객이 한 말·행동)</th><th>해석 (내 가설)</th></tr>
  <tr><td></td><td></td></tr>
  <tr><td></td><td></td></tr>
  <tr><td></td><td></td></tr>
</table>

${sh('i-target','가설 판정','확증? 반증? 수정?')}
<ul>
  <li><b>확증된 부분:</b> </li>
  <li><b>반증된 부분:</b> </li>
  <li><b>수정/추가된 가설:</b> </li>
  <li><b>새로 발견한 문제:</b> </li>
</ul>

${sh('i-send','다음 액션')}
${CB('유사 세그먼트 __명 추가 인터뷰')}
${CB('반대 세그먼트 (이탈자 등) 인터뷰로 교차검증')}
${CB('가설 업데이트 → 링크: ')}
${CB('핵심 인용구 마케팅 팀에 공유')}
${CB('파워유저라면 고객자문위원회 섭외')}

${callout('warn','흔한 실수', '① 자기 제품에 대해 물어봄 → 예의상 칭찬만 나옴 ② 솔루션부터 제시 → 확증 편향 ③ 인터뷰 후 녹음만 저장 → 24시간 내 요약 작성해야 기억 남음.')}
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 10. 제안서 / 견적서 — Enterprise grade proposal
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-proposal', name: '제안서 · 견적서', category: '비즈니스',
    description: '표지·ROI·작업범위·일정·견적(합계자동)·결제조건·가정·법적조건까지.',
    icon: 'i-folder', is_official: true,
    body: `
<h1>${icon('i-folder',20)}제안서 — <span contenteditable="true">[프로젝트명]</span></h1>

<table style="width:100%;">
  <tr><th style="width:18%;">제안서 번호</th><td contenteditable="true">PROP-${new Date().getFullYear()}-001</td>
      <th style="width:18%;">버전</th><td>v1.0</td></tr>
  <tr><th>수신</th><td contenteditable="true">[고객사명 / 담당자]</td>
      <th>발신</th><td contenteditable="true">[당사명 / 담당자]</td></tr>
  <tr><th>제안일</th><td>${TODAY()}</td>
      <th>유효기간</th><td>제안일로부터 30일</td></tr>
  <tr><th>연락처</th><td colspan="3" contenteditable="true">전화·이메일·주소</td></tr>
</table>

<h2>Executive Summary (1페이지 요약)</h2>
${callout('tip','의사결정자가 이것만 읽어도 이해되도록', '① 문제 한 줄 ② 해결책 한 줄 ③ 총 비용 ④ 총 기간 ⑤ ROI')}
<table style="width:100%;">
  <tr><th style="width:25%;">문제</th><td></td></tr>
  <tr><th>제안하는 해결</th><td></td></tr>
  <tr><th>기대 효과 (ROI)</th><td>금액/시간/품질로 정량화</td></tr>
  <tr><th>총 비용</th><td></td></tr>
  <tr><th>총 기간</th><td></td></tr>
</table>

<h2>1. 배경 & 문제 정의</h2>
<ul>
  <li><b>현재 상태:</b> </li>
  <li><b>문제의 영향:</b> 금전/시간/고객 경험으로 정량화</li>
  <li><b>방치 시 비용:</b> 1년/3년 누적 예상 손실</li>
</ul>

<h2>2. 제안하는 솔루션</h2>
<table style="width:100%;">
  <tr><th style="width:22%;">접근 방식</th><td></td></tr>
  <tr><th>왜 이 방법인가 (차별점)</th><td></td></tr>
  <tr><th>경쟁/대안 대비 우위</th><td></td></tr>
  <tr><th>유사 성공 사례</th><td>레퍼런스·케이스스터디 링크</td></tr>
</table>

<h2>3. 작업 범위 (Scope of Work)</h2>
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:25%;">산출물</th><th style="width:30%;">세부 내역</th><th style="width:12%;">기간</th><th>인수 기준</th></tr>
  <tr><td>S1</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>S2</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>S3</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>S4</td><td></td><td></td><td></td><td></td></tr>
</table>

<h2>4. 일정 & 마일스톤</h2>
<table style="width:100%;">
  <tr><th style="width:25%;">단계</th><th style="width:20%;">기간</th><th style="width:30%;">주요 산출물</th><th>Go/No-Go</th></tr>
  <tr><td>킥오프 & 분석</td><td>1주</td><td>요구사항 확정서</td><td>고객 sign-off</td></tr>
  <tr><td>설계 & 프로토타입</td><td>2-3주</td><td>디자인·설계서</td><td>사용성 테스트</td></tr>
  <tr><td>구현 1차</td><td>4-6주</td><td>MVP</td><td>기능 리뷰</td></tr>
  <tr><td>테스트·QA</td><td>1-2주</td><td>QA 보고서</td><td>에러 임계 이하</td></tr>
  <tr><td>런칭·인수</td><td>1주</td><td>운영 가이드</td><td>운영 인수 완료</td></tr>
  <tr><td>안정화 (무상)</td><td>4주</td><td>핫픽스</td><td>-</td></tr>
</table>

<h2>5. 견적 (VAT 별도, ₩)</h2>
<table style="width:100%;">
  <tr><th style="width:40%;">항목</th><th style="width:12%;">수량</th><th style="width:18%;">단가</th><th style="width:18%;">금액</th><th>비고</th></tr>
  <tr><td>프로젝트 관리</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>디자인</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>개발 (프론트)</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>개발 (백엔드)</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>QA·테스트</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>인프라·라이선스</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>유지보수 (월)</td><td></td><td></td><td></td><td>선택</td></tr>
  <tr><th colspan="3" style="text-align:right;">소계</th><th></th><th></th></tr>
  <tr><th colspan="3" style="text-align:right;">VAT 10%</th><th></th><th></th></tr>
  <tr><th colspan="3" style="text-align:right;">합계</th><th></th><th></th></tr>
</table>

<h2>6. 결제 조건</h2>
<table style="width:100%;">
  <tr><th>단계</th><th style="width:15%;">비율</th><th style="width:20%;">금액</th><th>조건</th></tr>
  <tr><td>계약금</td><td>30%</td><td></td><td>계약 체결 5영업일 내</td></tr>
  <tr><td>중도금</td><td>40%</td><td></td><td>MVP 승인 후</td></tr>
  <tr><td>잔금</td><td>30%</td><td></td><td>최종 납품 후 7영업일 내</td></tr>
  <tr><th>합계</th><th>100%</th><th></th><th></th></tr>
</table>

<h2>7. 제외 범위 (Out of Scope)</h2>
${callout('warn','여기를 명확히 하지 않으면 범위 폭증의 원인이 됨', '별도 프로젝트로 분리되는 항목을 명시. 추후 추가 요청 시 변경 관리 절차 (CR) 로 처리.')}
<ul>
  <li></li>
  <li></li>
  <li></li>
</ul>

<h2>8. 가정 & 의존성</h2>
<table style="width:100%;">
  <tr><th style="width:50%;">가정 (Assumptions)</th><th>의존성 (고객 제공)</th></tr>
  <tr style="vertical-align:top;height:80px;"><td></td><td></td></tr>
</table>

<h2>9. 법적 조건 요약</h2>
<ul>
  <li><b>소유권:</b> 대금 완납 후 고객에게 이전</li>
  <li><b>기밀유지:</b> 상호 NDA 체결</li>
  <li><b>변경 관리:</b> 범위 외 요청은 CR 서면 합의</li>
  <li><b>지체상금:</b> 당사 귀책 지연 시 일 0.1%, 최대 10%</li>
  <li><b>관할 법원:</b> 서울중앙지방법원</li>
</ul>

<h2>10. 레퍼런스 & 팀 구성</h2>
<ul>
  <li><b>유사 프로젝트 레퍼런스:</b> </li>
  <li><b>투입 인력 프로필:</b> </li>
  <li><b>보증 수준:</b> 런칭 후 __개월 무상 A/S</li>
</ul>

${HR}
<p style="text-align:right;margin-top:30px;">
  <b>승인</b><br>
  고객사: ______________________ (서명)  날짜: ____________<br>
  당사: ______________________ (서명)  날짜: ____________
</p>
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 11. 발표 스크립트 — Narrative arc + Q&A prep
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-presentation', name: '발표 스크립트', category: '비즈니스',
    description: '청중 분석·훅·스토리 아크·슬라이드별 대본·Q&A 준비·리허설 체크.',
    icon: 'i-speaker', is_official: true,
    body: `
<h1>${icon('i-speaker',20)}발표 — <span contenteditable="true">[주제]</span></h1>

<table style="width:100%;">
  <tr><th style="width:18%;">발표일</th><td>${TODAY()}  :  ~  :</td>
      <th style="width:18%;">장소</th><td contenteditable="true">오프라인/온라인</td></tr>
  <tr><th>할당 시간</th><td contenteditable="true">(  )분 발표 + (  )분 Q&A</td>
      <th>슬라이드 수 목표</th><td>(  )장 (1분당 1장 기준)</td></tr>
</table>

${sh('i-list','청중 분석 — 누구에게 말하나')}
<table style="width:100%;">
  <tr><th style="width:25%;">청중 규모·구성</th><td contenteditable="true">인원, 직함, 연령대</td></tr>
  <tr><th>전문 지식 수준</th><td>초보/중급/전문가</td></tr>
  <tr><th>가장 관심 있는 것</th><td>시간/돈/인정/혁신/안정…</td></tr>
  <tr><th>의심하거나 반대할 것</th><td>예상 저항·이해충돌</td></tr>
  <tr><th>의사결정자</th><td>누가 결재권을 가지는가</td></tr>
</table>

${sh('i-target','핵심 메시지 (단 한 문장)','청중이 돌아가서 기억할 단 하나')}
<blockquote contenteditable="true" style="font-size:16px;font-weight:600;">
  "___ 때문에 ___ 해야 한다"
</blockquote>

${sh('i-list-ol','3가지 핵심 포인트 — 청중을 움직이려면')}
<ol>
  <li><b></b> — 왜 중요한가: </li>
  <li><b></b> — 왜 중요한가: </li>
  <li><b></b> — 왜 중요한가: </li>
</ol>

${sh('i-sparkles','오프닝 훅 — 첫 30초','무엇으로 시작할지가 결과의 절반')}
<table style="width:100%;">
  <tr><th style="width:25%;">유형</th><th>내용</th></tr>
  <tr><td>의외의 통계/사실</td><td></td></tr>
  <tr><td>청중이 관심 갖는 질문</td><td></td></tr>
  <tr><td>짧은 스토리</td><td></td></tr>
  <tr><td>도발적 주장</td><td></td></tr>
</table>

${sh('i-columns','슬라이드별 대본')}
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:22%;">슬라이드 제목</th><th>말할 핵심 (대본 한 줄)</th><th style="width:8%;">시간</th></tr>
  <tr><td>1</td><td>오프닝 훅</td><td></td><td>1분</td></tr>
  <tr><td>2</td><td>문제 제기</td><td></td><td>2분</td></tr>
  <tr><td>3</td><td>현재 상황의 대가</td><td></td><td>2분</td></tr>
  <tr><td>4</td><td>해결 방향 (아하!)</td><td></td><td>2분</td></tr>
  <tr><td>5</td><td>핵심 포인트 1</td><td></td><td>3분</td></tr>
  <tr><td>6</td><td>핵심 포인트 2</td><td></td><td>3분</td></tr>
  <tr><td>7</td><td>핵심 포인트 3</td><td></td><td>3분</td></tr>
  <tr><td>8</td><td>증거·케이스</td><td></td><td>2분</td></tr>
  <tr><td>9</td><td>실행 계획</td><td></td><td>2분</td></tr>
  <tr><td>10</td><td>행동 유도 (CTA)</td><td></td><td>1분</td></tr>
  <tr><th>합계</th><th></th><th></th><th></th></tr>
</table>

${sh('i-help','예상 Q&A — 최소 10개 준비')}
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:40%;">예상 질문</th><th>답변 핵심 키워드</th></tr>
  <tr><td>Q1</td><td>(예상되는 어려운 질문)</td><td></td></tr>
  <tr><td>Q2</td><td></td><td></td></tr>
  <tr><td>Q3</td><td></td><td></td></tr>
  <tr><td>Q4</td><td></td><td></td></tr>
  <tr><td>Q5</td><td>모를 때 답: "좋은 질문입니다. 정확히 답변드리고자 확인 후 드리겠습니다"</td><td></td></tr>
</table>

${sh('i-check','리허설 체크리스트','발표 전 반드시')}
${CB('시간 측정 — 할당 시간 ±10% 이내')}
${CB('첫 30초 완벽 암기 (떨림 방지)')}
${CB('슬라이드 전환 포인트마다 "연결 문장" 준비')}
${CB('CTA (마지막 요청) 단호하게 말하기')}
${CB('기기·어댑터·백업 점검 (PDF + USB + 클라우드)')}
${CB('물·손수건·무선 리모컨·백업 마이크')}
${CB('예상 Q&A 10개 동료와 모의 연습')}
${CB('발표 당일 30분 전 현장 도착')}

${sh('i-bell','무대 팁')}
<table style="width:100%;">
  <tr><th style="width:25%;">긴장 관리</th><td>박스 호흡 4-4-4-4 · 팔 풀기 · 물 한 모금</td></tr>
  <tr><th>아이컨택</th><td>3-5초씩 다른 사람에게 — 하지만 한 사람만 계속 응시 금지</td></tr>
  <tr><th>목소리</th><td>평소보다 <b>10% 크게</b>, 핵심 앞에 1초 pause</td></tr>
  <tr><th>침묵</th><td>당황스러우면 침묵도 OK — 3초는 청중에게 생각할 시간</td></tr>
  <tr><th>실수</th><td>"실수하셨네요" 가 아닌 "다시 말씀드리겠습니다" 로 자연스럽게</td></tr>
</table>

${callout('tip','발표 후', '24시간 내 <b>셀프 피드백</b>: 잘된 것 3개 · 개선점 1개. 녹화본 1.5배속으로 다시 보기. 아쉬운 부분만 반복 개선.')}
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 12. 여행 계획 — Comprehensive with daily itinerary
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-travel', name: '여행 계획', category: '일상',
    description: '일정·예산(합계자동)·준비물·응급연락처·추억기록까지. 공항에서 꺼내 쓰는 완결 노트.',
    icon: 'i-globe', is_official: true,
    body: `
<h1>${icon('i-globe',20)}여행 — <span contenteditable="true">[목적지]</span></h1>

<table style="width:100%;">
  <tr><th style="width:18%;">기간</th><td contenteditable="true">${TODAY()} (D-0) ~ </td>
      <th style="width:18%;">동행자</th><td contenteditable="true"></td></tr>
  <tr><th>여행 테마</th><td contenteditable="true">휴양/관광/맛집/출장</td>
      <th>예산 (1인)</th><td contenteditable="true">₩</td></tr>
  <tr><th>비자·입국</th><td contenteditable="true">무비자/전자비자/대사관</td>
      <th>여행자 보험</th><td contenteditable="true">사/가입일/증권번호</td></tr>
</table>

${sh('i-send','교통편')}
<table style="width:100%;">
  <tr><th style="width:15%;">구간</th><th style="width:15%;">편명·번호</th><th style="width:20%;">출발 → 도착</th><th style="width:15%;">예약번호</th><th>좌석·메모</th></tr>
  <tr><td>출발 (인천→)</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>현지 이동 1</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>귀국 (→인천)</td><td></td><td></td><td></td><td></td></tr>
</table>

${sh('i-folder','숙소')}
<table style="width:100%;">
  <tr><th style="width:15%;">체크인</th><th style="width:15%;">체크아웃</th><th style="width:25%;">숙소명</th><th style="width:20%;">주소·연락처</th><th>예약번호</th></tr>
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td><td></td></tr>
</table>

${sh('i-calendar','일별 일정')}
<table style="width:100%;">
  <tr><th style="width:6%;">Day</th><th style="width:10%;">날짜</th><th style="width:22%;">오전</th><th style="width:22%;">오후</th><th style="width:22%;">저녁</th><th>메모</th></tr>
  <tr><td>D1</td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td>D2</td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td>D3</td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td>D4</td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td>D5</td><td></td><td></td><td></td><td></td><td></td></tr>
</table>

${sh('i-wordcloud','예산 계획 & 실제 지출','항목별 계획/실제 자동 합계')}
<table style="width:100%;">
  <tr><th style="width:22%;">항목</th><th style="width:18%;">예산</th><th style="width:18%;">실제</th><th style="width:12%;">Δ</th><th>메모</th></tr>
  <tr><td>항공</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>숙박</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>식사 (일 1인 3만)</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>교통 (현지)</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>관광·액티비티</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>쇼핑</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>보험·비자</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>예비비 (10%)</td><td></td><td></td><td></td><td></td></tr>
  <tr><th>합계</th><th></th><th></th><th></th><th></th></tr>
</table>

${sh('i-list','짐 체크리스트')}
<table style="width:100%;">
  <tr><th>필수 서류</th><th>의류·용품</th><th>전자·기타</th></tr>
  <tr style="vertical-align:top;"><td>
    ${CB('여권 (만료 6개월 이상)')}
    ${CB('여권 복사본 (별도 보관)')}
    ${CB('비자·입국서류')}
    ${CB('항공권·숙소 예약 인쇄본')}
    ${CB('신용카드 (해외사용 활성화)')}
    ${CB('현지 통화 비상금')}
    ${CB('운전면허증·국제면허증')}
    ${CB('여행자보험 증권')}
  </td><td>
    ${CB('속옷·양말 (일수×2)')}
    ${CB('상의·하의')}
    ${CB('자켓·우비')}
    ${CB('편한 신발 (걷기용)')}
    ${CB('슬리퍼')}
    ${CB('세면도구')}
    ${CB('선크림·모자·선글라스')}
    ${CB('상비약 (감기·진통·설사)')}
  </td><td>
    ${CB('핸드폰 + 충전기')}
    ${CB('보조배터리 (항공 반입 체크)')}
    ${CB('어댑터·멀티탭')}
    ${CB('카메라·SD 카드')}
    ${CB('이어폰')}
    ${CB('유심·eSIM/로밍')}
    ${CB('작은 가방 (시내용)')}
    ${CB('지퍼백 여러 장')}
  </td></tr>
</table>

${sh('i-warning','응급 연락처 · 대사관')}
<table style="width:100%;">
  <tr><th style="width:22%;">기관·역할</th><th style="width:25%;">연락처</th><th>주소·메모</th></tr>
  <tr><td>현지 대사관·영사관</td><td></td><td></td></tr>
  <tr><td>여행자보험 (24시간)</td><td></td><td></td></tr>
  <tr><td>카드 분실 (해외사용팀)</td><td></td><td></td></tr>
  <tr><td>현지 응급전화 (경찰·119)</td><td></td><td></td></tr>
  <tr><td>호텔 프런트</td><td></td><td></td></tr>
</table>

${sh('i-quote','현지 기본 표현 (언어)')}
<table style="width:100%;">
  <tr><th style="width:25%;">상황</th><th>표현</th></tr>
  <tr><td>안녕하세요</td><td></td></tr>
  <tr><td>감사합니다</td><td></td></tr>
  <tr><td>얼마예요?</td><td></td></tr>
  <tr><td>화장실 어디?</td><td></td></tr>
  <tr><td>도와주세요</td><td></td></tr>
</table>

${sh('i-sparkles','여행 후 기억 — 돌아와서 작성')}
<table style="width:100%;">
  <tr><th style="width:22%;">최고의 순간</th><td></td></tr>
  <tr><th>의외의 발견</th><td></td></tr>
  <tr><th>다시 간다면</th><td>꼭 하고 싶은 것</td></tr>
  <tr><th>절대 안 할 것</th><td></td></tr>
  <tr><th>추천할 만한 곳</th><td></td></tr>
</table>

${callout('tip','여행 준비 체크', 'D-7: 예약 재확인 · D-3: 환전·유심 · D-1: 짐 싸기 · D-0 현지 도착 후: 호텔 주소 스크린샷, 가족에게 도착 알림.')}
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 13. OKR — Cascade + confidence + weekly checkin
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-okr', name: 'OKR 설정', category: '플래너',
    description: '분기 OKR — 상위 정렬·KR 신뢰도·주간 체크인·분기말 회고.',
    icon: 'i-target', is_official: true,
    body: `
<h1>${icon('i-target',20)}OKR — <span contenteditable="true">[팀/개인명]</span> · <span contenteditable="true">[분기]</span></h1>

<table style="width:100%;">
  <tr><th style="width:18%;">분기</th><td contenteditable="true">2026-Q2 (4-6월)</td>
      <th style="width:18%;">소유자</th><td contenteditable="true"></td></tr>
  <tr><th>상위 OKR</th><td contenteditable="true">전사/상위 부서 OKR 링크</td>
      <th>정렬 관계</th><td>직접 기여 / 간접 지원</td></tr>
  <tr><th>중간 체크인 주기</th><td>매주 금요일 15분</td>
      <th>최종 리뷰</th><td>분기 종료일 + 3일</td></tr>
</table>

${callout('info','OKR 작성 원칙', '① Objective = 정성적·영감 있는 한 문장 ② Key Result = 숫자로 측정 가능·야심찬(0.7 목표) ③ 분기 안에 완료 가능 ④ 3-5개 KR')}

${sh('i-trophy','Objective','한 분기 안에 달성할 영감 있는 목적')}
<blockquote style="font-size:15px;padding:14px;">
  <em>나쁜 예: "매출 증대"</em><br>
  <em>좋은 예: "신규 사용자가 첫 주에 제품의 가치를 체감하도록 만든다"</em>
</blockquote>
<p style="font-size:16px;padding:16px;background:color-mix(in srgb, var(--accent) 15%, var(--paper));border-radius:6px;min-height:40px;" contenteditable="true">여기에 분기 Objective 를 한 문장으로…</p>

${sh('i-wordcloud','Key Results — 측정 가능한 결과 (3-5개)')}
<table style="width:100%;">
  <tr>
    <th style="width:5%;">#</th>
    <th style="width:35%;">KR (측정 가능한 결과)</th>
    <th style="width:12%;">Baseline</th>
    <th style="width:12%;">Target</th>
    <th style="width:12%;">현재</th>
    <th style="width:12%;">달성률</th>
    <th>Confidence (1-10)</th>
  </tr>
  <tr><td>KR1</td><td></td><td></td><td></td><td></td><td>%</td><td>5</td></tr>
  <tr><td>KR2</td><td></td><td></td><td></td><td></td><td>%</td><td>5</td></tr>
  <tr><td>KR3</td><td></td><td></td><td></td><td></td><td>%</td><td>5</td></tr>
  <tr><td>KR4</td><td></td><td></td><td></td><td></td><td>%</td><td>5</td></tr>
</table>
${callout('tip','Confidence 해석', '7-10 = 순항 · 4-6 = 주의 필요 (원인 파악·조치) · 1-3 = 위험 (KR 재조정 고려). 숫자 변화가 OKR 의 진짜 신호.')}

${sh('i-rocket','이니셔티브 — KR 달성 수단','각 KR 당 2-3개, 누가·언제까지')}
<table style="width:100%;">
  <tr><th style="width:12%;">연결 KR</th><th style="width:35%;">이니셔티브</th><th style="width:15%;">담당</th><th style="width:15%;">기한</th><th>상태</th></tr>
  <tr><td>KR1</td><td></td><td></td><td></td><td>예정</td></tr>
  <tr><td>KR1</td><td></td><td></td><td></td><td>예정</td></tr>
  <tr><td>KR2</td><td></td><td></td><td></td><td>예정</td></tr>
  <tr><td>KR3</td><td></td><td></td><td></td><td>예정</td></tr>
</table>

${sh('i-warning','리스크 & 의존성')}
<table style="width:100%;">
  <tr><th style="width:45%;">리스크/의존</th><th style="width:12%;">영향 KR</th><th style="width:18%;">완화/대응</th><th>소유자</th></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td><td></td></tr>
</table>

${sh('i-redo','주간 체크인','매주 금요일 15분 · 3문 1답')}
<table style="width:100%;">
  <tr><th style="width:8%;">주차</th><th style="width:20%;">이번주 진척</th><th style="width:20%;">블로커</th><th style="width:20%;">다음주 초점</th><th>Confidence 변화</th></tr>
  <tr><td>W1</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>W2</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>W3</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>W4</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>W5</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>W6</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>W7</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>W8</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>W9</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>W10</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>W11</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>W12</td><td></td><td></td><td></td><td></td></tr>
</table>

${HR}
${sh('i-book','분기말 회고','분기 종료 후 3일 내')}
<table style="width:100%;">
  <tr><th style="width:22%;">최종 달성도</th><td contenteditable="true">KR별 % 평균</td></tr>
  <tr><th>0.7 이상 달성한 KR</th><td></td></tr>
  <tr><th>0.3 미만 실패한 KR</th><td></td></tr>
  <tr><th>가장 큰 배움 (Top 3)</th><td>
    <ol><li></li><li></li><li></li></ol>
  </td></tr>
  <tr><th>예측이 빗나간 이유</th><td>왜 과대/과소 추정했나</td></tr>
  <tr><th>다음 분기 바꿀 것</th><td></td></tr>
</table>

${callout('warn','OKR 안티패턴', '① 모든 업무를 OKR 로 → 평가 공포 ② KR 을 다 쉽게 → 의미 없음 ③ 주간 체크 안 함 → 분기 말 벼락치기 ④ OKR 을 평가와 직결 → 거짓 안전한 숫자만 제출.')}
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 14. 스프린트 회고 — Health check + Start/Stop/Continue + 5-Whys
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-sprint-retro', name: '스프린트 회고', category: '프로젝트',
    description: '팀 헬스 체크·Start/Stop/Continue·루트코즈·SMART 액션까지.',
    icon: 'i-redo', is_official: true,
    body: `
<h1>${icon('i-redo',20)}스프린트 회고 — <span contenteditable="true">[스프린트 #/이름]</span></h1>

<table style="width:100%;">
  <tr><th style="width:18%;">기간</th><td contenteditable="true"></td>
      <th style="width:18%;">스프린트 골</th><td contenteditable="true"></td></tr>
  <tr><th>참여자</th><td contenteditable="true"></td>
      <th>퍼실리테이터</th><td contenteditable="true"></td></tr>
  <tr><th>이전 회고 액션 이행률</th><td contenteditable="true">__/__ = __%</td>
      <th>소요 시간</th><td>60분</td></tr>
</table>

${sh('i-wordcloud','스프린트 결과 요약')}
<table style="width:100%;">
  <tr><th style="width:25%;">지표</th><th style="width:15%;">계획</th><th style="width:15%;">실제</th><th style="width:15%;">Δ</th><th>메모</th></tr>
  <tr><td>스토리 포인트</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>완료 티켓 수</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>캐리오버 티켓</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>에스컬레이션 건수</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>프로덕션 버그</td><td></td><td></td><td></td><td></td></tr>
</table>

${sh('i-heart','팀 헬스 체크 — 익명 투표','각 항목 🟢 좋음 / 🟡 보통 / 🔴 나쁨 개수')}
<table style="width:100%;">
  <tr><th style="width:30%;">차원</th><th style="width:12%;">🟢</th><th style="width:12%;">🟡</th><th style="width:12%;">🔴</th><th>논의 필요 여부</th></tr>
  <tr><td>스프린트 목표 명확성</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>팀 에너지·몰입</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>심리적 안전</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>학습·성장</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>의사결정 속도</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>프로세스 품질</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>코드·기술 품질</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>재미 (Fun)</td><td></td><td></td><td></td><td></td></tr>
</table>

${sh('i-plus','Start — 시작하면 좋을 것')}
<ul><li></li><li></li></ul>

${sh('i-x','Stop — 멈추는 게 나은 것')}
<ul><li></li><li></li></ul>

${sh('i-arrow-up','Continue — 계속 잘하는 것')}
<ul><li></li><li></li></ul>

${sh('i-bell','투표 — 가장 중요한 이슈 Top 3','각자 3표씩 점 찍기')}
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:60%;">이슈</th><th style="width:15%;">득표</th><th>카테고리</th></tr>
  <tr><td>I1</td><td></td><td></td><td>프로세스/도구/사람/기술</td></tr>
  <tr><td>I2</td><td></td><td></td><td></td></tr>
  <tr><td>I3</td><td></td><td></td><td></td></tr>
</table>

${sh('i-search','루트코즈 — Top 1 이슈의 5-Whys')}
<table style="width:100%;">
  <tr><th style="width:18%;">Why</th><th>답</th></tr>
  <tr><td>Why 1</td><td>처음 문제: </td></tr>
  <tr><td>Why 2</td><td>왜 Why1 이 발생했나? </td></tr>
  <tr><td>Why 3</td><td>왜 Why2 가 발생했나? </td></tr>
  <tr><td>Why 4</td><td>왜 Why3 이 발생했나? </td></tr>
  <tr><td>Why 5 (근본 원인)</td><td>시스템·프로세스·문화 차원 </td></tr>
</table>

${sh('i-send','SMART 액션 아이템','Specific · Measurable · Achievable · Relevant · Time-bound')}
<table style="width:100%;">
  <tr><th style="width:5%;">#</th><th style="width:35%;">실험 (무엇을 할지)</th><th style="width:18%;">담당</th><th style="width:15%;">기한</th><th>성공 기준</th></tr>
  <tr><td>A1</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>A2</td><td></td><td></td><td></td><td></td></tr>
  <tr><td>A3</td><td></td><td></td><td></td><td></td></tr>
</table>

${sh('i-trophy','팀 칭찬 (Kudos)','마무리 전 5분 — 분위기 리셋')}
<ul>
  <li><b>__ 님 감사합니다</b> — 왜: </li>
  <li><b>__ 님 멋있었습니다</b> — 왜: </li>
</ul>

${callout('tip','회고 진행 팁', '① 안전 환경 — 사람 아닌 시스템 비판 ② 파레토 — 한 가지 큰 이슈만 깊게 (작은 것 여러 개 X) ③ 액션 3개 이하 ④ 이전 액션 먼저 점검 ⑤ 재미를 놓치지 말 것.')}
`.trim()
  });

  // ──────────────────────────────────────────────────────────────────
  // 15. 건강 트래킹 — Comprehensive daily + weekly trends
  // ──────────────────────────────────────────────────────────────────
  T.push({
    slug: 'pro-health-tracker', name: '건강 트래킹', category: '일상',
    description: '일일 바이탈·식단·운동·수면·마음건강까지. 일주일 누적으로 패턴 발견.',
    icon: 'i-flame', is_official: true,
    body: `
<h1>${icon('i-flame',20)}건강 트래킹 — ${TODAY()}</h1>

${sh('i-sparkles','오늘의 목표')}
<table style="width:100%;">
  <tr><th style="width:25%;">가장 중요한 건강 행동</th><td contenteditable="true">운동 30분/물 2L/7시간 수면…</td></tr>
  <tr><th>이번 주 테마</th><td contenteditable="true">회복/강화/재조정</td></tr>
</table>

${sh('i-wordcloud','바이탈 사인')}
<table style="width:100%;">
  <tr>
    <th style="width:14%;">체중</th><td contenteditable="true">__ kg</td>
    <th style="width:14%;">체지방</th><td contenteditable="true">__ %</td>
    <th style="width:14%;">근육량</th><td contenteditable="true">__ kg</td>
  </tr>
  <tr>
    <th>혈압</th><td contenteditable="true">__/__</td>
    <th>공복 혈당</th><td contenteditable="true">__</td>
    <th>안정 심박</th><td contenteditable="true">__ bpm</td>
  </tr>
  <tr>
    <th>체온</th><td contenteditable="true">__ °C</td>
    <th>호흡수</th><td contenteditable="true">__ /분</td>
    <th>산소포화도</th><td contenteditable="true">__ %</td>
  </tr>
</table>

${sh('i-clock','수면 품질')}
<table style="width:100%;">
  <tr><th style="width:18%;">취침 / 기상</th><td>__:__ ~ __:__</td>
      <th style="width:18%;">총 수면</th><td>__ 시간</td></tr>
  <tr><th>깊은 수면</th><td>__ 시간 (목표 1.5-2h)</td>
      <th>REM 수면</th><td>__ 시간 (목표 1.5-2h)</td></tr>
  <tr><th>수면 품질 (1-10)</th><td></td>
      <th>밤중 깸</th><td>__ 회</td></tr>
  <tr><th>기상 컨디션</th><td colspan="3">상쾌/보통/피곤 — 원인 가설: </td></tr>
</table>

${sh('i-clipboard','식단 — 칼로리·단백질 자동 합계')}
<table style="width:100%;">
  <tr><th style="width:10%;">시간</th><th style="width:10%;">식사</th><th style="width:35%;">메뉴</th><th style="width:12%;">칼로리</th><th style="width:12%;">단백질(g)</th><th>탄수/지방·메모</th></tr>
  <tr><td></td><td>아침</td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td>간식 1</td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td>점심</td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td>간식 2</td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td>저녁</td><td></td><td></td><td></td><td></td></tr>
  <tr><td></td><td>야식</td><td></td><td></td><td></td><td></td></tr>
  <tr><th colspan="3">합계</th><th></th><th></th><th></th></tr>
</table>

${sh('i-smile','수분 — 목표 8잔 (1인 1.5-2L)')}
<p>${CB('250ml')}${CB('250ml')}${CB('250ml')}${CB('250ml')}${CB('250ml')}${CB('250ml')}${CB('250ml')}${CB('250ml')}</p>

${sh('i-sparkles','운동 — 근력 + 유산소')}
<table style="width:100%;">
  <tr><th style="width:20%;">유형</th><th style="width:25%;">종목</th><th style="width:15%;">세트×반복</th><th style="width:12%;">중량/강도</th><th style="width:10%;">시간(분)</th><th>메모</th></tr>
  <tr><td>근력</td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td>근력</td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td>근력</td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr><td>유산소</td><td></td><td></td><td>bpm</td><td></td><td></td></tr>
  <tr><td>스트레칭</td><td></td><td>-</td><td>-</td><td></td><td></td></tr>
  <tr><th colspan="4">합계 시간</th><th></th><th></th></tr>
</table>

${sh('i-heart','마음 건강')}
<table style="width:100%;">
  <tr><th style="width:25%;">기분 (1-10)</th><td></td></tr>
  <tr><th>스트레스 (1-10)</th><td></td></tr>
  <tr><th>가장 긍정적 순간</th><td></td></tr>
  <tr><th>가장 부정적 순간</th><td></td></tr>
  <tr><th>명상·호흡 (분)</th><td></td></tr>
  <tr><th>감사한 일 (한 가지)</th><td></td></tr>
</table>

${sh('i-pin','컨디션 & 통증')}
<table style="width:100%;">
  <tr><th style="width:25%;">부위</th><th style="width:15%;">강도 (0-10)</th><th>특성·유발요인</th></tr>
  <tr><td></td><td></td><td></td></tr>
  <tr><td></td><td></td><td></td></tr>
</table>

${sh('i-sparkles','보충제·약')}
${CB('비타민 D 2000IU')}
${CB('오메가 3 1g')}
${CB('마그네슘 400mg')}
${CB('프로바이오틱스')}
${CB('개인 처방약: __')}

${sh('i-target','오늘의 점수 & 내일 목표')}
<table style="width:100%;">
  <tr><th style="width:25%;">오늘 총 점수 (1-10)</th><td contenteditable="true">각 섹션 평균</td></tr>
  <tr><th>가장 잘한 것</th><td></td></tr>
  <tr><th>내일 개선할 것</th><td></td></tr>
  <tr><th>한 가지 실험</th><td>예: 카페인 12시 전만</td></tr>
</table>

${callout('tip','7일 누적 보기', '매일 숫자만 기록하고 일주일 뒤 <b>기분·에너지·수면</b> 셀을 색으로 훑어보면 패턴이 보인다. 좋은 날/나쁜 날의 공통 요인을 발견.')}
`.trim()
  });

  // ---- 외부 공개 ----
  window.JAN_BUILTIN_TEMPLATES = T;
  window.JAN_BUILTIN_TEMPLATE_MAP = Object.fromEntries(T.map(t => [t.slug, t]));
  window.JAN_TEMPLATE_TILE_ICON = tileIcon;
  console.info('[JAN Pro Templates v2] ' + T.length + '개 로드 — 전면 업그레이드 적용');
})();
