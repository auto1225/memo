/**
 * Phase 13 — OCR (이미지 → 텍스트).
 * Tesseract.js v5 — CDN ESM lazy import (~3MB worker + lang data).
 * 한국어 + 영어 (kor+eng) 동시 지원.
 */

let TesseractMod: any = null

async function loadTesseract() {
  if (TesseractMod) return TesseractMod
  // CDN ESM 동적 import — 타입 X 라 any
  const m = await import(
    /* @vite-ignore */
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js' as any
  ).catch(() => null as any)
  if (!m) throw new Error('Tesseract.js 로드 실패 — 네트워크 확인')
  TesseractMod = m.default || m
  return TesseractMod
}

export async function ocrImage(file: File | Blob, langs = 'kor+eng', onProgress?: (p: number) => void): Promise<string> {
  const T = await loadTesseract()
  const worker = await T.createWorker(langs, 1, {
    logger: (info: any) => {
      if (info.status === 'recognizing text' && typeof info.progress === 'number') {
        onProgress?.(info.progress)
      }
    },
  })
  try {
    const { data } = await worker.recognize(file)
    return data.text || ''
  } finally {
    await worker.terminate()
  }
}

export async function ocrFromUrl(url: string, langs = 'kor+eng'): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error('이미지 fetch 실패: ' + r.status)
  const blob = await r.blob()
  return ocrImage(blob, langs)
}
