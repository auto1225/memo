import { useState } from 'react'
import { importV1FromLocalStorage, exportV2ToJson, importV2FromJson } from '../lib/v1Import'
import { importMarkdownFiles } from '../lib/bulkImport'
import { useMemosStore } from '../store/memosStore'
import { useI18nStore } from '../lib/i18n'
import { useThemeStore } from '../store/themeStore'
import { useSettingsStore } from '../store/settingsStore'
import { syncNow, syncConfigured } from '../lib/supabaseSync'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [status, setStatus] = useState<string>('')
  const memos = useMemosStore((s) => Object.values(s.memos))
  const settings = useSettingsStore()
  const lang = useI18nStore((s) => s.lang)
  const setLang = useI18nStore((s) => s.setLang)
  const accent = useThemeStore((s) => s.accent)
  const setAccent = useThemeStore((s) => s.setAccent)

  function handleV1Import() {
    const result = importV1FromLocalStorage()
    setStatus(
      `v1 메모 ${result.imported}개 가져옴` +
      (result.skipped > 0 ? `, ${result.skipped}개 건너뜀` : '') +
      (result.errors.length > 0 ? `, 오류 ${result.errors.length}개` : '')
    )
  }

  function handleExport() {
    const json = exportV2ToJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `justanotepad-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus(`${memos.length}개 메모 백업 완료`)
  }

  async function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      const result = importV2FromJson(text)
      setStatus(
        `백업 ${result.imported}개 가져옴` +
        (result.skipped > 0 ? `, ${result.skipped}개 건너뜀` : '') +
        (result.errors.length > 0 ? `, 오류 ${result.errors.length}개` : '')
      )
    }
    input.click()
  }

  async function handleSync() {
    if (!syncConfigured()) {
      setStatus('Supabase URL / anon key / 이메일을 모두 입력하세요')
      return
    }
    setStatus('동기화 중...')
    const r = await syncNow()
    if (r.ok) setStatus(`동기화 완료 — push ${r.pushed}, pull ${r.pulled}`)
    else setStatus(`동기화 실패: ${r.error}`)
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>설정</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <section className="jan-settings-section">
            <h4>AI 제공자</h4>
            <div className="jan-settings-info">
              Ctrl+/ 로 AI 도우미 호출. 키는 브라우저 localStorage 에만 저장 (서버 전송 X).
            </div>
            <div className="jan-settings-row">
              <label>제공자:</label>
              <select
                value={settings.aiProvider}
                onChange={(e) => settings.setKey('aiProvider', e.target.value)}
              >
                <option value="none">사용 안 함</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="openai">OpenAI ChatGPT</option>
                <option value="proxy">서버 프록시 (키 불필요)</option>
              </select>
            </div>
            {settings.aiProvider === 'anthropic' && (
              <>
                <input
                  type="password"
                  placeholder="Anthropic API key (sk-ant-...)"
                  value={settings.anthropicKey}
                  onChange={(e) => settings.setKey('anthropicKey', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="모델명 (기본: claude-sonnet-4-6)"
                  value={settings.aiModel}
                  onChange={(e) => settings.setKey('aiModel', e.target.value)}
                />
              </>
            )}
            {settings.aiProvider === 'openai' && (
              <>
                <input
                  type="password"
                  placeholder="OpenAI API key (sk-...)"
                  value={settings.openaiKey}
                  onChange={(e) => settings.setKey('openaiKey', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="모델명 (예: gpt-4o-mini)"
                  value={settings.aiModel}
                  onChange={(e) => settings.setKey('aiModel', e.target.value)}
                />
              </>
            )}
            {settings.aiProvider === 'proxy' && (
              <>
                <div className="jan-settings-info" style={{padding:'8px 10px',background:'rgba(76,175,80,0.08)',borderLeft:'3px solid #4caf50',borderRadius:4,marginTop:6}}>
                  서버 프록시 모드 — 사용자 키 불필요. 서버에서 forward.
                </div>
                <input type="text" placeholder="모델명 (claude-sonnet-4-6 또는 gpt-4o-mini)" value={settings.aiModel} onChange={(e) => settings.setKey('aiModel', e.target.value)} />
              </>
            )}
          </section>

          <section className="jan-settings-section">
            <h4>Supabase 클라우드 동기화 (선택)</h4>
            <div className="jan-settings-info">
              선택사항. Supabase 프로젝트의 URL + anon key + 본인 이메일을 입력하면
              메모를 클라우드에 동기화. RLS 정책은 사용자가 직접 설정해야 함.
            </div>
            <input
              type="text"
              placeholder="Supabase URL (https://xxxx.supabase.co)"
              value={settings.supabaseUrl}
              onChange={(e) => settings.setKey('supabaseUrl', e.target.value)}
            />
            <input
              type="password"
              placeholder="anon key"
              value={settings.supabaseAnonKey}
              onChange={(e) => settings.setKey('supabaseAnonKey', e.target.value)}
            />
            <input
              type="email"
              placeholder="이메일 (owner_email)"
              value={settings.supabaseEmail}
              onChange={(e) => settings.setKey('supabaseEmail', e.target.value)}
            />
            <div className="jan-settings-actions">
              <button onClick={handleSync}>지금 동기화</button>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>데이터 관리</h4>
            <div className="jan-settings-info">
              현재 v2 메모: <b>{memos.length}개</b>
            </div>
            <div className="jan-settings-actions">
              <button onClick={handleExport}>JSON 백업 내보내기</button>
              <button onClick={handleImport}>백업 가져오기</button>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>Markdown 일괄 가져오기</h4>
            <div className="jan-settings-info">
              .md 파일들을 선택하면 각 파일이 별도 메모로 추가됩니다. 첫 줄 # 제목이 있으면 자동 인식.
            </div>
            <div className="jan-settings-actions">
              <button onClick={async () => {
                const input = document.createElement('input')
                input.type = 'file'
                input.multiple = true
                input.accept = '.md,text/markdown'
                input.onchange = async (e) => {
                  const files = Array.from((e.target as HTMLInputElement).files || [])
                  if (files.length === 0) return
                  const r = await importMarkdownFiles(files)
                  setStatus(`Markdown 가져오기: 가져옴 ${r.imported}, 건너뜀 ${r.skipped}, 오류 ${r.errors.length}`)
                }
                input.click()
              }}>Markdown 파일 선택</button>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>v1 메모 가져오기</h4>
            <div className="jan-settings-info">
              이전 버전 (justanotepad.com/legacy) 의 메모를 v2 로 변환합니다.
            </div>
            <div className="jan-settings-actions">
              <button onClick={handleV1Import}>v1 메모 가져오기</button>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>실시간 협업 (Yjs)</h4>
            <div className="jan-settings-info">
              WebSocket URL + 룸 이름 + 사용자명. 같은 룸의 다른 사용자와 동시 편집.
              테스트 서버: wss://demos.yjs.dev/ws (영속 X)
            </div>
            <input
              type="text"
              placeholder="WebSocket URL"
              value={settings.collabWsUrl}
              onChange={(e) => settings.setKey('collabWsUrl', e.target.value)}
            />
            <input
              type="text"
              placeholder="룸 이름 (예: my-shared-doc)"
              value={settings.collabRoom}
              onChange={(e) => settings.setKey('collabRoom', e.target.value)}
            />
            <input
              type="text"
              placeholder="사용자명 (커서에 표시)"
              value={settings.collabUserName}
              onChange={(e) => settings.setKey('collabUserName', e.target.value)}
            />
            <div className="jan-settings-actions">
              <button onClick={() => { settings.setKey('collabEnabled', !settings.collabEnabled); setStatus(settings.collabEnabled ? '협업 중지 — 새로고침 후 적용' : '협업 시작 — 새로고침 후 적용') }}>
                {settings.collabEnabled ? '협업 중지' : '협업 시작'}
              </button>
            </div>
          </section>

                    <section className="jan-settings-section">
            <h4>액센트 색상</h4>
            <div className="jan-settings-info">기본 #D97757 (테라코타) 또는 사용자 색상.</div>
            <div className="jan-settings-actions">
              {(['#D97757','#1976D2','#388E3C','#7B1FA2','#FBC02D','#E91E63','#5D4037','#00838F'] as string[]).map((c) => (
                <button key={c} onClick={() => setAccent(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: accent === c ? '3px solid #333' : '1px solid #ccc', cursor: 'pointer', padding: 0 }} aria-label={c} />
              ))}
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 32, height: 28, padding: 0, border: '1px solid #ccc', borderRadius: 4 }} />
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>언어 / Language</h4>
            <div className="jan-settings-row">
              <label>언어:</label>
              <select value={lang} onChange={(e) => setLang(e.target.value as any)}>
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>버전 정보</h4>
            <div className="jan-settings-info">
              JustANotepad v2 (Beta) — TipTap 기반<br />
              Phase 5 (AI / Supabase / 인쇄 / 논문 / 역할 / HWPX / JustPin)
            </div>
          </section>

          {status && <div className="jan-settings-status">{status}</div>}
        </div>
      </div>
    </div>
  )
}
