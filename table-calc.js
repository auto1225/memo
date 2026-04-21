/**
 * JustANotepad — Table Calc Engine (엑셀식 자동 계산)
 * --------------------------------------------------------------------------
 * 표 안의 숫자를 자동으로 합계/평균/최소/최대/개수 계산.
 *
 * 사용 방법 (사용자):
 *   1. 표 안의 셀을 클릭 → 플로팅 툴바에 "계산" 섹션 표시
 *   2. ∑합/평균/최소/최대/개수 버튼 클릭 → 현재 열에 적용
 *   3. 데이터 셀의 숫자를 바꾸면 합계 셀이 자동 재계산
 *
 * 내부 구현:
 *   - "합계" 셀에 data-calc="sum|avg|min|max|count" 속성 삽입
 *   - 표에 data-calc-enabled="1" 마커 추가
 *   - 에디터(#page) 에 input 리스너 → 해당 셀이 속한 표가 재계산되도록
 *   - 템플릿이 <th>합계</th> 같은 요약 행을 가지고 있으면 자동 감지해서
 *     기존 설계대로 동작 (사용자가 버튼 누르지 않아도 자동 sum)
 *
 * 숫자 파싱:
 *   - "1,000" (쉼표 천단위)
 *   - "$100", "₩1,000", "100원" (통화 접두/접미)
 *   - "10.5" (소수점)
 *   - "100%" (100 으로 해석)
 *   → 모두 숫자만 추출해 parseFloat
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.JANTableCalc) return;

  // 요약 행으로 인식할 첫 칼럼 텍스트 패턴
  const SUMMARY_LABEL = /^(합계|소계|총계|합|Total|Sum|Subtotal|Grand Total)$/i;

  // 숫자 파싱 — 빈 문자열 / 비숫자 → NaN
  function parseNum(str) {
    if (str == null) return NaN;
    const s = String(str).trim();
    if (!s) return NaN;
    // 통화·단위·공백·쉼표 제거 후 숫자 추출
    const cleaned = s.replace(/[,\s₩$￦원€¥£%]/g, '');
    const m = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (!m) return NaN;
    const n = parseFloat(m[0]);
    return isNaN(n) ? NaN : n;
  }

  // 숫자 포맷 — 정수면 쉼표 구분, 소수면 소수점 2자리
  function fmtNum(n) {
    if (!isFinite(n)) return '';
    if (Math.abs(n - Math.round(n)) < 1e-9) {
      return Math.round(n).toLocaleString('ko-KR');
    }
    return (Math.round(n * 100) / 100).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  }

  // 셀이 요약 행의 첫 셀인지 (텍스트로 '합계' 등) 판단
  function isSummaryLabelCell(cell) {
    const t = (cell.innerText || cell.textContent || '').trim();
    return SUMMARY_LABEL.test(t);
  }

  // 표에서 요약 행 찾기 — 마지막 행 중 첫 셀이 '합계'류 라벨이거나
  // data-calc-summary 속성이 있는 행
  function findSummaryRow(table) {
    const rows = table.rows;
    if (rows.length < 2) return null;
    // data-calc-summary 속성이 있는 행 우선
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].dataset.calcSummary === '1') return rows[i];
    }
    // 마지막 행 첫 셀이 '합계' 인지
    const last = rows[rows.length - 1];
    if (last.cells.length > 0 && isSummaryLabelCell(last.cells[0])) {
      last.dataset.calcSummary = '1';
      return last;
    }
    return null;
  }

  // 헤더 행 인덱스 목록 — 첫 행이 모두 th 면 헤더로 간주
  function headerRowIndices(table) {
    const rows = Array.from(table.rows);
    const out = [];
    rows.forEach((r, i) => {
      const cells = Array.from(r.cells);
      if (cells.length > 0 && cells.every(c => c.tagName === 'TH')) out.push(i);
    });
    return out;
  }

  // 특정 열의 데이터 셀 숫자들 수집 (헤더·요약 행 제외)
  function collectColumn(table, colIdx, summaryRow) {
    const hdr = new Set(headerRowIndices(table));
    const summaryIdx = summaryRow ? Array.from(table.rows).indexOf(summaryRow) : -1;
    const nums = [];
    Array.from(table.rows).forEach((r, i) => {
      if (hdr.has(i)) return;
      if (i === summaryIdx) return;
      const cell = r.cells[colIdx];
      if (!cell) return;
      const n = parseNum(cell.innerText || cell.textContent);
      if (!isNaN(n)) nums.push(n);
    });
    return nums;
  }

  function computeOp(nums, op) {
    if (nums.length === 0) return NaN;
    switch (op) {
      case 'sum':   return nums.reduce((a, b) => a + b, 0);
      case 'avg':   return nums.reduce((a, b) => a + b, 0) / nums.length;
      case 'min':   return Math.min(...nums);
      case 'max':   return Math.max(...nums);
      case 'count': return nums.length;
      default:      return NaN;
    }
  }

  // 해당 표에서 data-calc 가 세팅된 모든 셀을 재계산
  // 처음 감지되는 요약 행은 자동으로 숫자 열에 sum 을 세팅 (사용자가 따로 안 눌러도 동작)
  function recomputeTable(table) {
    if (!table) return;
    const summaryRow = findSummaryRow(table);
    if (!summaryRow) return;

    // auto-seed: 데이터 행에 숫자가 들어있는 열의 요약 셀에 data-calc="sum" 자동 주입.
    // (이미 dataset.calc 가 있거나 명시적으로 사용자가 비운 경우엔 덮지 않음)
    // 매 recompute 마다 체크 — 처음 빈 표였다가 숫자가 채워지면 그때 seed 적용.
    Array.from(summaryRow.cells).forEach((cell, colIdx) => {
      if (cell.dataset.calc) return;                    // 이미 세팅됨
      if (cell.dataset.calcOptOut === '1') return;      // 사용자가 명시적으로 해제
      if (colIdx === 0) return;                         // 첫 열은 라벨
      const nums = collectColumn(table, colIdx, summaryRow);
      if (nums.length === 0) return;                    // 숫자 없으면 pass
      cell.dataset.calc = 'sum';
    });

    Array.from(summaryRow.cells).forEach((cell, colIdx) => {
      const op = cell.dataset.calc;
      if (!op) return;
      const nums = collectColumn(table, colIdx, summaryRow);
      const result = computeOp(nums, op);
      // 포매팅. NaN(데이터 없음) → 빈 문자열
      cell.dataset.calcAuto = '1';
      cell.innerText = fmtNum(result);
      // 시각적 힌트 — 계산식 있는 셀은 미묘하게 스타일링
      if (!cell.style.background) {
        cell.style.background = 'color-mix(in srgb, var(--accent, #FAE100) 30%, transparent)';
      }
    });
  }

  // 버튼 핸들러 — 클릭한 열 colIdx 에 op 적용
  function apply(table, colIdx, op) {
    if (!table) return;
    let summaryRow = findSummaryRow(table);
    if (!summaryRow) {
      // 요약 행이 없으면 자동으로 추가
      const lastRow = table.rows[table.rows.length - 1];
      const colCount = Math.max(...Array.from(table.rows).map(r => r.cells.length));
      summaryRow = table.insertRow(-1);
      for (let i = 0; i < colCount; i++) {
        const th = document.createElement('th');
        if (i === 0) th.textContent = '합계';
        summaryRow.appendChild(th);
      }
      summaryRow.dataset.calcSummary = '1';
    }
    const cell = summaryRow.cells[colIdx];
    if (!cell) return;
    if (op === 'clear') {
      delete cell.dataset.calc;
      delete cell.dataset.calcAuto;
      cell.dataset.calcOptOut = '1';  // auto-seed 가 다시 sum 덮는 걸 방지
      cell.innerText = '';
      cell.style.background = '';
      return;
    }
    delete cell.dataset.calcOptOut;
    cell.dataset.calc = op;
    recomputeTable(table);
  }

  // 에디터 전역 입력 리스너 — 표 안의 셀이 바뀌면 해당 표만 재계산
  // (페이지 내 모든 표를 매번 계산하지 않고, event.target 이 속한 표만)
  let pendingTable = null;
  let pendingTimer = null;
  function scheduleRecompute(table) {
    pendingTable = table;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      try { recomputeTable(pendingTable); } catch (e) { console.warn('[TableCalc]', e); }
      pendingTable = null;
    }, 150);
  }

  function attachInputListener(root) {
    if (!root || root.__janTableCalcBound) return;
    root.__janTableCalcBound = true;
    root.addEventListener('input', (e) => {
      const cell = e.target.closest && e.target.closest('td, th');
      if (!cell) return;
      const table = cell.closest('table');
      if (!table) return;
      scheduleRecompute(table);
    });
  }

  // 문서 로드 후 #page 에 연결. 탭 전환시 #page 는 유지되므로 1번만 연결.
  function init() {
    const page = document.getElementById('page');
    if (page) attachInputListener(page);
    // 초기 1회: 현재 페이지의 모든 표에 대해 이미 설정된 계산식 재계산
    if (page) page.querySelectorAll('table').forEach(t => { try { recomputeTable(t); } catch{} });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // 탭 전환 등으로 #page 내용이 바뀔 때 기존 계산식 재계산 트리거
  // (addTab 등의 액션 후 수동 호출 가능)
  function reapplyAll() {
    const page = document.getElementById('page');
    if (!page) return;
    page.querySelectorAll('table').forEach(t => { try { recomputeTable(t); } catch{} });
  }

  window.JANTableCalc = { apply, recomputeTable, reapplyAll, parseNum, fmtNum };
})();
