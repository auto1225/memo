/**
 * JustANotepad — Calendar data utilities
 * --------------------------------------------------------------------------
 * Provides:
 *   - KOREAN_HOLIDAYS 2025-2028 (precomputed lunar→solar for movable days)
 *   - parseNaturalKR(str): '내일 3시 치과' → { startAt, title }
 *   - formatRelativeKR(date): '오늘', '내일', '모레', '3일 뒤', 'D-7'
 *   - expandRecurring(event, rangeStart, rangeEnd): generate occurrences
 *   - solarToLunar(date): rough approximation via precomputed table
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.JANCalData) return;

  // ------- Korean public holidays 2025-2028 --------------------------------
  // Fixed (solar) + major movable (lunar new year, chuseok, etc. precomputed)
  const KOREAN_HOLIDAYS = {
    // 2025
    '2025-01-01': '신정',
    '2025-01-28': '설날 연휴',
    '2025-01-29': '설날',
    '2025-01-30': '설날 연휴',
    '2025-03-01': '삼일절',
    '2025-05-05': '어린이날 / 부처님오신날',
    '2025-05-06': '어린이날 대체공휴일',
    '2025-06-06': '현충일',
    '2025-08-15': '광복절',
    '2025-10-03': '개천절',
    '2025-10-05': '추석 연휴',
    '2025-10-06': '추석',
    '2025-10-07': '추석 연휴',
    '2025-10-08': '추석 대체공휴일',
    '2025-10-09': '한글날',
    '2025-12-25': '성탄절',
    // 2026
    '2026-01-01': '신정',
    '2026-02-16': '설날 연휴',
    '2026-02-17': '설날',
    '2026-02-18': '설날 연휴',
    '2026-03-01': '삼일절',
    '2026-03-02': '삼일절 대체공휴일',
    '2026-05-05': '어린이날',
    '2026-05-24': '부처님오신날',
    '2026-05-25': '부처님오신날 대체공휴일',
    '2026-06-06': '현충일',
    '2026-08-15': '광복절',
    '2026-08-17': '광복절 대체공휴일',
    '2026-09-24': '추석 연휴',
    '2026-09-25': '추석',
    '2026-09-26': '추석 연휴',
    '2026-10-03': '개천절',
    '2026-10-09': '한글날',
    '2026-12-25': '성탄절',
    // 2027
    '2027-01-01': '신정',
    '2027-02-06': '설날 연휴',
    '2027-02-07': '설날',
    '2027-02-08': '설날 연휴',
    '2027-03-01': '삼일절',
    '2027-05-05': '어린이날',
    '2027-05-13': '부처님오신날',
    '2027-06-06': '현충일',
    '2027-08-15': '광복절',
    '2027-09-14': '추석 연휴',
    '2027-09-15': '추석',
    '2027-09-16': '추석 연휴',
    '2027-10-03': '개천절',
    '2027-10-09': '한글날',
    '2027-12-25': '성탄절',
    // 2028
    '2028-01-01': '신정',
    '2028-01-26': '설날 연휴',
    '2028-01-27': '설날',
    '2028-01-28': '설날 연휴',
    '2028-03-01': '삼일절',
    '2028-05-02': '부처님오신날',
    '2028-05-05': '어린이날',
    '2028-06-06': '현충일',
    '2028-08-15': '광복절',
    '2028-10-02': '추석 연휴',
    '2028-10-03': '추석 / 개천절',
    '2028-10-04': '추석 연휴',
    '2028-10-09': '한글날',
    '2028-12-25': '성탄절',
  };

  // ------- Natural-language Korean date parser -----------------------------
  // Accepts strings like:
  //   '내일 3시 치과'
  //   '오늘 오후 2시 반 회의'
  //   '3월 15일 오전 10시'
  //   '다음 주 수요일 점심'
  //   '2026-06-15 14:30 팀미팅'
  // Returns { startAt: Date, title: string, allDay: boolean } or null on fail.
  function parseNaturalKR(input) {
    if (!input) return null;
    const src = input.trim();
    let s = src;
    const now = new Date();
    const out = { startAt: new Date(now), title: '', allDay: false };
    // Reset time
    out.startAt.setSeconds(0, 0);

    // 1) Day keyword
    const dayMap = { '오늘': 0, '내일': 1, '모레': 2, '글피': 3 };
    for (const k in dayMap) {
      if (s.includes(k)) { out.startAt.setDate(now.getDate() + dayMap[k]); s = s.replace(k, '').trim(); break; }
    }

    // 2) Weekday keyword: '이번 주 수요일' / '다음 주 금요일'
    const wdMap = { '일요일':0,'월요일':1,'화요일':2,'수요일':3,'목요일':4,'금요일':5,'토요일':6 };
    for (const wdName in wdMap) {
      if (s.includes(wdName)) {
        const targetWd = wdMap[wdName];
        let weekOff = 0;
        if (/다음\s*주/.test(s)) weekOff = 1;
        if (/다다음\s*주/.test(s)) weekOff = 2;
        const base = new Date(now);
        const diff = (targetWd - base.getDay() + 7) % 7;
        base.setDate(base.getDate() + diff + weekOff * 7);
        out.startAt.setFullYear(base.getFullYear(), base.getMonth(), base.getDate());
        s = s.replace(/다다음\s*주/g, '').replace(/다음\s*주/g, '').replace(/이번\s*주/g, '').replace(wdName, '').trim();
        break;
      }
    }

    // 3) Absolute date: 'YYYY-MM-DD' or 'M월 D일' / 'M/D'
    const ymd = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (ymd) {
      out.startAt.setFullYear(+ymd[1], +ymd[2]-1, +ymd[3]);
      s = s.replace(ymd[0], '').trim();
    } else {
      const md = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
      if (md) {
        out.startAt.setMonth(+md[1]-1, +md[2]);
        // If the month/day already passed this year, bump to next year
        if (out.startAt.getTime() < Date.now() - 86400000) {
          out.startAt.setFullYear(out.startAt.getFullYear() + 1);
        }
        s = s.replace(md[0], '').trim();
      } else {
        const md2 = s.match(/(\d{1,2})\/(\d{1,2})(?!\d)/);
        if (md2) {
          out.startAt.setMonth(+md2[1]-1, +md2[2]);
          if (out.startAt.getTime() < Date.now() - 86400000) out.startAt.setFullYear(out.startAt.getFullYear() + 1);
          s = s.replace(md2[0], '').trim();
        }
      }
    }

    // 4) Time: '오후 3시 반', '15시 30분', '3:30', '14:00'
    let hasTime = false;
    const apm = s.match(/(오전|오후|아침|점심|저녁|새벽|밤)/);
    let ampmShift = 0;
    if (apm) {
      if (['오후','저녁','밤'].includes(apm[1])) ampmShift = 12;
      s = s.replace(apm[0], '').trim();
    }
    const hhmm = s.match(/(\d{1,2})\s*[시:]\s*(\d{0,2})\s*분?/);
    if (hhmm) {
      let h = +hhmm[1];
      const m = hhmm[2] ? +hhmm[2] : 0;
      if (ampmShift && h < 12) h += ampmShift;
      if (ampmShift === 12 && h === 12) h = 12;
      if (!ampmShift && h === 12) h = 12;
      out.startAt.setHours(h, m, 0, 0);
      hasTime = true;
      s = s.replace(hhmm[0], '').trim();
    } else if (apm) {
      // '점심' = 12:00, '저녁' = 18:00, '아침' = 8:00
      const def = { '오전':9, '오후':13, '아침':8, '점심':12, '저녁':18, '새벽':6, '밤':21 };
      out.startAt.setHours(def[apm[1]] || 12, 0, 0, 0);
      hasTime = true;
    }
    if (s.match(/\b반\b/)) { out.startAt.setMinutes(30); s = s.replace('반', '').trim(); }

    if (!hasTime) out.allDay = true;

    out.title = s.trim() || '(제목 없음)';
    return out;
  }

  // ------- Relative formatter ---------------------------------------------
  function formatRelativeKR(target) {
    const now = new Date();
    const t = new Date(target);
    const diffMs = t.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '내일';
    if (diffDays === 2) return '모레';
    if (diffDays === -1) return '어제';
    if (diffDays > 0 && diffDays <= 14) return `D-${diffDays}`;
    if (diffDays < 0 && diffDays >= -14) return `D+${Math.abs(diffDays)}`;
    if (diffDays > 14) return `${diffDays}일 뒤`;
    return `${Math.abs(diffDays)}일 전`;
  }

  // ------- Recurring expansion --------------------------------------------
  // event.recurring = null | { freq: 'daily'|'weekly'|'monthly'|'yearly', interval, until, byDay?: [0-6] }
  // Returns occurrences within [rangeStart, rangeEnd] as array of Date objects
  function expandRecurring(event, rangeStart, rangeEnd) {
    const start = new Date(event.startAt);
    if (!event.recurring) return (start >= rangeStart && start <= rangeEnd) ? [start] : [];
    const rule = event.recurring;
    const occ = [];
    const until = rule.until ? new Date(rule.until) : new Date(rangeEnd);
    const hardCap = Math.min(until.getTime(), rangeEnd.getTime());
    const interval = Math.max(1, rule.interval || 1);
    let cursor = new Date(start);
    let safety = 0;
    while (cursor.getTime() <= hardCap && safety < 800) {
      if (cursor.getTime() >= rangeStart.getTime()) occ.push(new Date(cursor));
      switch (rule.freq) {
        case 'daily':  cursor.setDate(cursor.getDate() + interval); break;
        case 'weekly':
          if (rule.byDay && rule.byDay.length) {
            // Iterate day-by-day within a week and accept matching weekdays
            const weekStart = new Date(cursor);
            for (let i = 1; i <= 7; i++) {
              const d = new Date(weekStart);
              d.setDate(weekStart.getDate() + i);
              if (d.getTime() > hardCap) break;
              if (rule.byDay.includes(d.getDay()) && d.getTime() >= rangeStart.getTime()) occ.push(new Date(d));
              if ((i % 7 === 0)) cursor.setDate(cursor.getDate() + 7 * interval);
            }
            cursor.setDate(cursor.getDate() + 7 * interval);
          } else {
            cursor.setDate(cursor.getDate() + 7 * interval);
          }
          break;
        case 'monthly': cursor.setMonth(cursor.getMonth() + interval); break;
        case 'yearly':  cursor.setFullYear(cursor.getFullYear() + interval); break;
        default: return occ;
      }
      safety++;
    }
    return occ;
  }

  // ------- Convert date to YYYY-MM-DD key ---------------------------------
  function dateKey(d) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  }
  function monthKey(d) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
  }

  window.JANCalData = {
    KOREAN_HOLIDAYS,
    parseNaturalKR,
    formatRelativeKR,
    expandRecurring,
    dateKey,
    monthKey,
  };
})();
