/**
 * Service worker: registers context menus and keyboard command,
 * grabs the current tab's page data, and stores it via Supabase REST.
 */

import { saveClip } from './supabase-shim.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'jnp-clip-page',
    title: '전체 페이지를 JustANotepad에 저장',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'jnp-clip-selection',
    title: '선택한 영역만 JustANotepad에 저장',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'jnp-clip-link',
    title: '이 링크를 JustANotepad에 저장',
    contexts: ['link'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'jnp-clip-selection' && info.selectionText) {
      await clipSelection(tab, info.selectionText);
    } else if (info.menuItemId === 'jnp-clip-link') {
      await clipLink(info.linkUrl, info.selectionText || info.linkUrl);
    } else {
      await clipPage(tab);
    }
    notify('✓ JustANotepad에 저장됨', tab.title || '');
  } catch (e) {
    notify('저장 실패', e.message || '로그인이 필요할 수 있습니다.');
  }
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'clip-page') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    await clipPage(tab);
    notify('✓ 저장됨', tab.title || '');
  } catch (e) {
    notify('저장 실패', e.message);
  }
});

async function clipPage(tab) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPage,
  });
  await saveClip({
    url: tab.url,
    title: tab.title,
    html: result?.html || '',
    text: result?.text || '',
    excerpt: (result?.text || '').slice(0, 240),
    tags: [],
  });
}

async function clipSelection(tab, text) {
  await saveClip({
    url: tab.url, title: tab.title,
    html: '', text, excerpt: text.slice(0, 240), tags: ['selection'],
  });
}

async function clipLink(url, label) {
  await saveClip({
    url, title: label || url, html: '', text: '',
    excerpt: label || url, tags: ['link'],
  });
}

function extractPage() {
  // Prefer <article>, <main>, else <body>
  const root = document.querySelector('article')
            || document.querySelector('main')
            || document.body;
  if (!root) return { html: '', text: document.title };
  const html = root.outerHTML.slice(0, 500000);  // 500KB cap
  const text = (root.innerText || '').slice(0, 100000);
  return { html, text };
}

function notify(title, message) {
  chrome.notifications?.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title, message: message || '',
  });
}

// Accept a sign-in handshake from justanotepad.com via runtime messaging.
// The landing page sends the session once the user logs in (optional nicety).
chrome.runtime.onMessageExternal?.addListener(async (msg, _sender, sendResponse) => {
  if (msg?.type !== 'jnp-login' || !msg.access_token) {
    sendResponse({ ok: false });
    return;
  }
  await chrome.storage.local.set({
    jnp_access_token:  msg.access_token,
    jnp_refresh_token: msg.refresh_token,
    jnp_expires_at:    Math.floor(Date.now()/1000) + (msg.expires_in || 3600),
    jnp_user_email:    msg.email || null,
  });
  sendResponse({ ok: true });
});
