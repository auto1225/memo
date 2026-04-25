/**
 * Phase 7 — KaTeX 수식 노드.
 * 인라인 입력: $$x^2 + y^2 = z^2$$ → 렌더링.
 * 더블클릭 → 편집 모드.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import katex from 'katex'
import 'katex/dist/katex.min.css'

export interface MathOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    math: {
      setMath: (latex: string) => ReturnType
    }
  }
}

export const MathInline = Node.create<MathOptions>({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: { default: '' },
    }
  },

  addOptions() {
    return { HTMLAttributes: {} }
  },

  parseHTML() {
    return [{ tag: 'span[data-math]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    let html = ''
    try {
      html = katex.renderToString(node.attrs.latex || '', { throwOnError: false, output: 'html' })
    } catch {
      html = `<span style="color:red">${node.attrs.latex}</span>`
    }
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-math': 'inline',
        'data-latex': node.attrs.latex,
        class: 'jan-math-inline',
      }),
      ['span', { class: 'jan-math-rendered', innerHTML: html } as any],
    ]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('span')
      dom.className = 'jan-math-inline'
      dom.dataset.math = 'inline'
      dom.dataset.latex = node.attrs.latex
      try {
        dom.innerHTML = katex.renderToString(node.attrs.latex || '', { throwOnError: false })
      } catch {
        dom.textContent = node.attrs.latex
      }
      dom.addEventListener('dblclick', () => {
        const next = window.prompt('LaTeX 편집:', node.attrs.latex)
        if (next == null) return
        const pos = typeof getPos === 'function' ? getPos() : null
        if (pos == null) return
        editor.chain().focus().setNodeSelection(pos).updateAttributes('mathInline', { latex: next }).run()
      })
      return { dom }
    }
  },

  addCommands() {
    return {
      setMath:
        (latex: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex } }),
    }
  },
})
