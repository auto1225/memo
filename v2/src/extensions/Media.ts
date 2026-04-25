/**
 * Phase 14 — Audio / Video 노드.
 * file 또는 URL → native HTMLMediaElement.
 * Embed 노드와 다른 점: 직접 재생 (iframe X), control 표시.
 */
import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    media: {
      setAudio: (src: string) => ReturnType
      setVideo: (src: string) => ReturnType
    }
  }
}

export const AudioNode = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return { src: { default: '' } }
  },

  parseHTML() {
    return [{ tag: 'audio[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'audio',
      mergeAttributes(HTMLAttributes, {
        controls: 'true',
        preload: 'metadata',
        class: 'jan-audio',
        style: 'width:100%;max-width:480px;margin:8px 0;',
      }),
    ]
  },

  addCommands() {
    return {
      setAudio:
        (src) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src } }),
      setVideo:
        () =>
        () => false, // VideoNode 가 처리
    }
  },
})

export const VideoNode = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return { src: { default: '' }, poster: { default: '' } }
  },

  parseHTML() {
    return [{ tag: 'video[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: 'true',
        preload: 'metadata',
        class: 'jan-video',
        style: 'width:100%;max-width:720px;margin:8px 0;border-radius:6px;',
      }),
    ]
  },

  addCommands() {
    return {
      setAudio:
        () =>
        () => false,
      setVideo:
        (src) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src } }),
    }
  },
})
