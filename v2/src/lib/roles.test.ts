import { describe, expect, it } from 'vitest'
import { ROLE_TOOLS, ROLES, roleToolsFor } from './roles'

describe('role pack catalog', () => {
  it('keeps v1 core roles and a broad role pack available', () => {
    expect(ROLES.length).toBeGreaterThanOrEqual(20)
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
      'developer',
    ]))
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
