import { HorizontalRule } from '@tiptap/extension-horizontal-rule'

export const NormalHorizontalRule = HorizontalRule.extend({
  parseHTML() {
    return [{ tag: 'hr:not(.jan-page-break):not([data-page-break])' }]
  },
})
