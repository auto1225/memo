import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as vm from 'node:vm'
import { ROLE_TOOLS, ROLES, findRole, materializeRoleTemplate, materializeRoleTemplateHtml, roleToolsFor } from './roles'

interface V1Template {
  name: string
  html: string
}

interface V1Role {
  templates?: V1Template[]
}

type V1RoleMap = Record<string, V1Role>

function loadV1Roles(): V1RoleMap {
  const appHtml = readFileSync(resolve(process.cwd(), '../app.html'), 'utf8')
  const match = appHtml.match(/const ROLES = (\{[\s\S]*?\n\s*\});\s*\n\s*const ROLE_TOOLS/)
  expect(match).toBeTruthy()

  const baseContext = { ROLES: undefined as V1RoleMap | undefined, Date, console }
  vm.runInNewContext(`ROLES = ${match?.[1] || '{}'}`, baseContext)

  const rolesPack = readFileSync(resolve(process.cwd(), '../roles-pack.js'), 'utf8')
  const packContext = {
    window: {} as { JAN_ROLES_EXTRA?: V1RoleMap },
    console: { info() {}, warn() {} },
  }
  vm.runInNewContext(rolesPack, packContext)

  return { ...(baseContext.ROLES || {}), ...(packContext.window.JAN_ROLES_EXTRA || {}) }
}

describe('role pack catalog', () => {
  it('keeps v1 core roles and a broad role pack available', () => {
    expect(ROLES.length).toBeGreaterThanOrEqual(47)
    expect(ROLES.map((r) => r.id)).toEqual(expect.arrayContaining([
      'elementary',
      'middle',
      'high',
      'college',
      'grad',
      'office-junior',
      'office-senior',
      'freelancer',
      'homemaker',
      'senior',
      'pm',
      'dev',
    ]))
  })

  it('covers every v1 role and template name', () => {
    const v1Roles = loadV1Roles()
    const v2Roles = new Map(ROLES.map((role) => [role.id, role]))

    for (const [roleId, v1Role] of Object.entries(v1Roles)) {
      const v2Role = v2Roles.get(roleId)
      expect(v2Role, `missing v1 role: ${roleId}`).toBeTruthy()

      const v2TemplateNames = new Set(v2Role?.templates.map((template) => template.name) || [])
      for (const template of v1Role.templates || []) {
        expect(v2TemplateNames.has(template.name), `missing v1 template: ${roleId} -> ${template.name}`).toBe(true)
      }
    }
  })

  it('prioritizes the richer v1 template bodies over compact v2 defaults', () => {
    const pm = findRole('pm')
    const freelancer = findRole('freelancer')

    expect(pm?.templates[0].name).toBe('PRD — Product Requirements Document')
    expect(pm?.templates[0].html).toContain('PRD 리뷰 체크')
    expect(pm?.templates[0].html).toContain('North Star')

    const invoices = freelancer?.templates.filter((template) => template.name === '청구서') || []
    expect(invoices).toHaveLength(1)
    expect(invoices[0].html).toContain('INV-1777180963006')
    expect(invoices[0].html).toContain('청구일')
  })

  it('materializes v1 frozen dates and document numbers at insertion time', () => {
    const rendered = materializeRoleTemplateHtml(
      '<h2>2026. 4. 26. 일기</h2><p>PRD-2026-001</p><p>청구서 #INV-1777180963006</p>',
      new Date(2027, 4, 2, 12, 0, 0)
    )

    expect(rendered).toContain('2027. 5. 2.')
    expect(rendered).toContain('PRD-2027-001')
    expect(rendered).toMatch(/#INV-20270502-\d{5}/)
    expect(rendered).not.toContain('2026. 4. 26.')
    expect(rendered).not.toContain('INV-1777180963006')
  })

  it('uses a fresh invoice number for repeated template insertions', () => {
    const date = new Date(2027, 4, 2, 12, 0, 0)
    const first = materializeRoleTemplateHtml('청구서 #INV-1777180963006', date)
    const second = materializeRoleTemplateHtml('청구서 #INV-1777180963006', date)

    expect(first).toMatch(/INV-20270502-\d{5}/)
    expect(second).toMatch(/INV-20270502-\d{5}/)
    expect(first).not.toBe(second)
  })

  it('materializes every bundled template without the v1 generated static markers', () => {
    const rendered = ROLES.flatMap((role) => role.templates.map((template) => materializeRoleTemplate(template, new Date(2027, 4, 2, 12, 0, 0)).html)).join('\n')

    expect(rendered).not.toContain('2026. 4. 26.')
    expect(rendered).not.toContain('INV-1777180963006')
  })

  it('maps every role tool id to a runnable tool card', () => {
    for (const role of ROLES) {
      expect(role.templates.length).toBeGreaterThan(0)
      for (const toolId of role.tools) {
        expect(ROLE_TOOLS[toolId], `${role.name} -> ${toolId}`).toBeTruthy()
      }
    }
  })

  it('deduplicates tools for multiple selected roles', () => {
    const tools = roleToolsFor(['college', 'pm'])
    const ids = tools.map((tool) => tool.id)

    expect(ids).toContain('timetable')
    expect(ids).toContain('gpa')
    expect(ids).toContain('projPipe')
    expect(new Set(ids).size).toBe(ids.length)
  })
})
