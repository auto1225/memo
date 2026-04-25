/**
 * Phase 8 — 데이터 임베드 노드.
 * URL 자동 감지: YouTube, Vimeo, Twitter, Google Maps, CodeSandbox.
 * 그 외는 일반 iframe (사용자가 sandbox 처리).
 */
import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (url: string) => ReturnType
    }
  }
}

interface EmbedSpec {
  src: string
  width: string
  height: string
  allow?: string
}

export function urlToEmbed(url: string): EmbedSpec | null {
  try {
    const u = new URL(url)
    // YouTube
    let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/)
    if (m) return { src: `https://www.youtube.com/embed/${m[1]}`, width: '100%', height: '380', allow: 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen' }
    // Vimeo
    m = url.match(/vimeo\.com\/(\d+)/)
    if (m) return { src: `https://player.vimeo.com/video/${m[1]}`, width: '100%', height: '360', allow: 'autoplay; fullscreen; picture-in-picture' }
    // CodeSandbox
    if (u.hostname.includes('codesandbox.io')) {
      const path = u.pathname.replace(/^\/s\//, '/embed/').replace(/^\/p\//, '/embed/')
      return { src: `https://codesandbox.io${path}`, width: '100%', height: '500' }
    }
    // Google Maps embed
    if (u.hostname.includes('google.com') && url.includes('/maps/')) {
      // 사용자가 "공유" → "지도 퍼가기" 의 src 를 그대로 줘야 함. 일반 URL 은 변환 어려움.
      return { src: url, width: '100%', height: '380' }
    }
    // Twitter / X — embed 가 javascript 필요. 단순 링크로 폴백.
    if (u.hostname.match(/(twitter\.com|x\.com)$/) && url.includes('/status/')) {
      return null // 사용자가 인용으로 직접 처리
    }
    // 일반 iframe (사용자 책임)
    return { src: url, width: '100%', height: '420' }
  } catch {
    return null
  }
}

export const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      width: { default: '100%' },
      height: { default: '420' },
      allow: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'iframe[data-embed]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      { class: 'jan-embed-wrap', style: 'margin:8px 0; max-width:100%;' },
      [
        'iframe',
        mergeAttributes(HTMLAttributes, {
          'data-embed': 'true',
          loading: 'lazy',
          referrerpolicy: 'no-referrer',
          sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
          style: 'width:100%; max-width:100%; aspect-ratio:16/9; border:0; border-radius:6px;',
          frameborder: '0',
        }),
      ],
    ]
  },

  addCommands() {
    return {
      setEmbed:
        (url: string) =>
        ({ commands }) => {
          const spec = urlToEmbed(url)
          if (!spec) return false
          return commands.insertContent({
            type: this.name,
            attrs: spec,
          })
        },
    }
  },
})
