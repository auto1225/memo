import { useEffect, useState } from 'react'

/**
 * Phase 16 — 이미지 Lightbox.
 * editor 안 img 클릭 시 (단순 클릭 — 선택 X) 모달로 확대.
 * Esc 또는 배경 클릭으로 닫기.
 */
export function Lightbox() {
  const [src, setSrc] = useState<string | null>(null)
  const [alt, setAlt] = useState('')

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (t.tagName !== 'IMG') return
      // ProseMirror 안의 이미지만
      if (!t.closest('.ProseMirror')) return
      // 선택 모드 (Alt 누르고 있으면 선택만)
      if (e.altKey) return
      const img = t as HTMLImageElement
      e.preventDefault()
      setSrc(img.src)
      setAlt(img.alt || '')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    if (!src) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSrc(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [src])

  if (!src) return null

  return (
    <div className="jan-lightbox" onClick={() => setSrc(null)} role="dialog" aria-modal="true">
      <button className="jan-lightbox-close" onClick={() => setSrc(null)} aria-label="닫기">×</button>
      <img src={src} alt={alt} className="jan-lightbox-img" onClick={(e) => e.stopPropagation()} />
      {alt && <div className="jan-lightbox-caption">{alt}</div>}
    </div>
  )
}
