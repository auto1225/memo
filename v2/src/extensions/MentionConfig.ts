/**
 * Phase 8 — 멘션 (@) suggestion list.
 * 메모 제목 자동완성. 클릭 시 본문에 mention 노드 삽입.
 */
import Mention from '@tiptap/extension-mention'
import type { SuggestionOptions } from '@tiptap/suggestion'
import { useMemosStore } from '../store/memosStore'
import { useTagsStore } from '../store/tagsStore'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'

interface MentionItem {
  id: string
  label: string
  kind: 'memo' | 'tag'
}

function getItems(query: string): MentionItem[] {
  const q = query.toLowerCase()
  const memos = useMemosStore.getState().memos
  const allTags = useTagsStore.getState().allTags()

  const memoItems: MentionItem[] = Object.values(memos)
    .filter((m) => (m.title || '').toLowerCase().includes(q))
    .slice(0, 8)
    .map((m) => ({ id: m.id, label: m.title || '무제', kind: 'memo' }))

  const tagItems: MentionItem[] = allTags
    .filter(({ tag }) => tag.includes(q))
    .slice(0, 5)
    .map(({ tag }) => ({ id: 'tag:' + tag, label: '#' + tag, kind: 'tag' }))

  return [...memoItems, ...tagItems]
}

interface MentionListAPI {
  el: HTMLElement
  update: (props: any) => void
  destroy: () => void
  onKeyDown: (e: KeyboardEvent) => boolean
}

function renderList(): (props: any) => MentionListAPI {
  return (props) => {
    let selected = 0
    const el = document.createElement('div')
    el.className = 'jan-mention-list'

    function render() {
      const items: MentionItem[] = props.items || []
      el.innerHTML = ''
      if (items.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'jan-mention-list-item'
        empty.textContent = '검색 결과 없음'
        empty.style.opacity = '0.6'
        el.appendChild(empty)
        return
      }
      items.forEach((it: MentionItem, i: number) => {
        const div = document.createElement('div')
        div.className = 'jan-mention-list-item' + (i === selected ? ' is-selected' : '')
        div.textContent = it.label + (it.kind === 'memo' ? '' : ' (태그)')
        div.addEventListener('mousedown', (e) => {
          e.preventDefault()
          props.command({ id: it.id, label: it.label })
        })
        el.appendChild(div)
      })
    }
    render()

    return {
      el,
      update(newProps) {
        props = newProps
        selected = 0
        render()
      },
      destroy() {
        el.remove()
      },
      onKeyDown(e: KeyboardEvent) {
        const items: MentionItem[] = props.items || []
        if (e.key === 'ArrowDown') {
          selected = (selected + 1) % Math.max(items.length, 1)
          render()
          return true
        }
        if (e.key === 'ArrowUp') {
          selected = (selected - 1 + items.length) % Math.max(items.length, 1)
          render()
          return true
        }
        if (e.key === 'Enter' && items[selected]) {
          props.command({ id: items[selected].id, label: items[selected].label })
          return true
        }
        return false
      },
    }
  }
}

const suggestion: Omit<SuggestionOptions<MentionItem>, 'editor'> = {
  items: ({ query }) => getItems(query),
  render: () => {
    let listApi: MentionListAPI | null = null
    let popup: TippyInstance | null = null
    return {
      onStart: (props) => {
        listApi = renderList()(props)
        popup = tippy(document.body, {
          getReferenceClientRect: props.clientRect as any,
          appendTo: () => document.body,
          content: listApi.el,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },
      onUpdate: (props) => {
        listApi?.update(props)
        popup?.setProps({ getReferenceClientRect: props.clientRect as any })
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          popup?.hide()
          return true
        }
        return listApi?.onKeyDown(props.event) || false
      },
      onExit: () => {
        popup?.destroy()
        listApi?.destroy()
      },
    }
  },
}

export const MentionExt = Mention.configure({
  HTMLAttributes: { class: 'mention' },
  suggestion,
})
