/**
 * The three channels an editor's AI uses to search and read the user's Google
 * Drive (decision 0033). The shell's main process answers them; it alone holds
 * the Drive connection, and it refuses them while Drive is disconnected or the
 * person has not let the AI use it.
 */
export const DRIVE_AI_CHANNELS = {
  enabled: 'drive:ai-enabled',
  search: 'drive:ai-search',
  read: 'drive:ai-read',
  /** main → every window: the Drive state changed (payload: the shell's DriveUiState) */
  changed: 'drive:state-changed',
} as const

/** Whether a broadcast Drive state lets the AI use Drive */
export function driveAiOn(state: unknown): boolean {
  const s = (state && typeof state === 'object' ? state : {}) as {
    state?: unknown
    aiAccess?: unknown
  }
  return s.state === 'connected' && s.aiAccess === true
}
