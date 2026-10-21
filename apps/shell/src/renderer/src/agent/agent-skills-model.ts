import type { SkillChipView } from '@genoffice/ui'
import type { AgentSessionSkill } from '../../../shared/agent-api'

/**
 * The agent window's skill rules as plain functions (spec 6.2, 6.5, 9.4):
 * the `/` list of a session, the instruction a chip turns into, and when the
 * one-time notice shows. The window lays these out.
 */

/**
 * The session's skills as the shared `/` list reads a skill list: every one
 * is on (the session got it), agent-only ones included, and a template only
 * where the bundle holds its file.
 */
export function agentPickerSkillsRaw(skills: readonly AgentSessionSkill[]): unknown[] {
  return skills.map((skill) => ({
    id: skill.id,
    source: skill.source,
    plugin: skill.plugin,
    name: skill.name,
    title: skill.title,
    description: skill.description,
    enabled: true,
    hidden: false,
    unreadable: undefined,
    agentOnly: true,
    hasScripts: false,
    template: skill.template ? skill.template : undefined,
    templateExists: !!skill.template,
  }))
}

/** One chip's instruction: the same words for Claude Code and Codex, manual skills included */
export function agentSkillInstruction(skill: AgentSessionSkill): string {
  const lines = [`Use this skill: read ${skill.skillMd} and follow it.`]
  if (skill.template) {
    lines.push(
      `Its template document is ${skill.template}. Copy it into the project folder under a new name and fill in the copy; leave the template itself unchanged.`,
    )
  }
  return lines.join(' ')
}

export type AgentSkillRequest =
  { ok: true; text: string; titles: string[] } | { ok: false; missing: string[] }

/**
 * The text a message with chips sends (spec 6.2): each chip's instruction in
 * the order the chips were put in, then what the person typed. A chip whose
 * skill the session does not hold is not sent around (spec 9.1).
 */
export function agentSkillRequest(
  text: string,
  chips: readonly Pick<SkillChipView, 'id'>[],
  skills: readonly AgentSessionSkill[],
): AgentSkillRequest {
  if (chips.length === 0) return { ok: true, text, titles: [] }
  const byId = new Map(skills.map((skill) => [skill.id, skill]))
  const missing = chips.filter((chip) => !byId.has(chip.id)).map((chip) => chip.id)
  if (missing.length > 0) return { ok: false, missing }
  const chosen = chips.map((chip) => byId.get(chip.id)!)
  return {
    ok: true,
    text: [...chosen.map(agentSkillInstruction), '', text].join('\n'),
    titles: chosen.map((skill) => skill.title || skill.name),
  }
}

/** The one-time notice shows once the main process said it is due, until it is closed */
export function agentSkillNoticeShown(due: boolean | null, closed: boolean): boolean {
  return due === true && !closed
}
