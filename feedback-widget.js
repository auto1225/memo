/**
 * JustANotepad — Feedback widget
 * --------------------------------------------------------------------------
 * Injects a subtle "💬 피드백" pill in the bottom-right corner. Click to open
 * a modal with: category dropdown, rating 1-5, message textarea, optional
 * email. Submits to cms_feedback via anon REST (RLS allows anon INSERT,
 * blocks SELECT so the submission is write-only).
 *
 * Consuming pages load /feedback-widget.js — no other setup needed.
 * Pages that don't want it can set window.__janNoFeedback = true before
 * this script loads.
 * --------------------------------------------------------------------------
 */
(() => {
  'use strict';
  if (window.__janFeedbackWidget__ || window.__janNoFeedback) return;
  window.__janFeedbackWidget__ = true;

  const URL_ = window.SUPABASE_URL;
  const KEY  = window.SUPABASE_ANON_KEY;
  if (!URL_ || !KEY) return;

  const css = `
    .jan-fb-btn {
      position:fixed; right:20px; bottom:20px; z-index:9990;
      padding:10px 16px; background:#141414; color:#fff;
      border:0; border-radius:999px; font-size:13px; font-weight:600;
      cursor:pointer; box-shadow:0 6px 18px rgba(0,0,0,0.2);
      font-family:inherit; display:flex; align-items:center; gap:6px;
      transition:transform 0.15s;
    }
    .jan-fb-btn:hover { transform:translateY(-2px); }
    .jan-fb-overlay {
      position:fixed; inset:0; z-index:10001;
      background:rgba(20,20,20,0.45); backdrop-filter:blur(4px);
      display:flex; align-items:center; justify-content:center;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Noto Sans KR",sans-serif;
    }
    .jan-fb-card {
      background:#fff; width:min(440px, 94vw); max-height:92vh;
      border-radius:12px; overflow-y:auto;
      box-shadow:0 20px 60px rgba(0,0,0,0.18);
      padding:22px 24px;
      color:#1f2937;
    }
    .jan-fb-card h2 { margin:0 0 6px; font-size:17px; font-weight:700; }
    .jan-fb-card .desc { color:#6b7280; font-size:12px; margin:0 0 16px; }
    .jan-fb-field { margin-bottom:12px; }
    .jan-fb-field label { display:block; font-size:11px; color:#6b7280; margin-bottom:4px; font-weight:600; }
    .jan-fb-field input, .jan-fb-field select, .jan-fb-field textarea {
      width:100%; padding:8px 10px; border:1px solid #e5e7eb; border-radius:7px;
      font-size:13px; font-family:inherit; box-sizing:border-box;
    }
    .jan-fb-field textarea { min-height:110px; resize:vertical; }
    .jan-fb-stars { display:flex; gap:4px; }
    .jan-fb-stars button {
      background:none; border:0; cursor:pointer; padding:0; color:#d1d5db;
      font-size:22px; line-height:1;
    }
    .jan-fb-stars button.on { color:#eab308; }
    .jan-fb-row { display:flex; gap:10px; margin-top:16px; }
    .jan-fb-row button {
      flex:1; padding:10px 16px; border-radius:8px; font-size:13px;
      font-weight:600; cursor:pointer; font-family:inherit;
    }
    .jan-fb-row .ok { background:#141414; color:#fff; border:0; }
    .jan-fb-row .cancel { background:#fff; color:#1f2937; border:1px solid #e5e7eb; }
    .jan-fb-status { margin-top:10px; font-size:12px; min-height:16px; }
    .jan-fb-status.ok { color:#10b981; }
    .jan-fb-status.err { color:#b91c1c; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.className = 'jan-fb-btn';
  btn.setAttribute('aria-label', '피드백 보내기');
  btn.innerHTML = '<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>피드백</span>';
  if (document.body) document.body.appendChild(btn);
  else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(btn));

  btn.addEventListener('click', openModal);

  let rating = 0;

  function openModal() {
    const overlay = document.createElement('div');
    overlay.className = 'jan-fb-overlay';
    overlay.innerHTML = `
      <div class="jan-fb-card">
        <h2>피드백을 남겨주세요</h2>
        <p class="desc">무엇이 좋았나요, 무엇이 부족한가요? 익명도 좋고 이메일 남겨주시면 답장드릴게요.</p>

        <div class="jan-fb-field">
          <label>카테고리</label>
          <select id="jfbCat">
            <option value="">선택 안 함</option>
            <option value="bug">버그 / 오류</option>
            <option value="feature">기능 요청</option>
            <option value="ui">디자인 · UX</option>
            <option value="perf">속도 · 성능</option>
            <option value="other">기타</option>
          </select>
        </div>

        <div class="jan-fb-field">
          <label>별점</label>
          <div class="jan-fb-stars" id="jfbStars">
            ${[1,2,3,4,5].map(n => `<button type="button" data-n="${n}" aria-label="${n}점">★</button>`).join('')}
          </div>
        </div>

        <div class="jan-fb-field">
          <label>내용 (필수, 5000자 이내)</label>
          <textarea id="jfbMsg" placeholder="쓰면서 느낀 점, 불편한 점, 아이디어 무엇이든"></textarea>
        </div>

        <div class="jan-fb-field">
          <label>이메일 (선택)</label>
          <input id="jfbEmail" type="email" placeholder="your@email.com">
        </div>

        <div class="jan-fb-status" id="jfbStatus"></div>

        <div class="jan-fb-row">
          <button type="button" class="cancel" id="jfbCancel">취소</button>
          <button type="button" class="ok" id="jfbSend">보내기</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#jfbCancel').addEventListener('click', close);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); }
    });

    rating = 0;
    overlay.querySelectorAll('.jan-fb-stars button').forEach((b, i) => {
      b.addEventListener('click', () => {
        rating = parseInt(b.dataset.n);
        overlay.querySelectorAll('.jan-fb-stars button').forEach((bb, j) => {
          bb.classList.toggle('on', j < rating);
        });
      });
    });

    overlay.querySelector('#jfbSend').addEventListener('click', async () => {
      const msg = overlay.querySelector('#jfbMsg').value.trim();
      const email = overlay.querySelector('#jfbEmail').value.trim();
      const category = overlay.querySelector('#jfbCat').value;
      const statusEl = overlay.querySelector('#jfbStatus');
      if (!msg) {
        statusEl.className = 'jan-fb-status err';
        statusEl.textContent = '내용을 입력해주세요.';
        return;
      }
      if (msg.length > 5000) {
        statusEl.className = 'jan-fb-status err';
        statusEl.textContent = '내용이 5000자를 초과했습니다.';
        return;
      }
      statusEl.className = 'jan-fb-status';
      statusEl.textContent = '전송 중…';

      try {
        const payload = {
          message: msg,
          email: email || null,
          rating: rating || null,
          category: category || null,
          url: location.href.slice(0, 300),
          user_agent: navigator.userAgent.slice(0, 300),
        };
        const r = await fetch(URL_ + '/rest/v1/cms_feedback', {
          method: 'POST',
          headers: {
            'apikey': KEY,
            'Authorization': 'Bearer ' + KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        statusEl.className = 'jan-fb-status ok';
        statusEl.textContent = '✓ 감사합니다! 피드백이 전달되었습니다.';
        setTimeout(close, 1500);
      } catch (e) {
        statusEl.className = 'jan-fb-status err';
        statusEl.textContent = '전송 실패: ' + e.message;
      }
    });
  }
})();
