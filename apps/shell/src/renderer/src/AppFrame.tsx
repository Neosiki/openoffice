import { useEffect, useState } from 'react'
import { useFirstConnectionNotice } from './FirstConnectionNotice'
import { Home } from './Home'
import { Onboarding } from './Onboarding'
import { TabBar } from './TabBar'
import { useSubscriptionConnection } from './subscription-client'

interface AppFrameProps {
  /** resolved before first paint (main.tsx) so home never flashes under the overlay */
  initialOnboardingSeen: boolean
}

export function AppFrame({ initialOnboardingSeen }: AppFrameProps) {
  const [homeActive, setHomeActive] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(!initialOnboardingSeen)
  // one live view of the subscription connection for the home screen, the
  // onboarding and the first-connection notice
  const connection = useSubscriptionConnection()
  const notice = useFirstConnectionNotice(connection.statuses)

  useEffect(() => {
    const applyTabs = (tabs: Awaited<ReturnType<typeof window.aiOfficeTabs.list>>) => {
      const active = tabs.find((tab) => tab.active)
      setHomeActive(!active || active.kind === 'home')
    }
    void window.aiOfficeTabs.list().then(applyTabs)
    return window.aiOfficeTabs.onChanged(applyTabs)
  }, [])

  const finishOnboarding = async (): Promise<boolean> => {
    try {
      const persisted = await window.aiOffice.setOnboardingSeen()
      if (!persisted) return false
      setShowOnboarding(false)
      return true
    } catch {
      return false
    }
  }

  return (
    <div className="app-frame">
      <TabBar />
      {/* docs/sheets tabs render as WebContentsView children of this window, positioned
       * by the main process to cover this area — only Home paints its own content here. */}
      <div className="app-frame-content" style={{ visibility: homeActive ? 'visible' : 'hidden' }}>
        <Home
          connection={connection}
          aiSettings={notice.settings}
          // during the onboarding its connect step shows the notice instead
          noticeDue={notice.due && !showOnboarding}
          onNoticeAcknowledge={notice.acknowledge}
        />
      </div>
      {/* editor WebContentsViews paint above ALL shell DOM, so the overlay only
       * renders while the home tab is active — it comes back when home does */}
      {showOnboarding && homeActive && (
        <Onboarding
          onDone={finishOnboarding}
          connection={connection}
          noticeDue={notice.due}
          onNoticeAcknowledge={notice.acknowledge}
        />
      )}
    </div>
  )
}
