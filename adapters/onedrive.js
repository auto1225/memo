/* JustANotepad — OneDrive Storage Adapter (STUB / 준비 중)
 *
 * 향후 구현 예정. Microsoft Graph API + MSAL.js 기반.
 * 지금은 스텁 — 어댑터 매니저에 등록되며 isConfigured() === false.
 */
(function () {
  'use strict';
  if (!window.JANStorage || !window.JANStorage.Adapter) return;
  class OneDriveAdapter extends window.JANStorage.Adapter {
    constructor() { super('onedrive'); }
    async init() { throw new Error('OneDrive 어댑터는 아직 구현되지 않았습니다. Dropbox 또는 로컬 폴더 방식을 사용해주세요.'); }
    async list() { throw new Error('not implemented yet'); }
    async read() { throw new Error('not implemented yet'); }
    async write() { throw new Error('not implemented yet'); }
    async delete() { throw new Error('not implemented yet'); }
    isConfigured() { return false; }
    isComingSoon() { return true; }
  }
  const inst = new OneDriveAdapter();
  window.JANStorage.register(inst);
  window.JANStorage.adapters = window.JANStorage.adapters || {};
  window.JANStorage.adapters.onedrive = inst;
})();
