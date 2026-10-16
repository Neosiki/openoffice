import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import {
  AGENT_CHANNELS,
  type AgentEventPayload,
  type AgentInit,
  type AgentPrefs,
  type AgentStartResponse,
  type AgentWindowApi,
} from '../shared/agent-api'

type Theme = 'light' | 'dark' | 'system'

function themeOf(value: unknown): Theme {
  return value === 'light' || value === 'dark' ? value : 'system'
}

// The agent window's narrow API (decision 0032): its own sessions and the theme
// broadcast. Nothing else from the shell; no subscription sign-in or sign-out.
const api: AgentWindowApi = {
  async getInit() {
    return (await ipcRenderer.invoke(AGENT_CHANNELS.getInit)) as AgentInit
  },
  async getTheme() {
    return themeOf(await ipcRenderer.invoke(AGENT_CHANNELS.getTheme))
  },
  onThemeChanged(handler) {
    const listener = (_event: IpcRendererEvent, theme: unknown) => handler(themeOf(theme))
    ipcRenderer.on('app:theme-changed', listener)
    return () => ipcRenderer.removeListener('app:theme-changed', listener)
  },
  async pickFolder() {
    const folder: unknown = await ipcRenderer.invoke(AGENT_CHANNELS.pickFolder)
    return typeof folder === 'string' ? folder : null
  },
  async setPrefs(prefs) {
    return (await ipcRenderer.invoke(AGENT_CHANNELS.setPrefs, prefs)) as AgentPrefs
  },
  async start(request) {
    return (await ipcRenderer.invoke(AGENT_CHANNELS.start, request)) as AgentStartResponse
  },
  async send(sessionId, text) {
    return (await ipcRenderer.invoke(AGENT_CHANNELS.send, sessionId, text)) === true
  },
  async answer(sessionId, requestId, allow) {
    await ipcRenderer.invoke(AGENT_CHANNELS.answer, sessionId, requestId, allow)
  },
  async stop(sessionId) {
    await ipcRenderer.invoke(AGENT_CHANNELS.stop, sessionId)
  },
  async openFile(sessionId, path) {
    return (await ipcRenderer.invoke(AGENT_CHANNELS.openFile, sessionId, path)) === true
  },
  onEvent(handler) {
    const listener = (_event: IpcRendererEvent, payload: AgentEventPayload) => handler(payload)
    ipcRenderer.on(AGENT_CHANNELS.event, listener)
    return () => ipcRenderer.removeListener(AGENT_CHANNELS.event, listener)
  },
}

contextBridge.exposeInMainWorld('aiOfficeAgentWindow', api)
