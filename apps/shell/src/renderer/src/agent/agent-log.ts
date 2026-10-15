import type { AgentActionView, AgentEventView } from '../../../shared/agent-api'

/** One line of the agent window's log */
export type AgentLogEntry =
  | { kind: 'you'; text: string }
  | { kind: 'agent'; text: string }
  | { kind: 'tool'; action: AgentActionView; status: 'running' | 'done' | 'failed' | 'denied' }
  | { kind: 'started'; skills: number }
  | { kind: 'turn-failed' }
  | { kind: 'error'; errorKind?: string | undefined }
  | { kind: 'ended' }

export interface AgentLogState {
  entries: AgentLogEntry[]
  /** permission requests waiting for an answer, oldest first */
  pending: Array<{ id: string; action: AgentActionView }>
  /** the agent is working on a message */
  busy: boolean
  ended: boolean
}

export const EMPTY_AGENT_LOG: AgentLogState = {
  entries: [],
  pending: [],
  busy: false,
  ended: false,
}

function sameAction(a: AgentActionView, b: AgentActionView): boolean {
  return (
    a.tool === b.tool &&
    a.kind === b.kind &&
    (a.command ?? '') === (b.command ?? '') &&
    a.paths.join('\n') === b.paths.join('\n')
  )
}

/** The log after one event: a finished tool replaces its running line, an answered request leaves */
export function agentLogWith(state: AgentLogState, event: AgentEventView): AgentLogState {
  switch (event.type) {
    case 'started':
      return { ...state, entries: [...state.entries, { kind: 'started', skills: event.skills }] }
    case 'text':
      return { ...state, entries: [...state.entries, { kind: 'agent', text: event.text }] }
    case 'tool': {
      if (event.status !== 'running') {
        for (let i = state.entries.length - 1; i >= 0; i--) {
          const entry = state.entries[i]!
          if (
            entry.kind === 'tool' &&
            entry.status === 'running' &&
            sameAction(entry.action, event.action)
          ) {
            const entries = [...state.entries]
            entries[i] = { ...entry, status: event.status }
            return { ...state, entries }
          }
        }
      }
      return {
        ...state,
        entries: [...state.entries, { kind: 'tool', action: event.action, status: event.status }],
      }
    }
    case 'permission':
      return { ...state, pending: [...state.pending, { id: event.id, action: event.action }] }
    case 'turn-done':
      return {
        ...state,
        busy: false,
        pending: [],
        entries: event.ok ? state.entries : [...state.entries, { kind: 'turn-failed' }],
      }
    case 'error':
      return { ...state, entries: [...state.entries, { kind: 'error', errorKind: event.kind }] }
    case 'ended':
      return {
        ...state,
        busy: false,
        ended: true,
        pending: [],
        entries: [...state.entries, { kind: 'ended' }],
      }
  }
}

export function agentLogAfterSend(state: AgentLogState, text: string): AgentLogState {
  return { ...state, busy: true, entries: [...state.entries, { kind: 'you', text }] }
}

export function agentLogAfterAnswer(state: AgentLogState, id: string): AgentLogState {
  return { ...state, pending: state.pending.filter((request) => request.id !== id) }
}

/** The file a tool line can open: the first path it names */
export function openablePath(action: AgentActionView): string | undefined {
  return action.kind === 'write' || action.kind === 'read' ? action.paths[0] : undefined
}
