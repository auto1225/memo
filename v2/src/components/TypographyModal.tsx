import { useTypographyStore } from '../store/typographyStore'

interface TypographyModalProps {
  onClose: () => void
}

export function TypographyModal({ onClose }: TypographyModalProps) {
  const t = useTypographyStore()

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-typography-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>타이포그래피</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-settings-row">
            <label>글꼴:</label>
            <select value={t.fontFamily} onChange={(e) => t.setFontFamily(e.target.value as any)}>
              <option value="sans">Sans-serif (기본)</option>
              <option value="serif">Serif (명조)</option>
              <option value="mono">Monospace (D2Coding)</option>
            </select>
          </div>
          <div className="jan-settings-row">
            <label>글자 크기:</label>
            <input type="range" min={12} max={22} step={1} value={t.fontSize} onChange={(e) => t.setFontSize(Number(e.target.value))} />
            <span>{t.fontSize}px</span>
          </div>
          <div className="jan-settings-row">
            <label>줄 간격:</label>
            <input type="range" min={1.2} max={2.4} step={0.1} value={t.lineHeight} onChange={(e) => t.setLineHeight(Number(e.target.value))} />
            <span>{t.lineHeight.toFixed(1)}</span>
          </div>
          <div className="jan-settings-row">
            <label>단락 간격:</label>
            <input type="range" min={0} max={24} step={1} value={t.paragraphSpacing} onChange={(e) => t.setParagraphSpacing(Number(e.target.value))} />
            <span>{t.paragraphSpacing}px</span>
          </div>
          <div className="jan-typography-preview">
            <p style={{ fontFamily: 'var(--jan-editor-font)', lineHeight: 'var(--jan-editor-line)', fontSize: 'var(--jan-editor-size)' }}>
              샘플 텍스트입니다. 한국어 가나다 영어 The quick brown fox 123. <b>굵게</b> <i>기울임</i> <u>밑줄</u>.
            </p>
            <p style={{ fontFamily: 'var(--jan-editor-font)', lineHeight: 'var(--jan-editor-line)', fontSize: 'var(--jan-editor-size)', marginTop: 'var(--jan-editor-para)' }}>
              두 번째 문단으로 단락 간격을 확인할 수 있습니다.
            </p>
          </div>
          <div className="jan-settings-actions">
            <button onClick={t.reset}>기본값으로</button>
          </div>
        </div>
      </div>
    </div>
  )
}
