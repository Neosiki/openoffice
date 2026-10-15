/// <reference types="vite/client" />

import type { ProjectApi } from '@genoffice/project-store'
import type { MindmapApi } from '../shared/ipc'

declare global {
  interface Window {
    mindmapApi: MindmapApi
    projectApi?: Pick<ProjectApi, 'resolveChat' | 'appendChat' | 'loadChat' | 'rebindChat'>
  }
}

export {}
