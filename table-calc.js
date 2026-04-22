/**
 * JustANotepad — Table Calc Engine (엑셀식 자동 계산) v2
 * --------------------------------------------------------------------------
 * 표 안의 숫자를 자동으로 합계/평균/최소/최대/개수 계산.
 *
 * v2 changes (colspan/rowspan 인식):
 *   - 내부적으로 표를 visual grid 로 변환하여 colspan 이 섞인 요약 행도 정확히
 *     시각 열에 맞춰 합계를 배치 (이전: DOM cells[i] 기반이라 colspan 시 엇나감).
 *   - SUMMARY_LABEL 정규식 확장: "합계", "소계", "합계 시간", "Total Price" 등
 *     뒤에 공백+텍스트가 붙는 형태도 허용.
 *   - apply() 는 (cell 엘리먼트 또는 visualColIdx) 를 받도록 오버로드.
 *     app.html 쪽에서는 사용자가 클릭한 cell 을 그대로 넘기면 자동으로 visual
 *     col 을 계산.
 *
 * 사용 방법 (사용자):
 *   1. 표 안의 셀을 클릭 → 플로팅 툴바에 "계산" 섹션 표시
 *   2. ∑합/평균/최소/최대/개수 버튼 클릭 → 현재 열에 적용
 *   3. 데이터 셀의 숫자를 바꾸면 합계 셀이 자동 재계산
 *
 * 내부 구현:
 *   - "합계" 셀에 data-calc="sum|avg|min|max|count" 속성 삽입
 *   - 표에 data-calc-summary 행 표시
 *   - 에디터(#page) 에 input 리스너 → 해당 셀이 속한 표만 재계산 (150ms debounce)
 *   - 템플릿이 <th>합계</th> 같은 요약 행을 가지고 있으면 자동 감지해서
 *     사용자가 따로 버튼 안 눌러도 숫자 열에 sum 자동 적용
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

  // 요약 행으로 인식할 첫 칼럼 텍스트 패턴.
  // "합계", "합계 시간", "Grand Total" 같이 공백+보조어가 붙는 변형도 허용.
  const SUMMARY_LABEL = /^(합계|소계|총계|합|Total|Sum|Subtotal|Grand Total)(\s+.+)?$/i;

  // ---- 유틸 ----------------------------------------------------------------

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

  // ---- Visual Grid --------------------------------------------------------
  // 표를 2D grid 로 변환. grid[r][c] = 셀 엘리먼트 (colspan/rowspan 은 같은
  // 엘리먼트가 여러 (r,c) 에 등장). 시각적 열 c 는 0-based, 합쳐지지 않은
  // "만약 모든 셀이 1x1 이었다면 몇 번째 열인가" 기준.
  function buildGrid(table) {
    const grid = [];
    const rows = Array.from(table.rows);
    rows.forEach((row, r) => {
      if (!grid[r]) grid[r] = [];
      let c = 0;
      Array.from(row.cells).forEach(cell => {
        // 위에서 rowspan 으로 내려온 셀이 있으면 스킵
        while (grid[r][c] !== undefined) c++;
        const colspan = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10) || 1);
        const rowspan = Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10) || 1);
        for (let dr = 0; dr < rowspan; dr++) {
          if (!grid[r + dr]) grid[r + dr] = [];
          for (let dc = 0; dc < colspan; dc++) {
            grid[r + dr][c + dc] = cell;
          }
        }
        c += colspan;
      });
    });
    return grid;
  }

  function isCellLeftEdge(grid, r, c) {
    const cell = grid[r] && grid[r][c];
    if (!cell) return false;
    return (c === 0 || grid[r][c - 1] !== cell);
  }
  function isCellTopEdge(grid, r, c) {
    const cell = grid[r] && grid[r][c];
    if (!cell) return false;
    return (r === 0 || !grid[r - 1] || grid[r - 1][c] !== cell);
  }

  // ---- 표 구조 분석 --------------------------------------------------------

  // 표에서 요약 행 찾기 — data-calc-summary="1" 속성이 있는 행 우선, 없으면
  // 마지막 행의 첫 셀이 '합계'류 라벨인 경우 자동 지정.
  function findSummaryRow(table) {
    const rows = table.rows;
    if (rows.length < 2) return null;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].dataset.calcSummary === '1') return rows[i];
    }
    const last = rows[rows.length - 1];
    if (last.cells.length > 0 && isSummaryLabelCell(last.cells[0])) {
      last.dataset.calcSummary = '1';
      return last;
    }
    return null;
  }

  // 헤더 행 인덱스 목록 — 모든 셀이 TH 인 행
  function headerRowIndices(table) {
    const rows = Array.from(table.rows);
    const out = [];
    rows.forEach((r, i) => {
      const cells = Array.from(r.cells);
      if (cells.length > 0 && cells.every(c => c.tagName === 'TH')) out.push(i);
    });
    return out;
  }

  // visual col 의 숫자들 수집 (헤더/요약 행 제외, 스팬 셀은 top-left 에서 1번만)
  function collectColumnGrid(table, grid, visualCol, summaryIdx) {
    const hdr = new Set(headerRowIndices(table));
    const nums = [];
    for (let r = 0; r < grid.length; r++) {
      if (hdr.has(r)) continue;
      if (r === summaryIdx) continue;
      const cell = grid[r] && grid[r][visualCol];
      if (!cell) continue;
      // 스팬 셀 중복 집계 방지: top-left 꼭지점에서만 수집
      if (!isCellLeftEdge(grid, r, visualCol)) continue;
      if (!isCellTopEdge(grid, r, visualCol)) continue;
      const n = parseNum(cell.innerText || cell.textContent);
      if (!isNaN(n)) nums.push(n);
    }
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

  // 주어진 cell 의 visual col 인덱스 (top-left 기준)
  function visualColOf(grid, rowIdx, cell) {
    const row = grid[rowIdx] || [];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === cell) return c;
    }
    return -1;
  }

  // ---- 핵심: recompute -----------------------------------------------------
  function recomputeTable(table) {
    if (!table) return;
    const summaryRow = findSummaryRow(table);
    if (!summaryRow) return;
    const grid = buildGrid(table);
    const summaryIdx = Array.from(table.rows).indexOf(summaryRow);
    const summaryCols = grid[summaryIdx] || [];
    const totalCols = summaryCols.length;
    // 가로 전체 visual col 수 (다른 행까지 고려한 max)
    const maxCols = Math.max(totalCols, ...grid.map(r => (r || []).length));

    for (let c = 0; c < maxCols; c++) {
      const cell = summaryCols[c];
      if (!cell) continue;
      // 스팬 셀은 left-edge 에서만 처리 (같은 셀을 2번 write 하지 않도록)
      if (!isCellLeftEdge(grid, summaryIdx, c)) continue;
      if (c === 0) continue;                       // 첫 visual col 은 라벨 자리
      if (cell.dataset.calcOptOut === '1') continue;

      // auto-seed: dataset.calc 가 없고 해당 visual col 에 숫자가 있으면 sum 자동 적용
      if (!cell.dataset.calc) {
        const nums = collectColumnGrid(table, grid, c, summaryIdx);
        if (nums.length === 0) continue;
        cell.dataset.calc = 'sum';
      }

      const op = cell.dataset.calc;
      const nums = collectColumnGrid(table, grid, c, summaryIdx);
      const result = computeOp(nums, op);
      cell.dataset.calcAuto = '1';
      cell.innerText = fmtNum(result);
      if (!cell.style.background) {
        cell.style.background = 'color-mix(in srgb, var(--accent, #FAE100) 30%, transparent)';
      }
    }
  }

  // ---- apply() : 툴바 버튼 핸들러 ------------------------------------------
  // target: cell 엘리먼트(권장) 또는 visual col 인덱스(숫자)
  function apply(table, target, op) {
    if (!table) return;
    let summaryRow = findSummaryRow(table);
    if (!summaryRow) {
      // 요약 행 없으면 자동 생성 — visual col 수 만큼 TH 삽입
      const gridNow = buildGrid(table);
      const colCount = Math.max(0, ...gridNow.map(r => (r || []).length));
      summaryRow = table.insertRow(-1);
      for (let i = 0; i < colCount; i++) {
        const th = document.createElement('th');
        if (i === 0) th.textContent = '합계';
        summaryRow.appendChild(th);
      }
      summaryRow.dataset.calcSummary = '1';
    }
    const grid = buildGrid(table);
    const summaryIdx = Array.from(table.rows).indexOf(summaryRow);
    const summaryCols = grid[summaryIdx] || [];

    // target 이 cell 이면 해당 셀의 visual col 을 추출, 그 visual col 에 해당하는
    // 요약 셀을 찾음. target 이 숫자면 그대로 사용.
    let visualCol = -1;
    if (typeof target === 'number') {
      visualCol = target;
    } else if (target && target.parentElement) {
      const row = target.parentElement;
      const rowIdx = Array.from(table.rows).indexOf(row);
      visualCol = visualColOf(grid, rowIdx, target);
    }
    if (visualCol < 0) return;

    // 같은 visual col 의 요약 셀
    let sumCell = summaryCols[visualCol];
    if (!sumCell) {
      // 요약 행이 방금 생성된 경우 위 grid 빌드 이후라 있을 텐데 혹시 없으면 return
      return;
    }
    // 스팬 된 라벨 셀에 쓰지 않도록: 만약 visualCol 이 스팬 라벨 내부라면
    // 그 스팬 바로 다음 visual col 로 이동 (= 첫 번째 쓸 수 있는 셀)
    // 보통 사용자는 데이터 열의 셀을 클릭하므로, 그 열의 요약 칸이 별개로 있음.
    if (!isCellLeftEdge(grid, summaryIdx, visualCol) || sumCell === summaryRow.cells[0]) {
      // 이 경우는 데이터 열이 라벨과 합쳐진 비정상 케이스 — 무시
      // 안전하게 좌측 1열에는 쓰지 않음
      if (sumCell === summaryRow.cells[0]) return;
    }

    if (op === 'clear') {
      delete sumCell.dataset.calc;
      delete sumCell.dataset.calcAuto;
      sumCell.dataset.calcOptOut = '1';
      sumCell.innerText = '';
      sumCell.style.background = '';
      return;
    }
    delete sumCell.dataset.calcOptOut;
    sumCell.dataset.calc = op;
    recomputeTable(table);
  }

  // ---- 입력 리스너 ---------------------------------------------------------
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

  function init() {
    const page = document.getElementById('page');
    if (page) attachInputListener(page);
    if (page) page.querySelectorAll('table').forEach(t => { try { recomputeTable(t); } catch{} });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  function reapplyAll() {
    const page = document.getElementById('page');
    if (!page) return;
    page.querySelectorAll('table').forEach(t => { try { recomputeTable(t); } catch{} });
  }

  window.JANTableCalc = { apply, recomputeTable, reapplyAll, parseNum, fmtNum };
})();
