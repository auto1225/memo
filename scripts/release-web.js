#!/usr/bin/env node
/**
 * JustANotepad — Web-only release
 * --------------------------------------------------------------------------
 * 웹 스크립트/HTML/CSS 만 바뀌었을 때 사용.
 *
 * 데스크톱 앱과 달리, 웹은 justanotepad.com 에서 바로 로드되므로 Vercel 배포
 * (약 1분) 만 하면 바로 반영됨. 데스크톱 Tauri 앱도 postit-desktop.js 같은
 * 웹 자산을 https://justanotepad.com 에서 읽어오므로 함께 반영됨.
 *
 * 이 스크립트는:
 *   1. main 에 pending 변경사항을 커밋해서 push (Vercel 자동 배포)
 *   2. 태그는 만들지 않음 → GitHub Actions Tauri 빌드(~20분) 트리거 X
 *
 * 즉 npm run release 대신 이걸 쓰면 "데스크톱 바이너리 재빌드 없이" 웹만 배포.
 *
 * 사용 시점:
 *   - JS / HTML / CSS / JSON 만 바뀜 (Rust 코드 변경 없음)
 *
 * 사용 X:
 *   - src-tauri/** 바뀜 → npm run release 써야 함 (데스크톱 재빌드 필요)
 *   - Cargo.toml 바뀜 → 데스크톱 재빌드 필요
 * --------------------------------------------------------------------------
 */
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
process.chdir(repoRoot);

function sh(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: opts.pipe ? 'pipe' : ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    if (opts.allowFail) return null;
    console.error('\x1b[31m✗\x1b[0m Command failed: ' + cmd);
    if (e.stdout) console.error(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
    process.exit(1);
  }
}

// Rust 변경이 있으면 경고
const changedFiles = sh('git diff --name-only HEAD~1 HEAD', { allowFail: true }) || '';
const stagedOrUnstaged = sh('git status --porcelain', { allowFail: true }) || '';
const touchedRust = [changedFiles, stagedOrUnstaged]
  .join('\n')
  .split('\n')
  .some(line => /src-tauri\//.test(line) || /Cargo\.(toml|lock)/.test(line));

console.log('\n🚀 JustANotepad web-only release');
console.log('─────────────────────────────────────');

if (touchedRust) {
  console.log('\x1b[33m⚠\x1b[0m  src-tauri/ 또는 Cargo 파일이 변경됨 — 데스크톱 재빌드 필요할 수 있음');
  console.log('   (이 경우 npm run release 를 써야 태그가 생성되어 설치 파일이 빌드됨)');
}

// 현재 브랜치 확인
const branch = sh('git rev-parse --abbrev-ref HEAD');
if (branch !== 'main') {
  console.error(`\x1b[31m✗\x1b[0m 현재 브랜치: ${branch}. main 에서만 사용하세요.`);
  process.exit(1);
}

// 커밋되지 않은 변경사항이 있으면 경고 (사용자가 미리 커밋했어야 함)
const status = sh('git status --porcelain');
if (status) {
  console.error('\x1b[31m✗\x1b[0m 커밋되지 않은 변경사항이 있음. 먼저 git commit 하세요.\n');
  console.error(status);
  process.exit(1);
}

// push
console.log('\n🚢 Push main');
const remoteUrl = sh('git remote get-url origin', { allowFail: true }) || '';
const token = process.env.GH_TOKEN;
let pushCmd = 'git push origin main';
if (token && remoteUrl.startsWith('https://github.com/')) {
  const authedUrl = remoteUrl.replace('https://', `https://x-access-token:${token}@`);
  pushCmd = `git push ${authedUrl} main`;
}
sh(pushCmd);
console.log('  \x1b[32m✓\x1b[0m main 브랜치 push 완료');

console.log('\n\x1b[32m✅ 완료\x1b[0m');
console.log('\n  🌐 웹:      Vercel 이 main push 를 감지해 자동 배포 (~1분)');
console.log('  💻 데스크톱: 재빌드 없음 (기존 앱이 Vercel 에서 새 스크립트 로드)');
console.log('\n  기존 데스크톱 앱 사용자는 앱 재시작만 하면 최신 웹 자산이 적용됩니다.');
