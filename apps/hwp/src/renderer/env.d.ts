/// <reference types="vite/client" />

import type { ProjectApi } from '@genoffice/project-store'
import type { HwpApi } from '../shared/ipc'

declare global {
  interface Window {
    hwpApi: HwpApi
    /** the shell's chat history of documents; absent where no shell registered it */
    projectApi?: Pick<ProjectApi, 'resolveChat' | 'appendChat' | 'loadChat' | 'rebindChat'>
  }
}

export {}
