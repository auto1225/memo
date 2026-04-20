#!/usr/bin/env node
/**
 * JustANotepad — Release automation
 * --------------------------------------------------------------------------
 * One command does everything: bump version, sync all version files, commit,
 * tag, push main + tag (which triggers Vercel deploy for web + GitHub
 * Actions for desktop installers).
 *
 * Usage:
 *   npm run release                 # patch bump (1.0.19 → 1.0.20)
 *   npm run release -- patch        # same
 *   npm run release -- minor        # 1.0.19 → 1.1.0
 *   npm run release -- major        # 1.0.19 → 2.0.0
 *   npm run release -- 1.2.3        # exact version
 *   npm run release -- patch --dry  # print plan, do not write/commit/push
 *   npm run release -- patch --no-push  # bump+commit+tag but skip push
 *
 * Auth:
 *   Uses whatever git remote auth is already configured (ssh key, credential
 *   helper, ~/.netrc, or a GH_TOKEN env var). No tokens are hard-coded.
 *   If GH_TOKEN is set AND the remote is https://github.com/..., push will
 *   use it inline for this one operation.
 *
 * What it does NOT do:
 *   - Run tests (you're expected to verify locally first)
 *   - Edit changelog files (release notes are built from git log into the
 *     annotated tag message, which GitHub shows on the Release page).
 * --------------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
process.chdir(repoRoot);

const args = process.argv.slice(2);
const flags = {
  dry: args.includes('--dry') || args.includes('--dry-run'),
  noPush: args.includes('--no-push'),
};
const positional = args.filter(a => !a.startsWith('--'));
const bumpArg = positional[0] || 'patch';

/* --------- Helpers --------- */
function sh(cmd, opts = {}) {
  if (flags.dry && opts.mutates) {
    console.log('  [DRY-RUN] $ ' + cmd);
    return '';
  }
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

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[.-].*)?$/.exec(v || '');
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function bumpVersion(current, kind) {
  const v = parseSemver(current);
  if (!v) throw new Error('Current version is not semver: ' + current);
  if (parseSemver(kind)) return kind; // exact version argument
  if (kind === 'major') return `${v.major + 1}.0.0`;
  if (kind === 'minor') return `${v.major}.${v.minor + 1}.0`;
  if (kind === 'patch') return `${v.major}.${v.minor}.${v.patch + 1}`;
  throw new Error('Unknown bump kind: ' + kind + ' (use patch/minor/major or an exact x.y.z)');
}

function updateVersionFiles(newVer) {
  const pkg = readJson('package.json');
  const oldVer = pkg.version;
  if (oldVer === newVer) {
    throw new Error(`package.json is already at ${newVer}`);
  }

  // All files that carry a coordinated version number
  const targets = [
    { path: 'package.json' },
    { path: 'version.json' },
    { path: 'src-tauri/tauri.conf.json' },
  ];
  for (const t of targets) {
    if (!fs.existsSync(t.path)) continue;
    const j = readJson(t.path);
    if (j.version === undefined) continue;
    j.version = newVer;
    if (flags.dry) {
      console.log(`  [DRY-RUN] Would write ${t.path}: ${oldVer} → ${newVer}`);
    } else {
      writeJson(t.path, j);
      console.log(`  \x1b[32m✓\x1b[0m ${t.path}: ${oldVer} → ${newVer}`);
    }
  }
  return oldVer;
}

function lastTag() {
  return sh('git describe --tags --abbrev=0', { pipe: true, allowFail: true }) || '';
}

function buildReleaseNotes(oldVer, newVer) {
  const prev = lastTag();
  const range = prev ? `${prev}..HEAD` : 'HEAD';
  const log = sh(`git log ${range} --pretty=format:"- %s" --no-merges`, { pipe: true, allowFail: true }) || '';
  const lines = log.split('\n').filter(Boolean);
  const capped = lines.length > 30 ? lines.slice(0, 30).join('\n') + '\n- … (+' + (lines.length - 30) + ' more)' : lines.join('\n');
  return [
    `v${newVer}`,
    '',
    prev ? `Previous: ${prev}` : '(initial release)',
    '',
    capped || '(no commits since last tag)',
  ].join('\n');
}

function remoteUrlWithAuth() {
  const url = sh('git config --get remote.origin.url', { pipe: true, allowFail: true }) || '';
  const tok = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (tok && /^https:\/\/github\.com\//.test(url)) {
    // inject "user:token@" just for this push — does NOT modify git config
    const user = process.env.GH_USER || 'x-access-token';
    return url.replace('https://', `https://${user}:${tok}@`);
  }
  return 'origin';
}

function gitStatus() {
  const out = sh('git status --porcelain', { pipe: true }) || '';
  return out.split('\n').filter(Boolean);
}

/* --------- Main --------- */
(function main() {
  const pkg = readJson('package.json');
  const current = pkg.version;
  const target = bumpVersion(current, bumpArg);
  const tag = 'v' + target;

  console.log(`\n🚀 JustANotepad release\n─────────────────────────────────────`);
  console.log(`  현재 버전:   ${current}`);
  console.log(`  새 버전:     ${target}  (태그: ${tag})`);
  if (flags.dry) console.log(`  모드:        \x1b[33mDRY-RUN\x1b[0m (쓰기/커밋/푸시 안 함)`);
  if (flags.noPush && !flags.dry) console.log(`  모드:        \x1b[33m--no-push\x1b[0m (로컬 태그까지만)`);

  // 1) Guard: existing dirty working tree
  const dirty = gitStatus();
  if (dirty.length && !flags.dry) {
    console.log('\n⚠️  작업 트리에 커밋 안 된 변경사항이 있습니다:');
    dirty.slice(0, 10).forEach(l => console.log('   ' + l));
    if (dirty.length > 10) console.log('   … +' + (dirty.length - 10));
    console.log('\n먼저 커밋하거나 stash 한 뒤 다시 시도하세요.');
    process.exit(1);
  }

  // 2) Guard: tag must not exist
  const tagExists = sh(`git rev-parse --verify ${tag}`, { pipe: true, allowFail: true });
  if (tagExists && !flags.dry) {
    console.error(`\n✗ 태그 ${tag} 가 이미 존재합니다. 다른 버전을 쓰세요.`);
    process.exit(1);
  }

  // 3) Update version files
  console.log('\n📝 버전 파일 업데이트');
  updateVersionFiles(target);

  // 4) Commit
  console.log('\n📦 커밋');
  const commitMsg = `chore(release): v${target}`;
  if (!flags.dry) {
    sh(`git add package.json version.json src-tauri/tauri.conf.json`, { mutates: true });
    sh(`git commit -m ${JSON.stringify(commitMsg)}`, { mutates: true });
    console.log(`  \x1b[32m✓\x1b[0m ${commitMsg}`);
  } else {
    console.log(`  [DRY-RUN] git commit -m "${commitMsg}"`);
  }

  // 5) Build release notes & create annotated tag
  console.log('\n🏷  태그 생성');
  const notes = buildReleaseNotes(current, target);
  if (!flags.dry) {
    // Write to a temp file to avoid shell escaping hell
    const tmp = path.join(require('os').tmpdir(), `release-${Date.now()}.txt`);
    fs.writeFileSync(tmp, notes, 'utf8');
    sh(`git tag -a ${tag} -F ${JSON.stringify(tmp)}`, { mutates: true });
    try { fs.unlinkSync(tmp); } catch {}
    console.log(`  \x1b[32m✓\x1b[0m ${tag} 태그 생성`);
    console.log('\n📄 릴리스 노트 미리보기:');
    console.log(notes.split('\n').map(l => '   ' + l).join('\n'));
  } else {
    console.log(`  [DRY-RUN] git tag -a ${tag} -F <notes>`);
    console.log('\n📄 릴리스 노트 미리보기:');
    console.log(notes.split('\n').map(l => '   ' + l).join('\n'));
  }

  // 6) Push
  if (flags.noPush || flags.dry) {
    console.log('\n⏸  Push 건너뜀 (--no-push 또는 --dry). 수동으로 완료하려면:');
    console.log('    git push origin main');
    console.log(`    git push origin ${tag}`);
    return;
  }

  console.log('\n🚢 Push');
  const remote = remoteUrlWithAuth();
  // Push main first (without token-in-url exposure if possible)
  sh(`git push ${JSON.stringify(remote)} main`, { mutates: true, pipe: true });
  console.log('  \x1b[32m✓\x1b[0m main branch pushed');
  sh(`git push ${JSON.stringify(remote)} ${tag}`, { mutates: true, pipe: true });
  console.log(`  \x1b[32m✓\x1b[0m tag ${tag} pushed`);

  console.log('\n✅ 완료\n');
  console.log('  🌐 웹:      Vercel이 main push를 감지해 자동배포 (~1분)');
  console.log('  💻 데스크톱: GitHub Actions가 tag ' + tag + ' 를 감지해 설치 파일 빌드 (~20분)');
  console.log(`    → https://github.com/auto1225/memo/actions`);
  console.log(`    → https://github.com/auto1225/memo/releases/tag/${tag}`);
  console.log('');
})();
