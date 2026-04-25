import { useState } from 'react'
import { importV1FromLocalStorage, exportV2ToJson, importV2FromJson } from '../lib/v1Import'
import { useMemosStore } from '../store/memosStore'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [status, setStatus] = useState<string>('')
  const memos = useMemosStore((s) => Object.values(s.memos))

  function handleV1Import() {
    const result = importV1FromLocalStorage()
    setStatus(`v1 메모 ${result.imported}개 가져옴` + (result.skipped > 0 ? `, ${result.skipped}개 건너뜀` : '') + (result.errors.length > 0 ? `, 오류 ${result.errors.length}개` : ''))
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
      setStatus(`백업 ${result.imported}개 가져옴` + (result.skipped > 0 ? `, ${result.skipped}개 건너뜀` : '') + (result.errors.length > 0 ? `, 오류 ${result.errors.length}개` : ''))
    }
    input.click()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>설정</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <section className="jan-settings-section">
            <h4>데이터 관리</h4>
            <div className="jan-settings-info">현재 v2 메모: <b>{memos.length}개</b></div>
            <div className="jan-settings-actions">
              <button onClick={handleExport}>JSON 백업 내보내기</button>
              <button onClick={handleImport}>백업 가져오기</button>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>v1 메모 가져오기</h4>
            <div className="jan-settings-info">
              이전 버전 (justanotepad.com/legacy) 의 메모를 v2 로 변환합니다.
              localStorage 의 jan-tabs / jan-content / jan:tab:* 키를 검색.
            </div>
            <div className="jan-settings-actions">
              <button onClick={handleV1Import}>v1 메모 가져오기</button>
            </div>
          </section>

          <section className="jan-settings-section">
            <h4>버전 정보</h4>
            <div className="jan-settings-info">
              JustANotepad v2 (Beta) - TipTap 기반<br />
              Phase 4 (CommandPalette + AI + Import)
            </div>
          </section>

          {status && <div className="jan-settings-status">{status}</div>}
        </div>
      </div>
    </div>
  )
}
