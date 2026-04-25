import { useState } from 'react'
import type { Editor } from '@tiptap/react'

interface AiHelperProps {
  editor: Editor | null
  onClose: () => void
}

type AiMode = 'summarize' | 'translate' | 'improve' | 'continue'

const MODE_LABELS: Record<AiMode, string> = {
  summarize: '요약',
  translate: '번역 (영문)',
  improve: '문장 다듬기',
  continue: '이어쓰기',
}

export function AiHelper({ editor, onClose }: AiHelperProps) {
  const [mode, setMode] = useState<AiMode>('summarize')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  if (!editor) return null

  const selection = editor.state.selection
  const hasSelection = !selection.empty
  const inputText = hasSelection
    ? editor.state.doc.textBetween(selection.from, selection.to, ' ')
    : editor.state.doc.textContent

  async function run() {
    setLoading(true)
    setOutput('')
    try {
      await new Promise((r) => setTimeout(r, 800))
      setOutput(
        `[AI ${MODE_LABELS[mode]} 결과 - 데모]\n\n원본 길이: ${inputText.length}자\n\n` +
        '실제 AI 응답을 받으려면 설정에서 Claude/GPT API 키를 입력하세요.\n' +
        '향후 업데이트에서 활성화됩니다.'
      )
    } finally {
      setLoading(false)
    }
  }

  function applyToEditor() {
    if (!output || !editor) return
    if (hasSelection) {
      editor.chain().focus().insertContentAt(selection.to, '\n' + output).run()
    } else {
      editor.chain().focus().insertContent('\n' + output).run()
    }
    onClose()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>AI 도우미</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-ai-modes">
            {(Object.keys(MODE_LABELS) as AiMode[]).map((m) => (
              <button
                key={m}
                className={'jan-ai-mode' + (mode === m ? ' is-active' : '')}
                onClick={() => setMode(m)}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <div className="jan-ai-input-info">
            {hasSelection
              ? `선택된 ${selection.to - selection.from}자에 대해 적용`
              : `문서 전체 (${inputText.length}자) 에 대해 적용`}
          </div>
          <button className="jan-ai-run" onClick={run} disabled={loading}>
            {loading ? '실행 중...' : `${MODE_LABELS[mode]} 실행`}
          </button>
          {output && (
            <>
              <div className="jan-ai-output" style={{ whiteSpace: 'pre-wrap' }}>{output}</div>
              <button className="jan-ai-apply" onClick={applyToEditor}>문서에 삽입</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
