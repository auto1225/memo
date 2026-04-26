import { mergeAttributes, Node } from '@tiptap/core'

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  priority: 1000,

  parseHTML() {
    return [
      { tag: 'hr[data-page-break="1"]' },
      { tag: 'hr.jan-page-break:not([data-page-break])' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(HTMLAttributes, { class: 'jan-page-break', 'data-page-break': '1' })]
  },
})
