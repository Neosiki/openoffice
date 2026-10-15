import type { Plugin } from 'vite'

export type RhwpPatchName =
  'sdk-scheme' | 'studio-scheme' | 'studio-password-flag' | 'studio-plugin-allow'

export declare const APP_SCHEME: string
export declare const PASSWORD_FLAG: 'passwordProtected'
export declare const AGENT_PLUGIN_MODULE: string
export declare function applyPatch(name: RhwpPatchName, code: string): string
export declare function rhwpPatches(...names: RhwpPatchName[]): Plugin
