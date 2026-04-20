import { saveClip, isSignedIn, getUserEmail, signOut } from './supabase-shim.js';
import { APP_URL } from './config.js';

const $ = (id) => document.getElementById(id);
let currentTab = null;

async function init() {
  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (currentTab) $('clipTitle').value = currentTab.title || '';

  const signed = await isSignedIn();
  $('gate').style.display = signed ? 'none'  : 'block';
  $('app').style.display  = signed ? 'block' : 'none';

  if (signed) {
    const email = await getUserEmail();
    $('who').innerHTML = `<span>✓ 로그인됨 · ${email || ''}</span>
      <button class="btn" style="padding:3px 8px;font-size:10px;margin-left:auto;" id="btnSignOut">로그아웃</button>`;
    $('btnSignOut').addEventListener('click', async () => { await signOut(); init(); });
  }
}
init();

$('btnLogin').addEventListener('click', () => {
  chrome.tabs.create({ url: APP_URL + '/extension-connect' });
});
$('btnRefresh').addEventListener('click', init);

$('btnFull').addEventListener('click', async () => {
  await doClip('full');
});
$('btnSelection').addEventListener('click', async () => {
  await doClip('selection');
});
$('btnUrlOnly').addEventListener('click', async () => {
  await doClip('url');
});
$('btnOpenInbox').addEventListener('click', () => {
  chrome.tabs.create({ url: APP_URL + '/app?view=clips' });
});

async function doClip(mode) {
  const status = $('status');
  status.className = 'status';
  status.textContent = '저장 중…';
  try {
    const tags = $('clipTags').value.split(',').map(s => s.trim()).filter(Boolean);
    const note = $('clipNote').value;
    const title = $('clipTitle').value || currentTab?.title || '';
    let payload = { url: currentTab?.url || '', title, html: '', text: '', excerpt: note || '', tags };

    if (mode === 'full' || mode === 'selection') {
      const [{ result } = {}] = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: mode === 'selection' ? extractSelection : extractPage,
      });
      payload.html = result?.html || '';
      payload.text = result?.text || '';
      payload.excerpt = note || (result?.text || '').slice(0, 240);
    }

    await saveClip(payload);
    status.className = 'status ok';
    status.textContent = '✓ 수신함에 저장되었습니다. Enter로 계속.';
    $('clipNote').value = '';
    $('clipTags').value = '';
  } catch (e) {
    status.className = 'status err';
    if (e.message === 'NOT_SIGNED_IN') {
      status.textContent = '로그인이 필요합니다. justanotepad.com 열어주세요.';
      $('gate').style.display = 'block';
      $('app').style.display  = 'none';
    } else {
      status.textContent = '실패: ' + e.message;
    }
  }
}

function extractPage() {
  const root = document.querySelector('article') || document.querySelector('main') || document.body;
  if (!root) return { html: '', text: document.title };
  return {
    html: root.outerHTML.slice(0, 500000),
    text: (root.innerText || '').slice(0, 100000),
  };
}

function extractSelection() {
  const sel = window.getSelection();
  const text = sel ? sel.toString() : '';
  let html = '';
  if (sel && sel.rangeCount) {
    const div = document.createElement('div');
    for (let i = 0; i < sel.rangeCount; i++) div.appendChild(sel.getRangeAt(i).cloneContents());
    html = div.innerHTML.slice(0, 500000);
  }
  return { html, text: text.slice(0, 100000) };
}
