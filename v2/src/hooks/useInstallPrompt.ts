import { useEffect, useState } from 'react'

/**
 * Phase 9 — PWA 설치 프롬프트.
 * Chromium 계열은 beforeinstallprompt 이벤트로 사용자 제스처에 반응 가능.
 * Safari (iOS) 는 native 지원 X — 사용자가 공유 → 홈 화면에 추가 직접.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    // 이미 standalone 모드면 설치된 상태
    if (window.matchMedia?.('(display-mode: standalone)').matches) {
      setInstalled(true)
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function trigger() {
    if (!event) return false
    await event.prompt()
    const r = await event.userChoice
    if (r.outcome === 'accepted') {
      setInstalled(true)
      setEvent(null)
      return true
    }
    return false
  }

  return { canInstall: !!event && !installed, installed, trigger }
}
