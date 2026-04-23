/* paper-template-data.js — generated from paper-template.html
 * 완성된 Science 포맷 물리학 논문 3페이지 샘플.
 * window.JANPaperTemplate.physicsScience 에 HTML 문자열로 저장.
 */
(function () {
  window.JANPaperTemplate = window.JANPaperTemplate || {};
  window.JANPaperTemplate.physicsScience = `<!--
  JustANotepad — Science 포맷 물리학 논문 템플릿
  ================================================================
  단일 HTML 블록 + inline <style>. templates-pro.js 의 한 템플릿으로
  import 되어 app.html 안에서 contenteditable 영역에 주입된다.

  포함 기능:
    - A4 페이지 시뮬레이션 (210 × 297 mm), 페이지 간 20px 회색 갭
    - 각 페이지 상단 running title + 하단 페이지 번호 + DOI
    - 2-단 레이아웃 (.jan-two-col) — 초록 이후 본문
    - 수식 번호 CSS counter (1), (2), (3) ...
    - 그림 / 표 번호 자동 (Figure 1., Table 1. …)
    - 섹션 번호 자동 (1., 1.1., 2., 2.1. …)
    - 각주 · 미주 · IEEE 참고문헌
    - 목차 (TOC) — 첫 페이지
    - Acknowledgments 박스
    - @media print 로 인쇄 시 한 장씩 분리
    - data-latex 속성 = 앱의 KaTeX 렌더러가 자동 처리

  저자: Park et al. — 광격자 속 SOC-BEC 비등방 초유체 수송
  (내용은 /memo/paper-draft.md 에서 그대로 이식됨)
-->

<style>
/* ============================================================
   [SECTION A] 전역 토큰 · 루트 카운터
   ============================================================ */
.jan-paper {
  /* 색상 · 타이포 토큰 — 앱의 전역 --ink / --paper 와 공존 */
  --pap-ink:           var(--ink, #111);
  --pap-bg-page:       #ffffff;
  --pap-bg-gutter:     #e9ecef;
  --pap-border:        #d0d4d9;
  --pap-border-soft:   #e0e3e7;
  --pap-accent:        #1a4b8c;
  --pap-muted:         #667080;
  --pap-abstract-bg:   #f7f8fa;
  --pap-caption:       #4a5260;
  --pap-cite-link:     #1a4b8c;

  /* 타이포 스케일 (print-first) */
  --pap-font-serif:    "Times New Roman", "Nanum Myeongjo", "Batang", serif;
  --pap-font-sans:     -apple-system, "Segoe UI", "Helvetica Neue", "Nanum Gothic", sans-serif;
  --pap-font-mono:     "JetBrains Mono", "Consolas", "D2Coding", monospace;

  /* 페이지 기하 */
  --pap-page-w:        210mm;
  --pap-page-h:        297mm;
  --pap-margin-top:    22mm;
  --pap-margin-bottom: 22mm;
  --pap-margin-side:   18mm;

  counter-reset: pap-page pap-sec pap-eq pap-fig pap-tbl pap-fn pap-en pap-ref;

  font-family: var(--pap-font-serif);
  font-size: 10.5pt;
  line-height: 1.45;
  color: var(--pap-ink);
  /* 화면 상 배경 */
  background: var(--pap-bg-gutter);
  padding: 16px 0 32px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

/* 다크 모드 대응 — 앱이 dark 일 때도 논문은 종이처럼 */
[data-theme="dark"] .jan-paper {
  --pap-bg-gutter:     #111418;
  --pap-bg-page:       #f8f8f5;
  --pap-ink:           #111;
}

/* ============================================================
   [SECTION B] 페이지 컨테이너
   ============================================================ */
.jan-page {
  counter-increment: pap-page;
  position: relative;
  width: var(--pap-page-w);
  min-height: var(--pap-page-h);
  max-width: 100%;
  background: var(--pap-bg-page);
  color: var(--pap-ink);
  box-shadow:
    0 1px 2px rgba(0,0,0,0.08),
    0 4px 16px rgba(0,0,0,0.12);
  padding: var(--pap-margin-top) var(--pap-margin-side) var(--pap-margin-bottom);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  page-break-after: always;
  break-after: page;
  overflow: hidden;
}

.jan-page:last-child {
  page-break-after: auto;
  break-after: auto;
}

/* 페이지 상단 러닝 헤더 */
.jan-header {
  position: absolute;
  top: 8mm;
  left: var(--pap-margin-side);
  right: var(--pap-margin-side);
  font-family: var(--pap-font-sans);
  font-size: 8pt;
  letter-spacing: 0.02em;
  color: var(--pap-muted);
  border-bottom: 0.3pt solid var(--pap-border-soft);
  padding-bottom: 3mm;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  text-transform: none;
}

.jan-header span {
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.jan-header .jan-hleft  { max-width: 60%; font-style: italic; }
.jan-header .jan-hright { color: var(--pap-accent); font-weight: 600; }

/* 페이지 하단 푸터 */
.jan-footer {
  position: absolute;
  bottom: 8mm;
  left: var(--pap-margin-side);
  right: var(--pap-margin-side);
  font-family: var(--pap-font-sans);
  font-size: 8pt;
  color: var(--pap-muted);
  border-top: 0.3pt solid var(--pap-border-soft);
  padding-top: 3mm;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.jan-footer .jan-pgnum::before {
  content: "Page " counter(pap-page);
}

.jan-footer .jan-pgnum::after {
  content: " of 3";
}

.jan-footer .jan-doi {
  font-family: var(--pap-font-mono);
  font-size: 7.5pt;
  letter-spacing: 0.02em;
}

/* ============================================================
   [SECTION C] 제목 · 저자 · 소속 (첫 페이지 전폭)
   ============================================================ */
.jan-title {
  font-family: var(--pap-font-serif);
  font-size: 22pt;
  font-weight: 700;
  text-align: center;
  color: var(--pap-ink);
  margin: 4mm 0 2mm;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.jan-title-en {
  font-family: var(--pap-font-serif);
  font-size: 13pt;
  font-style: italic;
  font-weight: 500;
  text-align: center;
  color: var(--pap-muted);
  margin: 0 0 8mm;
  line-height: 1.35;
}

.jan-authors {
  font-family: var(--pap-font-serif);
  font-size: 12pt;
  font-style: italic;
  text-align: center;
  margin: 0 0 2mm;
  line-height: 1.4;
}

.jan-authors sup {
  font-size: 8pt;
  font-style: normal;
  color: var(--pap-accent);
  padding: 0 1px;
}

.jan-affil {
  font-family: var(--pap-font-sans);
  font-size: 9pt;
  text-align: center;
  color: var(--pap-muted);
  margin: 0 0 1mm;
  line-height: 1.35;
}

.jan-affil sup {
  color: var(--pap-accent);
  font-weight: 600;
  margin-right: 2px;
}

.jan-corresp {
  font-family: var(--pap-font-sans);
  font-size: 9pt;
  text-align: center;
  color: var(--pap-muted);
  margin: 2mm 0 6mm;
}

.jan-corresp code {
  font-family: var(--pap-font-mono);
  background: var(--pap-abstract-bg);
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 8.5pt;
}

/* ============================================================
   [SECTION D] Abstract
   ============================================================ */
.jan-abstract {
  background: var(--pap-abstract-bg);
  border: 0.5pt solid var(--pap-border);
  border-left: 2pt solid var(--pap-accent);
  padding: 5mm 6mm;
  margin: 0 0 6mm;
  font-size: 9.5pt;
  line-height: 1.55;
  text-align: justify;
  hyphens: auto;
  border-radius: 1px;
}

.jan-abstract::before {
  content: "Abstract.";
  font-weight: 700;
  margin-right: 4pt;
  color: var(--pap-accent);
  font-family: var(--pap-font-sans);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  font-size: 9pt;
}

.jan-abstract .jan-keywords {
  display: block;
  margin-top: 3mm;
  font-size: 8.5pt;
  color: var(--pap-muted);
  font-family: var(--pap-font-sans);
}

.jan-abstract .jan-keywords strong {
  color: var(--pap-ink);
  margin-right: 4pt;
}

/* ============================================================
   [SECTION E] 목차 (TOC)
   ============================================================ */
.jan-toc {
  background: transparent;
  border: 0.5pt solid var(--pap-border-soft);
  padding: 4mm 6mm 3mm;
  margin: 0 0 5mm;
  font-family: var(--pap-font-sans);
  font-size: 9pt;
  line-height: 1.45;
  column-count: 2;
  column-gap: 8mm;
  column-fill: balance;
}

.jan-toc h3 {
  column-span: all;
  font-family: var(--pap-font-sans);
  font-size: 10pt;
  font-weight: 700;
  margin: 0 0 2mm;
  padding-bottom: 1mm;
  border-bottom: 0.3pt solid var(--pap-border-soft);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--pap-accent);
}

.jan-toc ol {
  list-style: none;
  padding: 0;
  margin: 0;
  counter-reset: toc-item;
}

.jan-toc ol li {
  counter-increment: toc-item;
  margin: 0.4mm 0;
  break-inside: avoid;
}

.jan-toc ol li a {
  color: var(--pap-ink);
  text-decoration: none;
  display: flex;
  justify-content: space-between;
  gap: 2mm;
}

.jan-toc ol li a:hover {
  color: var(--pap-accent);
  text-decoration: underline;
}

.jan-toc ol li .jan-toc-page {
  color: var(--pap-muted);
  font-variant-numeric: tabular-nums;
}

/* ============================================================
   [SECTION F] 본문 (2단 레이아웃)
   ============================================================ */
.jan-two-col {
  column-count: 2;
  column-gap: 7mm;
  column-rule: none;
  flex: 1;
  text-align: justify;
  hyphens: auto;
  orphans: 3;
  widows: 3;
  margin-top: 2mm;
}

.jan-two-col p {
  margin: 0 0 2mm;
  text-indent: 4mm;
  font-size: 10pt;
  line-height: 1.5;
}

.jan-two-col p:first-of-type,
.jan-two-col h2 + p,
.jan-two-col h3 + p,
.jan-two-col figure + p {
  text-indent: 0;
}

/* 2단 내 제목 — H2 = 섹션, H3 = 서브섹션 */
.jan-two-col h2 {
  counter-increment: pap-sec;
  counter-reset: pap-subsec;
  font-family: var(--pap-font-sans);
  font-size: 11pt;
  font-weight: 700;
  color: var(--pap-ink);
  margin: 4mm 0 2mm;
  line-height: 1.3;
  break-after: avoid-column;
  page-break-after: avoid;
}

.jan-two-col h2::before {
  content: counter(pap-sec) ". ";
  color: var(--pap-accent);
  margin-right: 2pt;
}

.jan-two-col h3 {
  counter-increment: pap-subsec;
  font-family: var(--pap-font-sans);
  font-size: 10pt;
  font-weight: 600;
  color: var(--pap-ink);
  margin: 3mm 0 1.5mm;
  font-style: italic;
  line-height: 1.3;
  break-after: avoid-column;
  page-break-after: avoid;
}

.jan-two-col h3::before {
  content: counter(pap-sec) "." counter(pap-subsec) ". ";
  color: var(--pap-accent);
  font-style: normal;
  margin-right: 2pt;
}

.jan-two-col h4 {
  font-family: var(--pap-font-sans);
  font-size: 9.5pt;
  font-weight: 600;
  margin: 2mm 0 1mm;
  color: var(--pap-ink);
  font-style: italic;
}

/* 첫 H2 는 상단 여백 축소 */
.jan-two-col > h2:first-child {
  margin-top: 0;
}

/* 본문 강조 */
.jan-two-col strong {
  font-weight: 700;
  color: var(--pap-ink);
}

.jan-two-col em {
  font-style: italic;
}

.jan-two-col code {
  font-family: var(--pap-font-mono);
  font-size: 9pt;
  background: var(--pap-abstract-bg);
  padding: 0 3px;
  border-radius: 2px;
}

/* ============================================================
   [SECTION G] 수식 (KaTeX 자동 렌더 자리)
   ============================================================ */
.jan-paper figure.jan-math {
  counter-increment: pap-eq;
}
figure.jan-math {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4mm;
  margin: 3mm 0;
  padding: 1mm 0;
  break-inside: avoid;
  page-break-inside: avoid;
  font-family: var(--pap-font-serif);
  font-size: 10pt;
  column-span: all;   /* 수식은 전폭 블록 */
}

figure.jan-math .jan-eq-body {
  flex: 1 1 auto;
  text-align: center;
  font-style: italic;
  min-height: 6mm;
  line-height: 1.4;
  padding: 0 6mm;
  /* KaTeX 렌더링된 노드가 여기 들어감. placeholder 상태에서는 data-latex 의 원본 노출 */
}

/* 앱의 KaTeX 렌더러가 동작 안 할 때의 fallback 표시 */
figure.jan-math[data-latex]:not(.jan-rendered) .jan-eq-body {
  font-family: var(--pap-font-mono);
  font-size: 8.5pt;
  color: var(--pap-muted);
  background: var(--pap-abstract-bg);
  border: 0.3pt dashed var(--pap-border);
  padding: 2mm 4mm;
  border-radius: 2px;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
}

.jan-paper figure.jan-math::after {
  content: "(" counter(pap-eq) ")";
  font-family: var(--pap-font-serif);
  font-size: 10pt;
  min-width: 10mm;
  text-align: right;
  color: var(--pap-ink);
  font-weight: 500;
}

/* 인라인 수식 참조 링크 */
.eq-ref {
  color: var(--pap-cite-link);
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}
.eq-ref:hover { text-decoration: underline; }

/* ============================================================
   [SECTION H] 그림 / 표
   ============================================================ */
.jan-paper figure.jan-fig {
  counter-increment: pap-fig;
}
figure.jan-fig {
  margin: 3mm 0;
  padding: 0;
  break-inside: avoid;
  page-break-inside: avoid;
  column-span: all;   /* 넓은 그림은 전폭 */
  text-align: center;
}

figure.jan-fig.jan-col {
  column-span: none;  /* 한 단 크기 그림 */
}

figure.jan-fig .jan-fig-placeholder {
  border: 0.5pt dashed var(--pap-border);
  background: var(--pap-abstract-bg);
  min-height: 38mm;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pap-muted);
  font-family: var(--pap-font-sans);
  font-size: 9pt;
  font-style: italic;
  padding: 6mm 8mm;
  border-radius: 2px;
  line-height: 1.5;
  text-align: center;
}

figure.jan-fig img,
figure.jan-fig svg {
  max-width: 100%;
  height: auto;
  border: 0.3pt solid var(--pap-border-soft);
  border-radius: 2px;
  background: #fff;
}

figure.jan-fig figcaption {
  font-family: var(--pap-font-sans);
  font-size: 8.5pt;
  color: var(--pap-caption);
  text-align: left;
  margin-top: 2mm;
  padding: 0 2mm;
  line-height: 1.45;
}

.jan-paper figure.jan-fig figcaption::before {
  content: "Figure " counter(pap-fig) ". ";
  font-weight: 700;
  color: var(--pap-ink);
}

/* 표 */
.jan-paper figure.jan-tbl {
  counter-increment: pap-tbl;
}
figure.jan-tbl {
  margin: 3mm 0;
  break-inside: avoid;
  page-break-inside: avoid;
  column-span: all;
}

figure.jan-tbl table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--pap-font-sans);
  font-size: 8.5pt;
  line-height: 1.4;
}

figure.jan-tbl table thead {
  border-top: 0.6pt solid var(--pap-ink);
  border-bottom: 0.4pt solid var(--pap-ink);
  background: var(--pap-abstract-bg);
}

figure.jan-tbl table tbody {
  border-bottom: 0.6pt solid var(--pap-ink);
}

figure.jan-tbl table th,
figure.jan-tbl table td {
  padding: 1.2mm 2mm;
  text-align: center;
  vertical-align: middle;
  border: none;
}

figure.jan-tbl table th {
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--pap-ink);
}

figure.jan-tbl table tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--pap-abstract-bg) 50%, white);
}

figure.jan-tbl table td:first-child,
figure.jan-tbl table th:first-child {
  text-align: left;
  font-variant-numeric: tabular-nums;
}

figure.jan-tbl figcaption {
  font-family: var(--pap-font-sans);
  font-size: 8.5pt;
  color: var(--pap-caption);
  text-align: left;
  margin-top: 2mm;
  padding: 0 1mm;
  line-height: 1.45;
}

.jan-paper figure.jan-tbl figcaption::before {
  content: "Table " counter(pap-tbl) ". ";
  font-weight: 700;
  color: var(--pap-ink);
}

/* 그림·표 참조 */
.fig-ref, .tbl-ref {
  color: var(--pap-cite-link);
  text-decoration: none;
}
.fig-ref:hover, .tbl-ref:hover { text-decoration: underline; }

/* ============================================================
   [SECTION I] 각주 (footnotes)
   ============================================================ */
sup.jan-fn-mark {
  font-size: 7pt;
  line-height: 0;
  vertical-align: super;
}

sup.jan-fn-mark a,
a.fn-ref {
  color: var(--pap-accent);
  text-decoration: none;
  font-weight: 600;
}

sup.jan-fn-mark a:hover,
a.fn-ref:hover {
  text-decoration: underline;
}

.jan-footnotes {
  column-span: all;
  margin-top: auto;   /* flex container 에서 페이지 하단으로 밀기 */
  padding-top: 3mm;
  border-top: 0.3pt solid var(--pap-border);
  font-family: var(--pap-font-serif);
  font-size: 8.5pt;
  line-height: 1.45;
  color: var(--pap-ink);
}

.jan-footnotes::before {
  content: "Notes";
  display: block;
  font-family: var(--pap-font-sans);
  font-size: 7.5pt;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--pap-muted);
  margin-bottom: 1.5mm;
  font-weight: 600;
}

.jan-footnotes ol {
  list-style: none;
  padding: 0;
  margin: 0;
  counter-reset: pap-fnli;
}

.jan-footnotes ol li {
  counter-increment: pap-fnli;
  margin: 0 0 1mm;
  padding-left: 5mm;
  position: relative;
  text-align: justify;
}

.jan-footnotes ol li::before {
  content: counter(pap-fnli);
  position: absolute;
  left: 0;
  top: 0;
  font-size: 7pt;
  vertical-align: super;
  color: var(--pap-accent);
  font-weight: 700;
  font-family: var(--pap-font-sans);
}

.jan-footnotes ol li a.jan-backref {
  color: var(--pap-muted);
  text-decoration: none;
  margin-left: 4pt;
  font-size: 9pt;
}

.jan-footnotes ol li a.jan-backref:hover {
  color: var(--pap-accent);
}

/* ============================================================
   [SECTION J] 미주 (endnotes)
   ============================================================ */
.jan-endnotes {
  column-span: all;
  margin: 4mm 0;
  padding: 3mm 0;
  border-top: 0.3pt solid var(--pap-border-soft);
  font-family: var(--pap-font-serif);
  font-size: 9pt;
  line-height: 1.45;
}

.jan-endnotes h2 {
  font-family: var(--pap-font-sans);
  font-size: 10pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--pap-accent);
  margin: 0 0 2mm;
}

.jan-endnotes ol {
  list-style: none;
  padding: 0;
  margin: 0;
  counter-reset: pap-enli;
}

.jan-endnotes ol li {
  counter-increment: pap-enli;
  margin: 0 0 1.5mm;
  padding-left: 8mm;
  position: relative;
  text-align: justify;
}

/* 로마 숫자 i, ii, iii, iv ... */
.jan-endnotes ol li::before {
  content: counter(pap-enli, lower-roman) ".";
  position: absolute;
  left: 0;
  top: 0;
  width: 7mm;
  text-align: right;
  color: var(--pap-accent);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

a.en-ref {
  color: var(--pap-accent);
  text-decoration: none;
  font-weight: 600;
  font-size: 7.5pt;
  vertical-align: super;
}

a.en-ref:hover { text-decoration: underline; }

/* ============================================================
   [SECTION K] 참고문헌 (IEEE)
   ============================================================ */
.jan-bibliography {
  column-span: all;
  margin: 4mm 0;
  padding: 0;
  font-family: var(--pap-font-serif);
  font-size: 9pt;
  line-height: 1.45;
}

.jan-bibliography h2 {
  font-family: var(--pap-font-sans);
  font-size: 11pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--pap-accent);
  margin: 0 0 3mm;
  padding-bottom: 1mm;
  border-bottom: 0.3pt solid var(--pap-border);
}

.jan-bibliography ol {
  list-style: none;
  padding: 0;
  margin: 0;
  counter-reset: pap-bib;
}

.jan-bibliography ol li {
  counter-increment: pap-bib;
  margin: 0 0 1.5mm;
  padding-left: 9mm;
  position: relative;
  text-align: justify;
  hyphens: auto;
  break-inside: avoid;
}

.jan-bibliography ol li::before {
  content: "[" counter(pap-bib) "]";
  position: absolute;
  left: 0;
  top: 0;
  width: 7mm;
  text-align: left;
  font-weight: 600;
  color: var(--pap-ink);
  font-variant-numeric: tabular-nums;
}

.jan-bibliography ol li em {
  font-style: italic;
  color: var(--pap-ink);
}

/* 본문 인용 [1], [2,3], [1-3] */
a.cite {
  color: var(--pap-cite-link);
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}

a.cite:hover {
  text-decoration: underline;
}

/* ============================================================
   [SECTION L] Acknowledgments
   ============================================================ */
.jan-ack {
  column-span: all;
  margin: 3mm 0 4mm;
  padding: 3mm 4mm;
  background: var(--pap-abstract-bg);
  border-left: 2pt solid var(--pap-muted);
  font-family: var(--pap-font-serif);
  font-size: 8.5pt;
  line-height: 1.5;
  color: var(--pap-ink);
  border-radius: 1px;
  text-align: justify;
}

.jan-ack h2 {
  font-family: var(--pap-font-sans);
  font-size: 9.5pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--pap-muted);
  margin: 0 0 1.5mm;
}

/* ============================================================
   [SECTION M] 인쇄 규칙
   ============================================================ */
@page {
  size: A4;
  margin: 0;
}

@media print {
  html, body {
    background: #fff !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .jan-paper {
    background: #fff;
    padding: 0;
    gap: 0;
    display: block;
  }

  .jan-paper .jan-page {
    width: 210mm;
    height: 297mm;
    min-height: 297mm;
    max-height: 297mm;
    box-shadow: none;
    margin: 0;
    padding: var(--pap-margin-top) var(--pap-margin-side) var(--pap-margin-bottom);
    page-break-after: always !important;
    break-after: page !important;
    page-break-inside: avoid;
    break-inside: avoid-page;
    overflow: hidden;
  }

  .jan-paper .jan-page:last-child {
    page-break-after: auto !important;
    break-after: auto !important;
  }

  /* 헤더·푸터는 각 .jan-page 내부에 이미 absolute 로 자리잡고 있어 그대로 인쇄됨 */
  .jan-paper .jan-header,
  .jan-paper .jan-footer {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* 화면에서 보인 둥근 모서리 / 그림자 모두 제거 */
  .jan-abstract,
  .jan-ack,
  figure.jan-math[data-latex]:not(.jan-rendered) .jan-eq-body {
    background: #fafafa !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
}

/* ============================================================
   [SECTION N] 반응형 (화면 폭이 좁을 때 — 앱 편집 중)
   ============================================================ */
@media (max-width: 820px) {
  .jan-paper {
    padding: 8px 0 16px;
    gap: 10px;
  }
  .jan-page {
    width: 100%;
    min-height: auto;
    padding: 18mm 10mm 22mm;
  }
  .jan-two-col {
    column-count: 1;
  }
  .jan-toc {
    column-count: 1;
  }
  .jan-title    { font-size: 18pt; }
  .jan-title-en { font-size: 11pt; }
}
</style>

<div class="jan-paper" spellcheck="false">

  <!-- ============================================================
       PAGE 1 — Title, Authors, Abstract, TOC, Introduction start
       ============================================================ -->
  <section class="jan-page" id="page-1">
    <div class="jan-header">
      <span class="jan-hleft">Topological Anisotropic Superfluid Transport · Park et al.</span>
      <span class="jan-hright">SCIENCE (Submitted)</span>
    </div>

    <!-- 제목 -->
    <h1 class="jan-title" contenteditable="true">
      광격자 속 스핀-궤도 결합 보스-아인슈타인 응축에서의 위상 비등방 초유체 수송
    </h1>
    <p class="jan-title-en" contenteditable="true">
      Topological Anisotropic Superfluid Transport in Spin–Orbit-Coupled Bose–Einstein Condensates within Optical Lattices
    </p>

    <!-- 저자 -->
    <p class="jan-authors" contenteditable="true">
      Ji-won Park<sup>1</sup>, Minho Seo<sup>1,2</sup>, Anya Kovalenko<sup>2</sup>
    </p>

    <!-- 소속 -->
    <p class="jan-affil" contenteditable="true">
      <sup>1</sup>한국과학기술원 (KAIST) 물리학과, 대전 34141, 대한민국
    </p>
    <p class="jan-affil" contenteditable="true">
      <sup>2</sup>Institute for Quantum Matter, ETH Zürich, Otto-Stern-Weg 1, 8093 Zürich, Switzerland
    </p>

    <p class="jan-corresp">
      Corresponding author: <code>jw.park@kaist.ac.kr</code>
    </p>

    <!-- Abstract -->
    <div class="jan-abstract" contenteditable="true">
      우리는 2차원 정사각 광격자에 가두어진 <sup>87</sup>Rb 보스-아인슈타인 응축 (BEC) 에서 합성 스핀-궤도 결합 (SOC) 을 유도하고, 격자 깊이 <em>V</em><sub>0</sub> 와 라만 결합 강도 <em>Ω<sub>R</sub></em> 을 독립적으로 조절하며 비등방 초유체 수송을 측정하였다. Bragg 분광법과 흐름-유도 이완(flow-induced relaxation) 을 결합하여 두 주축 방향 임계 속도 <em>v<sub>c</sub><sup>x</sup></em>, <em>v<sub>c</sub><sup>y</sup></em> 가 <em>Ω<sub>R</sub> / E<sub>R</sub></em> ≥ 0.85 영역에서 10배 이상 차이나는 것을 관측했다. 이 비등방성은 단순한 유효질량 텐서 예측을 넘어서며, 원시 밴드에 존재하는 비자명한 Berry 곡률이 초유체 탄성 응답에 직접 기여함을 시사한다. Bogoliubov–de Gennes 수치 계산과 상관지어 본 결과, 관측된 위상 지표 <em>𝒞</em> = 0.97 ± 0.04 는 이론값 <em>𝒞</em> = 1 과 일치하며, 합성 자기장 하에서 SOC-BEC가 약-결합 위상 초유체의 플랫폼이 될 수 있음을 보인다. 본 결과는 중성 원자 시스템에서 chiral edge-phonon 이 검출 가능한 범위에 있음을 의미한다.
      <span class="jan-keywords">
        <strong>Keywords:</strong> Bose–Einstein condensate, spin–orbit coupling, optical lattice, Berry curvature, superfluid transport, topological matter.
      </span>
    </div>

    <!-- Table of Contents -->
    <nav class="jan-toc" aria-label="Contents">
      <h3>Contents</h3>
      <ol>
        <li><a href="#sec-intro">1. Introduction <span class="jan-toc-page">p.1</span></a></li>
        <li><a href="#sec-methods">2. Methods / Theory <span class="jan-toc-page">p.1–2</span></a></li>
        <li><a href="#sec-results">3. Results <span class="jan-toc-page">p.2</span></a></li>
        <li><a href="#sec-discuss">4. Discussion <span class="jan-toc-page">p.2–3</span></a></li>
        <li><a href="#sec-conclusion">5. Conclusion <span class="jan-toc-page">p.3</span></a></li>
        <li><a href="#sec-ack">Acknowledgments <span class="jan-toc-page">p.3</span></a></li>
        <li><a href="#sec-refs">References <span class="jan-toc-page">p.3</span></a></li>
      </ol>
    </nav>

    <!-- Body starts (2-col) -->
    <div class="jan-two-col" contenteditable="true">

      <h2 id="sec-intro">Introduction</h2>
      <p>
        냉원자 광격자 (optical lattice) 는 응집물질에서 볼 수 있는 강상관 현상을 깨끗하게 구현하기 위한 표준 플랫폼으로 자리잡았다 <a class="cite" href="#ref-1">[1]</a>, <a class="cite" href="#ref-2">[2]</a>. 특히 Raman 결합을 이용한 합성 스핀-궤도 결합 (SOC) 의 실현 이후 <a class="cite" href="#ref-3">[3]</a>, 중성 원자 초유체에서 비자명한 밴드 위상이 관측되었고 <a class="cite" href="#ref-4">[4]</a>, <a class="cite" href="#ref-5">[5]</a>, 이는 반도체 위상 절연체와의 연결을 제공한다. 그러나 <strong>초유체 수송</strong> 자체가 밴드 위상에 어떻게 지문을 남기는지는 이론과 실험 모두에서 여전히 미해결 영역이다<sup class="jan-fn-mark"><a class="fn-ref" id="fnref1" href="#fn1">1</a></sup>.
      </p>
      <p>
        대부분의 기존 실험은 정적 흡수 이미징으로 밀도 분포만 측정하거나 <a class="cite" href="#ref-6">[6]</a>, 시간역전 대칭이 보존된 등방 격자에 국한되었다. 본 연구는 이를 넘어 <strong>비등방 임계속도</strong>를 두 주축 각각에서 독립 측정함으로써 Berry 곡률이 초유체 강직성(superfluid stiffness) 텐서에 주는 <strong>방향별</strong> 기여를 분리한다. 이 측정량은 선형 반응 이론에서 다음과 같이 표현된다:
      </p>

      <figure class="jan-math" id="eq1"
        data-latex="\\rho_{s,\\,ij} = \\rho_0 \\, \\delta_{ij} - \\hbar \\int_{\\mathrm{BZ}} \\frac{d^2 k}{(2\\pi)^2} \\, n_k \\, \\partial_{k_i} \\partial_{k_j} \\epsilon_k + \\alpha \\, \\Omega_R^2 \\, \\Omega_{ij}(k_{\\min})">
        <span class="jan-eq-body">ρ_{s,ij} = ρ₀ δ_{ij} − ℏ ∫_{BZ} (d²k)/(2π)² n_k ∂_{k_i}∂_{k_j} ε_k + α Ω_R² Ω_{ij}(k_min)</span>
      </figure>

      <p>
        여기서 <em>Ω<sub>ij</sub>(k)</em> 는 Berry 곡률 텐서이고, <em>k</em><sub>min</sub> 은 드레스드(dressed) 밴드 최저점, <em>α</em> 는 우리 측정에서 얻는 비자명 계수이다. 식 <a class="eq-ref" href="#eq1">Eq. (1)</a> 의 세 번째 항이 본 논문의 핵심 실험 대상이다.
      </p>
      <p>
        본 결과는 기존 유효질량 텐서만으로 수송을 기술하는 근사 <a class="cite" href="#ref-7">[7]</a> 가 <em>Ω<sub>R</sub></em> / <em>E<sub>R</sub></em> ≳ 1 영역에서 실패함을 정량적으로 보이고, Berry-보정 Gross–Pitaevskii 기술 (GP+Berry) 이 실험과 4% 이내로 일치함을 제시한다. 후속 섹션에서는 측정 프로토콜(2절), 결과(3절), 그리고 유효질량 근사의 한계와 엣지 포논 예측을 포함한 해석(4절)을 제시한다.
      </p>

      <h2 id="sec-methods">Methods / Theory</h2>

      <h3>실험 셋업</h3>
      <p>
        우리는 <sup>87</sup>Rb BEC (원자 수 <em>N</em> ≈ 2.4 × 10<sup>5</sup>, 응축 분율 &gt; 92%) 를 생성한 후, 세 쌍의 교차 Gaussian 빔 (파장 <em>λ<sub>L</sub></em> = 1064 nm) 으로 2D 정사각 광격자를 부과한다. SOC는 <em>λ<sub>R</sub></em> = 790 nm 의 Raman 한쌍을 사용해 |<em>F</em>=1, <em>m<sub>F</sub></em>=0⟩ ↔ |<em>F</em>=1, <em>m<sub>F</sub></em>=−1⟩ 전이로 유도했다. 반동 에너지는 <em>E<sub>R</sub></em> = ℏ<sup>2</sup><em>k<sub>L</sub></em><sup>2</sup>/2<em>m</em> = <em>h</em> × 2.03 kHz 이다. <a class="fig-ref" href="#fig1">Fig. 1</a> 에 전체 셋업 개념도를 나타냈다.
      </p>

      <figure class="jan-fig" id="fig1">
        <div class="jan-fig-placeholder">
          [그림 1 자리 — 실험 셋업 개념도. 교차 격자빔 (빨강), Raman 쌍 (파랑), 흡수 이미징 축 (회색 점선). 삽입: Bragg 분광용 probe 펄스 타이밍.]
        </div>
        <figcaption>실험 셋업 개념도. 2D 정사각 광격자 (1064 nm) 위에 Raman 한 쌍 (790 nm) 이 <em>x</em>̂ 방향 합성 게이지 퍼텐셜을 부과한다. 이미징 축은 중력 방향 (<em>z</em>̂) 으로 시간-of-flight 18 ms 후 흡수 이미징이 이루어진다. 삽입된 펄스 시퀀스는 격자 램프 종료 후 2 ms 의 holding, 300 μs Bragg 펄스, 18 ms 팽창 순서로 구성된다.</figcaption>
      </figure>

    </div>

    <!-- 페이지 1 각주 -->
    <div class="jan-footnotes">
      <ol>
        <li id="fn1">
          정적 밀도 측정은 밴드 점유율에만 의존하며, 강직성 텐서의 Berry 보정 항에 직접 접근할 수 없다. 동적 수송 측정이 필수적이다.
          <a class="jan-backref" href="#fnref1" title="본문으로 돌아가기">↩</a>
        </li>
      </ol>
    </div>

    <div class="jan-footer">
      <span class="jan-doi">DOI: 10.1126/science.placeholder.2026</span>
      <span class="jan-pgnum"></span>
    </div>
  </section>


  <!-- ============================================================
       PAGE 2 — Remaining Methods, Results
       ============================================================ -->
  <section class="jan-page" id="page-2">
    <div class="jan-header">
      <span class="jan-hleft">Topological Anisotropic Superfluid Transport · Park et al.</span>
      <span class="jan-hright">SCIENCE (Submitted)</span>
    </div>

    <div class="jan-two-col" contenteditable="true">

      <h3>단일입자 해밀토니안</h3>
      <p>
        격자 + SOC 단일입자 해밀토니안은 다음과 같이 쓴다:
      </p>

      <figure class="jan-math" id="eq2"
        data-latex="\\hat{H}_0 = \\frac{(\\hat{\\mathbf p} - \\hbar \\mathbf{A}(\\sigma))^2}{2m} + V_0 \\sum_{i=x,y} \\sin^2(k_L x_i) + \\frac{\\Omega_R}{2}\\,\\hat{\\sigma}_x + \\frac{\\delta}{2}\\,\\hat{\\sigma}_z">
        <span class="jan-eq-body">Ĥ₀ = (p̂ − ℏA(σ))² / 2m + V₀ Σ_{i=x,y} sin²(k_L x_i) + (Ω_R/2) σ̂_x + (δ/2) σ̂_z</span>
      </figure>

      <p>
        여기서 <strong>A</strong>(σ) = <em>k<sub>R</sub></em> σ̂<sub>z</sub> <em>x</em>̂ 는 합성 게이지 퍼텐셜, δ 는 양자화 축 디튜닝(detuning) 이다. δ/ℏ = 2π × 0.4 Hz 이하로 유지되었다. 이 값은 라만 빔 주파수 안정도 ±15 Hz 안에 들어간다.
      </p>

      <h3>평균장 기술</h3>
      <p>
        다입자 상호작용을 포함한 Gross–Pitaevskii 에너지는
      </p>

      <figure class="jan-math" id="eq3"
        data-latex="E[\\Psi] = \\int d^2r \\Big[ \\Psi^\\dagger \\hat{H}_0 \\Psi + \\frac{g_{\\uparrow\\uparrow}}{2}|\\psi_\\uparrow|^4 + \\frac{g_{\\downarrow\\downarrow}}{2}|\\psi_\\downarrow|^4 + g_{\\uparrow\\downarrow}|\\psi_\\uparrow|^2|\\psi_\\downarrow|^2 \\Big]">
        <span class="jan-eq-body">E[Ψ] = ∫ d²r [ Ψ† Ĥ₀ Ψ + (g_↑↑/2)|ψ↑|⁴ + (g_↓↓/2)|ψ↓|⁴ + g_↑↓ |ψ↑|²|ψ↓|² ]</span>
      </figure>

      <p>
        산란 길이 <em>a</em><sub>↑↑</sub> = 100.9 <em>a</em><sub>0</sub>, <em>a</em><sub>↑↓</sub> = 98.7 <em>a</em><sub>0</sub> 를 사용했고 (<em>a</em><sub>0</sub>: Bohr 반지름), 2D 극한 감쇠는 <em>a</em><sub>2D</sub> = <em>a</em><sub>3D</sub>√(2π / ℓ<sub>z</sub>) 로 적용했다.
      </p>

      <h3>선형화: Bogoliubov–de Gennes 행렬</h3>
      <p>
        흐름이 포함된 주변 섭동은 BdG 행렬 방정식으로 기술된다:
      </p>

      <figure class="jan-math" id="eq4"
        data-latex="\\begin{pmatrix} \\mathcal{L}_0 - \\mu + 2 g n_0 & g n_0 \\\\ -g n_0 & -\\mathcal{L}_0^{\\ast} + \\mu - 2 g n_0 \\end{pmatrix} \\begin{pmatrix} u_k \\\\ v_k \\end{pmatrix} = \\hbar \\omega_k \\begin{pmatrix} u_k \\\\ v_k \\end{pmatrix}">
        <span class="jan-eq-body">[ ℒ₀ − μ + 2gn₀,  gn₀ ;  −gn₀,  −ℒ₀* + μ − 2gn₀ ] (u_k, v_k)ᵀ = ℏω_k (u_k, v_k)ᵀ</span>
      </figure>

      <p>
        여기서 ℒ<sub>0</sub> 는 흐름속도 <strong>v</strong> 에서 유효 단일입자 연산자 Ĥ<sub>0</sub> − <strong>v</strong>·<strong>p̂</strong> 이다. 임계속도는 min<sub>k</sub> ω<sub>k</sub>(<strong>v</strong>) = 0 으로부터 수치로 풀었다.
      </p>

      <h3>프로토콜 흐름</h3>
      <p>
        실험 실행 순서는 <a class="fig-ref" href="#fig2">Fig. 2</a> 의 순서도에 나타냈다. 각 단계의 괄호 안 숫자는 평균 지속 시간이다. 전체 1 shot 에 약 8.5 s 가 소요되며 반복 rate 는 7.1 Hz 이다.
      </p>

      <figure class="jan-fig jan-diagram" id="fig2"
        data-mermaid-code="Zmxvd2NoYXJ0IFRECkFbTU9UIOuhnOuUqV0gLS0+IEJb7Kad67Cc64OJ6rCBXQpCIC0tPiBDW0JFQyDsg53shLFdCkMgLS0+IERb6rSR6rKp7J6QIOueqO2UhF0KRCAtLT4gRVtSYW1hbiDqsrDtlaldCkUgLS0+IEZbQnJhZ2cg7Y6E7IqkXQpGIC0tPiBHW1RPRiDtjL3ssL1dCkcgLS0+IEhb7Z2h7IiYIOydtOuvuOynlV0=">
        <div class="jan-fig-placeholder">
          [그림 2 — 실험 프로토콜 순서도. Mermaid 렌더 대기 중…]
        </div>
        <figcaption>실험 프로토콜. 각 스텝의 괄호 안 숫자는 평균 지속 시간. 공명 판정은 Bragg 응답의 로렌츠 피팅 FWHM 기준으로 자동 분기된다.</figcaption>
      </figure>

      <h3>장치 블록 다이어그램</h3>
      <p>
        전체 하드웨어 배치는 <a class="fig-ref" href="#fig3">Fig. 3</a> 과 같다. Ti:Sa 와 다이오드 레이저가 각기 AOM 을 거쳐 광격자 / Raman 광학계로 분배되고, 진공 챔버 (&lt; 2×10<sup>−11</sup> Torr) 내부에서 BEC 와 상호작용한 뒤 CCD 이미징으로 검출된다. RF 안테나는 디튜닝 δ 를 피드포워드 보정한다.
      </p>

      <figure class="jan-fig jan-diagram" id="fig3"
        data-mermaid-code="Zmxvd2NoYXJ0IExSClRpU2FbVGk6U2EgMTA2NG5tXSAtLT4gQU9NMVtBT00xXQpBT00xIC0tPiBMYXR0aWNlW+qyqeyekCDqsrDruZTqs4RdCkxhdHRpY2UgLS0+IENoYW1iZXJbKOynhOqztSDssZTrsoQpXQpEaW9kZVtEaW9kZSA3OTBubV0gLS0+IEFPTTJbQU9NMl0KQU9NMiAtLT4gUmFtYW5bUmFtYW4g66qo65OIXQpSYW1hbiAtLT4gQ2hhbWJlcgpDaGFtYmVyIC0tPiBDQ0RbQ0NEIOydtOuvuOynlV0KQ0NEIC0tPiBQQ1vrtoTshJ0gUENd">
        <div class="jan-fig-placeholder">
          [그림 3 — 장치 블록 다이어그램. Mermaid 렌더 대기 중…]
        </div>
        <figcaption>실험 장치 블록 다이어그램. AOM = 음향광학 변조기. 모든 광경로는 능동 빔 안정화 피드백 (100 Hz 대역) 을 포함한다.</figcaption>
      </figure>

      <h2 id="sec-results">Results</h2>

      <h3>밴드 구조와 드레스드 최저점</h3>
      <p>
        <em>Ω<sub>R</sub></em> = 0 일 때 BEC 는 브릴루앙 영역 중심 Γ 에 응축한다. <em>Ω<sub>R</sub></em> 을 증가시키면 이중 최저점 구조가 나타나다가 <em>Ω<sub>R</sub></em>/<em>E<sub>R</sub></em> = 4.1 에서 단일 최저점 <em>k</em><sub>min</sub> 으로 병합된다. 이 천이점은 정확히 이론 예측값 <em>Ω<sub>R</sub></em><sup>c</sup> = 4 <em>E<sub>R</sub></em> 과 일치하며<sup class="jan-fn-mark"><a class="fn-ref" id="fnref2" href="#fn2">2</a></sup>, 이는 내부적 교정 점으로 활용된다.
      </p>

      <h3>비등방 임계속도</h3>
      <p>
        <a class="fig-ref" href="#fig4">Fig. 4</a> 는 <em>Ω<sub>R</sub></em>/<em>E<sub>R</sub></em> = 1.2 에서 측정된 Bragg 응답 스펙트럼이다. (a) <em>x</em>-방향 <em>v<sub>c</sub><sup>x</sup></em> = 1.8(1) mm/s, (b) <em>y</em>-방향 <em>v<sub>c</sub><sup>y</sup></em> = 0.19(2) mm/s 로 약 10배 차이를 확인했다. 빨간 실선은 BdG+Berry 이론, 점선은 유효질량 근사 예측이다. 후자는 관측 데이터와 체계적 하향 편차를 보인다.
      </p>

      <figure class="jan-fig" id="fig4">
        <div class="jan-fig-placeholder">
          [그림 4 자리 — (a) x-방향 Bragg 응답: 피크 위치 v_c^x = 1.8(1) mm/s. (b) y-방향 Bragg 응답: 피크 위치 v_c^y = 0.19(2) mm/s. 빨간 실선 BdG+Berry, 회색 점선 effective-mass only.]
        </div>
        <figcaption>Ω<sub>R</sub>/E<sub>R</sub> = 1.2 에서 측정된 Bragg 응답 스펙트럼. (a) x-방향 v<sub>c</sub><sup>x</sup> = 1.8(1) mm/s. (b) y-방향 v<sub>c</sub><sup>y</sup> = 0.19(2) mm/s. 빨간 실선: BdG+Berry 이론, 점선: 유효질량 근사 예측. 오차 막대는 1σ (N=18 샷).</figcaption>
      </figure>

      <p>
        <a class="tbl-ref" href="#tbl1">Table 1</a> 은 네 개 <em>Ω<sub>R</sub></em> 값에서의 측정값을 요약한다. 라만 결합이 증가함에 따라 <em>v<sub>c</sub><sup>y</sup></em> 는 급격히 감소하는 반면 <em>v<sub>c</sub><sup>x</sup></em> 는 완만히 감소하여, 비등방 비율이 최대 34 까지 증폭된다.
      </p>

      <figure class="jan-tbl" id="tbl1">
        <table>
          <thead>
            <tr>
              <th>Ω<sub>R</sub>/E<sub>R</sub></th>
              <th>v<sub>c</sub><sup>x</sup> 측정 (mm/s)</th>
              <th>v<sub>c</sub><sup>x</sup> 이론 (mm/s)</th>
              <th>v<sub>c</sub><sup>y</sup> 측정 (mm/s)</th>
              <th>상대 오차 (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>0.30</td><td>1.92 ± 0.06</td><td>1.95</td><td>1.77 ± 0.07</td><td>1.5</td></tr>
            <tr><td>0.85</td><td>1.84 ± 0.05</td><td>1.88</td><td>0.71 ± 0.04</td><td>2.2</td></tr>
            <tr><td>1.20</td><td>1.80 ± 0.10</td><td>1.83</td><td>0.19 ± 0.02</td><td>1.6</td></tr>
            <tr><td>2.40</td><td>1.71 ± 0.09</td><td>1.76</td><td>0.05 ± 0.01</td><td>2.9</td></tr>
          </tbody>
        </table>
        <figcaption>측정 및 이론 임계속도 비교. 오차는 표준편차 1σ (N=18 샷/포인트). 상대 오차는 |v<sup>x</sup><sub>exp</sub> − v<sup>x</sup><sub>th</sub>| / v<sup>x</sup><sub>th</sub>. 이론값은 BdG+Berry 수치계산 (<a class="eq-ref" href="#eq4">Eq. (4)</a>) 결과이다.</figcaption>
      </figure>

      <h3>위상 지표 추출</h3>
      <p>
        선형 반응식 <a class="eq-ref" href="#eq1">Eq. (1)</a> 로부터 방향별 강직성 비 ρ<sub>s,yy</sub>/ρ<sub>s,xx</sub> 를 추출하고, <em>Ω<sub>R</sub></em> 의존성을 피팅하여 Berry 지표 𝒞 를 얻는다. 10<sup>3</sup> 몬테카를로 재샘플링 결과는 <strong>𝒞 = 0.97 ± 0.04</strong> 이며, 정수화 예측 𝒞 = 1 과 일치한다 (&gt; 2σ 신뢰).
      </p>

    </div>

    <!-- 페이지 2 각주 -->
    <div class="jan-footnotes">
      <ol start="2" style="counter-reset: pap-fnli 1;">
        <li id="fn2">
          해석적으로 Ω<sub>R</sub><sup>c</sup> = 4 E<sub>R</sub> 은 두 이동된 포물선 ε<sub>±</sub>(k) = ℏ²(k ∓ k<sub>R</sub>)²/2m 의 단일 최저점 병합 조건에서 유도된다.
          <a class="jan-backref" href="#fnref2" title="본문으로 돌아가기">↩</a>
        </li>
      </ol>
    </div>

    <div class="jan-footer">
      <span class="jan-doi">DOI: 10.1126/science.placeholder.2026</span>
      <span class="jan-pgnum"></span>
    </div>
  </section>


  <!-- ============================================================
       PAGE 3 — Remaining Results, Discussion, Conclusion,
                Acknowledgments, Endnotes, References
       ============================================================ -->
  <section class="jan-page" id="page-3">
    <div class="jan-header">
      <span class="jan-hleft">Topological Anisotropic Superfluid Transport · Park et al.</span>
      <span class="jan-hright">SCIENCE (Submitted)</span>
    </div>

    <div class="jan-two-col" contenteditable="true">

      <h3>결과 요약 인포그래픽</h3>
      <p>
        <a class="fig-ref" href="#fig5">Fig. 5</a> 에 본 연구의 핵심 결과를 방사형으로 요약한다. 중앙 대표 숫자 𝒞 = 0.97 ± 0.04 와, 네 가지 보조 지표 — (i) 비등방 비율 <em>v<sub>c</sub><sup>x</sup></em>/<em>v<sub>c</sub><sup>y</sup></em> ≈ 34, (ii) 원자 수 10<sup>5</sup>, (iii) 18 샷 평균, (iv) 4% 이론-실험 일치 — 가 한눈에 드러나도록 배치했다.
      </p>

      <figure class="jan-fig jan-diagram" id="fig5"
        data-mermaid-code="Zmxvd2NoYXJ0IExSCkFb7Lih7KCV6rCSIPCdkp4gPSAwLjk3XSAtLT4gQlvsnbTroaDqsJIg8J2SniA9IDEuMDBdCkEgLS0+IENb7IOB64yA7Jik7LCoIDwgNCVdCkIgLS0+IEM=">
        <div class="jan-fig-placeholder">
          [그림 5 — 핵심 결과 인포그래픽. Mermaid 렌더 대기 중…]
        </div>
        <figcaption>핵심 결과 인포그래픽. 중앙 지표 𝒞 = 0.97 ± 0.04 는 정수화 위상 차수와 2σ 이상 일치한다. 주변 보조 지표는 이 값의 robustness 를 보조하는 독립 관측량이다.</figcaption>
      </figure>

      <h3>로버스트니스 점검</h3>
      <p>
        디튜닝 δ/<em>h</em> 를 ± 20 Hz 변화시켰을 때 𝒞 의 변동은 0.02 이내에 머무른다. 또한 격자 깊이 <em>V</em><sub>0</sub> 를 6 <em>E<sub>R</sub></em> 에서 12 <em>E<sub>R</sub></em> 까지 스캔했을 때, 임계속도 비율은 동일한 scaling collapse 에 따른다. 이는 측정된 비등방성이 단순 이방성 유효질량보다는 근본적 위상량에서 기인함을 보여준다.
      </p>

      <h2 id="sec-discuss">Discussion</h2>

      <h3>왜 유효질량 근사는 실패하는가</h3>
      <p>
        유효질량 텐서 <em>m</em><sup>*</sup><sub>ij</sub> 만으로 초유체 강직성을 계산하면 (즉 <a class="eq-ref" href="#eq1">Eq. (1)</a> 의 셋째 항 무시), 우리는 <em>v<sub>c</sub><sup>x</sup></em> / <em>v<sub>c</sub><sup>y</sup></em> ≈ (<em>m</em><sup>*</sup><sub>yy</sub>/<em>m</em><sup>*</sup><sub>xx</sub>)<sup>1/2</sup> ≤ 2.8 을 얻는다. 이는 관측값 ~ 34 와 한 자릿수 이상 차이나므로, Berry 곡률 기여가 압도적임을 함축한다. <a class="fig-ref" href="#fig4">Fig. 4</a> 점선 곡선의 체계적 하향 편차가 이를 시각적으로 확인해 준다.
      </p>

      <h3>엣지 포논 예측</h3>
      <p>
        BdG 에서 추출한 에너지 스펙트럼은 Chern 수 <em>C</em> = 1 인 벌크 밴드와 열린 기하에서 두 개의 chiral edge mode 를 시사한다. 이 모드의 예상 군속도는 <em>v</em><sub>edge</sub> ≈ 0.42 mm/s 로, 현재 우리 시스템의 샷투샷 속도 해상도 ~ 0.01 mm/s <a class="cite" href="#ref-8">[8]</a> 로 충분히 검출 가능하다. 즉 다음 세대 실험에서 <strong>중성 원자 chiral phonon</strong> 의 첫 관측이 가능하다.
      </p>

      <h3>상호작용 효과</h3>
      <p>
        본 실험은 <em>g n</em><sub>0</sub> ~ 0.3 <em>E<sub>R</sub></em> 로 중등도 결합 영역이다. 더 강한 결합에서는 stripe 상 <a class="cite" href="#ref-9">[9]</a> 과의 경쟁이 예상되며, <a class="eq-ref" href="#eq1">Eq. (1)</a> 은 재규격화를 받을 것이다. 예비 수치계산은 <em>g n</em><sub>0</sub> = 0.9 <em>E<sub>R</sub></em> 부터 Berry 항이 5% 이상 변형됨을 시사한다.<sup class="jan-fn-mark"><a class="fn-ref" id="fnref3" href="#fn3">3</a></sup>
      </p>

      <h3>한계</h3>
      <p>
        주요 불확실성은 (i) 라만 빔 위상 잡음에 의한 <em>Ω<sub>R</sub></em> 드리프트 (±1.2%), (ii) 이미징 광학의 점확산함수 비등방성, (iii) 자유 팽창 중 원자 간 잔존 상호작용으로 인한 모멘텀 분포 왜곡이다. (iii) 은 가장 큰 체계 오차(2.5%) 원인으로 평가된다.<sup class="jan-fn-mark"><a class="en-ref" id="enref2" href="#en2">ii</a></sup>
      </p>

      <h2 id="sec-conclusion">Conclusion</h2>
      <p>
        우리는 2D 광격자 속 SOC-BEC 의 비등방 초유체 수송을 두 주축에서 독립 측정하여 Berry 곡률의 직접적 서명을 관측했다. 측정된 방향별 임계속도 비율은 <em>Ω<sub>R</sub></em> 의 함수로 크게 증폭되며, 단순 유효질량 근사와 결정적으로 어긋난다. 추출된 위상 지표 𝒞 = 0.97 ± 0.04 는 정수화 예측과 일치하며, 이는 중성 원자 플랫폼에서 <strong>약결합 위상 초유체</strong>의 존재에 대한 수송 기반 증거이다. 본 결과는 chiral edge phonon 의 검출과 fractional 위상 상태로의 확장 등 후속 실험에 대한 정량적 경로를 연다.<sup class="jan-fn-mark"><a class="en-ref" id="enref1" href="#en1">i</a></sup>
      </p>

      <!-- Acknowledgments -->
      <section class="jan-ack" id="sec-ack">
        <h2>Acknowledgments</h2>
        <p style="text-indent:0;margin:0;">
          본 연구는 한국연구재단 (NRF-2024-R1A2C300XXXX), 삼성미래기술육성사업 (SSTF-BA2024-01), 그리고 ETH Foundations 의 지원을 받았다. 저자들은 J.-H. 김, L. Fontana, 그리고 Zwierlein 그룹과의 유익한 논의에 감사드린다. 모든 raw 데이터는 합당한 요청 시 교신저자로부터 제공된다. Author contributions: J.P. 실험 설계·데이터 수집, M.S. 이론·수치 계산, A.K. BdG 코드 및 Berry 항 분석. 모든 저자가 원고 작성·검토에 참여했다.
        </p>
      </section>

      <!-- Endnotes -->
      <section class="jan-endnotes">
        <h2>Endnotes</h2>
        <ol>
          <li id="en1">
            본 논문은 3페이지 요약본이며, 모든 보조 데이터·코드·raw 이미지는 Zenodo DOI:10.5281/zenodo.84xxxxx 에 공개된다. 코드 저장소는 MIT 라이선스로 배포된다.
            <a class="jan-backref" href="#enref1">↩</a>
          </li>
          <li id="en2">
            이미징 광학의 PSF 비등방성은 별도 calibration run 에서 측정되었으며, deconvolution 후 잔존 효과는 0.3% 이하로 평가된다.
            <a class="jan-backref" href="#enref2">↩</a>
          </li>
        </ol>
      </section>

      <!-- References -->
      <section class="jan-bibliography" id="sec-refs">
        <h2>References</h2>
        <ol>
          <li id="ref-1">
            I. Bloch, J. Dalibard, and W. Zwerger, "Many-body physics with ultracold gases," <em>Rev. Mod. Phys.</em>, vol. 80, no. 3, pp. 885–964, Jul. 2008.
          </li>
          <li id="ref-2">
            M. Lewenstein, A. Sanpera, and V. Ahufinger, <em>Ultracold Atoms in Optical Lattices: Simulating Quantum Many-Body Systems</em>. Oxford, U.K.: Oxford Univ. Press, 2012.
          </li>
          <li id="ref-3">
            Y.-J. Lin, K. Jiménez-García, and I. B. Spielman, "Spin–orbit-coupled Bose–Einstein condensates," <em>Nature</em>, vol. 471, no. 7336, pp. 83–86, Mar. 2011.
          </li>
          <li id="ref-4">
            N. Goldman, G. Juzeliūnas, P. Öhberg, and I. B. Spielman, "Light-induced gauge fields for ultracold atoms," <em>Rep. Prog. Phys.</em>, vol. 77, no. 12, p. 126401, Dec. 2014.
          </li>
          <li id="ref-5">
            G. Jotzu <em>et al.</em>, "Experimental realization of the topological Haldane model with ultracold fermions," <em>Nature</em>, vol. 515, no. 7526, pp. 237–240, Nov. 2014.
          </li>
          <li id="ref-6">
            L. W. Clark, B. M. Anderson, L. Feng, A. Gaj, K. Levin, and C. Chin, "Observation of density-dependent gauge fields in a Bose–Einstein condensate," <em>Phys. Rev. Lett.</em>, vol. 121, no. 3, p. 030402, Jul. 2018.
          </li>
          <li id="ref-7">
            C. Wang, C. Gao, C.-M. Jian, and H. Zhai, "Spin–orbit coupled spinor Bose–Einstein condensates," <em>Phys. Rev. Lett.</em>, vol. 105, no. 16, p. 160403, Oct. 2010.
          </li>
          <li id="ref-8">
            R. Desbuquois <em>et al.</em>, "Superfluid behaviour of a two-dimensional Bose gas," <em>Nat. Phys.</em>, vol. 8, no. 9, pp. 645–648, Sep. 2012.
          </li>
          <li id="ref-9">
            J.-R. Li <em>et al.</em>, "A stripe phase with supersolid properties in spin–orbit-coupled Bose–Einstein condensates," <em>Nature</em>, vol. 543, no. 7643, pp. 91–94, Mar. 2017.
          </li>
          <li id="ref-10">
            M. Aidelsburger, M. Atala, M. Lohse, J. T. Barreiro, B. Paredes, and I. Bloch, "Realization of the Hofstadter Hamiltonian with ultracold atoms in optical lattices," <em>Phys. Rev. Lett.</em>, vol. 111, no. 18, p. 185301, Oct. 2013.
          </li>
        </ol>
      </section>

    </div>

    <!-- 페이지 3 각주 -->
    <div class="jan-footnotes">
      <ol start="3" style="counter-reset: pap-fnli 2;">
        <li id="fn3">
          해당 예비 계산은 192 × 192 k-grid, <em>N</em> = 10<sup>5</sup> 의 GP+Berry 스플릿-스텝 적분기로 수행되었고, 본 논문의 Supplementary S4 에 제시된다. 수렴성은 Δk → 0 극한에서 0.4% 이내이다.
          <a class="jan-backref" href="#fnref3" title="본문으로 돌아가기">↩</a>
        </li>
      </ol>
    </div>

    <div class="jan-footer">
      <span class="jan-doi">DOI: 10.1126/science.placeholder.2026 · Received 23 Apr 2026</span>
      <span class="jan-pgnum"></span>
    </div>
  </section>

</div>
<!-- END paper-template.html -->
`;
})();
