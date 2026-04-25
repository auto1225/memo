/**
 * Phase 17 — 자동 타이포그래피 변환.
 * "..." → "...", '...' → '…', -- → —, 1/2 → ½ 등.
 * @tiptap/core 의 InputRules 사용.
 */
import { Extension } from '@tiptap/core'
import { textInputRule } from '@tiptap/core'

export const SmartTypography = Extension.create({
  name: 'smartTypography',

  addInputRules() {
    return [
      // 영문 큰따옴표 — 스마트 (시작/끝)
      textInputRule({ find: /(^|[\s({])"$/, replace: '$1\u201C' }),
      textInputRule({ find: /"$/, replace: '\u201D' }),
      // 영문 작은따옴표
      textInputRule({ find: /(^|[\s({])'$/, replace: '$1\u2018' }),
      textInputRule({ find: /'$/, replace: '\u2019' }),
      // em-dash
      textInputRule({ find: /--$/, replace: '\u2014' }),
      // ellipsis
      textInputRule({ find: /\.\.\.$/, replace: '\u2026' }),
      // 화살표
      textInputRule({ find: /->$/, replace: '\u2192' }),
      textInputRule({ find: /<-$/, replace: '\u2190' }),
      textInputRule({ find: /=>$/, replace: '\u21D2' }),
      // 분수
      textInputRule({ find: /1\/2$/, replace: '\u00BD' }),
      textInputRule({ find: /1\/3$/, replace: '\u2153' }),
      textInputRule({ find: /1\/4$/, replace: '\u00BC' }),
      textInputRule({ find: /3\/4$/, replace: '\u00BE' }),
      // (c) (r) (tm)
      textInputRule({ find: /\(c\)$/i, replace: '\u00A9' }),
      textInputRule({ find: /\(r\)$/i, replace: '\u00AE' }),
      textInputRule({ find: /\(tm\)$/i, replace: '\u2122' }),
    ]
  },
})
