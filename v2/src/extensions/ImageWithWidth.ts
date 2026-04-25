/**
 * Phase 16 — width 속성을 지원하는 Image 노드.
 * 기본 @tiptap/extension-image 를 extend.
 */
import { Image } from '@tiptap/extension-image'

export const ImageWithWidth = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute('width'),
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
    }
  },
})
