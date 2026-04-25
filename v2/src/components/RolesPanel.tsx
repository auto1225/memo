import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { ROLES } from '../lib/roles'

interface RolesPanelProps {
  editor: Editor | null
  onClose: () => void
}

/**
 * Phase 5 — 역할 팩 패널.
 * 12개 역할 × 3~4 템플릿 = ~30 템플릿. 클릭 → 현재 위치에 삽입.
 */
export function RolesPanel({ editor, onClose }: RolesPanelProps) {
  const [roleId, setRoleId] = useState(ROLES[0].id)
  const role = ROLES.find((r) => r.id === roleId) || ROLES[0]

  if (!editor) return null

  function insertTemplate(html: string) {
    if (!editor) return
    editor.chain().focus().insertContent(html).run()
    onClose()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-roles-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>역할 팩 — 템플릿 삽입</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body jan-roles-body">
          <aside className="jan-roles-sidebar">
            {ROLES.map((r) => (
              <button
                key={r.id}
                className={'jan-roles-tab' + (r.id === roleId ? ' is-active' : '')}
                onClick={() => setRoleId(r.id)}
              >
                <div className="jan-roles-name">{r.name}</div>
                <div className="jan-roles-desc">{r.desc}</div>
              </button>
            ))}
          </aside>
          <section className="jan-roles-content">
            <div className="jan-roles-title">{role.name}</div>
            <div className="jan-roles-templates">
              {role.templates.map((t, i) => (
                <button
                  key={i}
                  className="jan-roles-template"
                  onClick={() => insertTemplate(t.html)}
                  title="클릭하면 현재 메모에 삽입"
                >
                  {t.name}
                </button>
              ))}
            </div>
            <div className="jan-roles-hint">템플릿을 클릭하면 현재 커서 위치에 삽입됩니다.</div>
          </section>
        </div>
      </div>
    </div>
  )
}
