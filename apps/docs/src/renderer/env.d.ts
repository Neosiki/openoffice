/// <reference types="vite/client" />

import type { DesktopApi } from '../shared/ipc'
import type { SubscriptionApi } from '../shared/subscription-api'
import type { ProjectApi } from '@genoffice/project-store'

declare global {
  interface Window {
    desktop: DesktopApi
    projectApi: ProjectApi
    /** absent when the preload predates the subscription channels */
    aiOfficeSubscription?: SubscriptionApi
  }
}

export {}
