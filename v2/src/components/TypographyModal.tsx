import { Icon } from './Icons'
import {
  FONT_FAMILIES,
  TYPOGRAPHY_PRESETS,
  detectTypographyPreset,
  normalizeFontFamily,
  useTypographyStore,
} from '../store/typographyStore'

interface TypographyModalProps {
  onClose: () => void
}

export function TypographyModal({ onClose }: TypographyModalProps) {
  const t = useTypographyStore()
  const activePreset = detectTypographyPreset(t)

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-typography-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>문서 스타일</h3>
          <button className="jan-modal-close" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={14} />
            닫기
          </button>
        </div>
        <div className="jan-modal-body jan-typography-body">
          <section className="jan-typography-section" aria-label="스타일 프리셋">
            <div className="jan-typography-presets">
              {TYPOGRAPHY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={'jan-typography-preset' + (activePreset === preset.id ? ' is-active' : '')}
                  onClick={() => t.applyPreset(preset.id)}
                  aria-pressed={activePreset === preset.id}
                >
                  <span className="jan-typography-preset-title">{preset.label}</span>
                  <span>{preset.description}</span>
                  <strong>{preset.fontSize}px · {preset.lineHeight.toFixed(2)}줄</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="jan-typography-section" aria-label="상세 조정">
            <div className="jan-typography-field">
              <label htmlFor="jan-typo-font">글꼴</label>
              <select
                id="jan-typo-font"
                value={t.fontFamily}
                onChange={(e) => t.setFontFamily(normalizeFontFamily(e.target.value))}
              >
                {FONT_FAMILIES.map((family) => (
                  <option key={family.value} value={family.value}>{family.label}</option>
                ))}
              </select>
            </div>
            <div className="jan-typography-field">
              <label htmlFor="jan-typo-size">글자 크기</label>
              <input id="jan-typo-size" type="range" min={10} max={22} step={1} value={t.fontSize} onChange={(e) => t.setFontSize(Number(e.target.value))} />
              <output htmlFor="jan-typo-size">{t.fontSize}px</output>
            </div>
            <div className="jan-typography-field">
              <label htmlFor="jan-typo-line">줄 간격</label>
              <input id="jan-typo-line" type="range" min={1.2} max={2.4} step={0.05} value={t.lineHeight} onChange={(e) => t.setLineHeight(Number(e.target.value))} />
              <output htmlFor="jan-typo-line">{t.lineHeight.toFixed(2)}</output>
            </div>
            <div className="jan-typography-field">
              <label htmlFor="jan-typo-para">단락 간격</label>
              <input id="jan-typo-para" type="range" min={0} max={24} step={1} value={t.paragraphSpacing} onChange={(e) => t.setParagraphSpacing(Number(e.target.value))} />
              <output htmlFor="jan-typo-para">{t.paragraphSpacing}px</output>
            </div>
          </section>

          <div className="jan-typography-preview">
            <p>
              샘플 텍스트입니다. 한국어 가나다 영어 The quick brown fox 123. <b>굵게</b> <i>기울임</i> <u>밑줄</u>.
            </p>
            <p>
              두 번째 문단으로 단락 간격을 확인할 수 있습니다.
            </p>
          </div>
          <div className="jan-settings-actions">
            <button type="button" onClick={t.reset}>기본값으로</button>
          </div>
        </div>
      </div>
    </div>
  )
}
