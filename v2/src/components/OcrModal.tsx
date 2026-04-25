import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { ocrImage } from '../lib/ocr'

interface OcrModalProps {
  editor: Editor | null
  onClose: () => void
}

/**
 * Phase 14 — OCR 모달.
 * 이미지 파일 선택 → Tesseract.js 로 텍스트 추출 → 메모에 삽입.
 */
export function OcrModal({ editor, onClose }: OcrModalProps) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [lang, setLang] = useState('kor+eng')
  const [filename, setFilename] = useState('')

  async function pickAndRun() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setFilename(file.name)
      setBusy(true)
      setProgress(0)
      setError('')
      setResult('')
      try {
        const text = await ocrImage(file, lang, (p) => setProgress(p))
        setResult(text.trim())
      } catch (err: any) {
        setError(err?.message || String(err))
      } finally {
        setBusy(false)
        setProgress(1)
      }
    }
    input.click()
  }

  function insert() {
    if (!editor || !result) return
    editor.chain().focus().insertContent(result.replace(/\n/g, '<br>')).run()
    onClose()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-ocr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>OCR — 이미지에서 텍스트 추출</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-settings-info">
            Tesseract.js (CDN) 가 처음 로드될 때 ~3MB 다운로드. 이후 캐시.
          </div>
          <div className="jan-settings-row">
            <label>언어:</label>
            <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={busy}>
              <option value="kor+eng">한국어 + 영어</option>
              <option value="kor">한국어</option>
              <option value="eng">영어</option>
              <option value="jpn+eng">일본어 + 영어</option>
              <option value="chi_sim+eng">중국어 (간체) + 영어</option>
            </select>
          </div>
          <div className="jan-settings-actions">
            <button onClick={pickAndRun} disabled={busy}>
              {busy ? '추출 중...' : '이미지 선택'}
            </button>
          </div>
          {filename && <div className="jan-settings-info">파일: {filename}</div>}
          {busy && (
            <div className="jan-ocr-progress">
              <div className="jan-ocr-progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
              <span>{Math.round(progress * 100)}%</span>
            </div>
          )}
          {error && <div className="jan-ai-error">{error}</div>}
          {result && (
            <>
              <div className="jan-settings-info">{result.length}자 추출됨</div>
              <textarea
                value={result}
                onChange={(e) => setResult(e.target.value)}
                rows={10}
                style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontFamily: 'inherit', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 }}
              />
              <div className="jan-settings-actions">
                <button onClick={insert} className="primary" style={{ background: '#D97757', color: '#fff', border: 0, padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
                  메모에 삽입
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
