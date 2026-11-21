import { useApp } from '../context/AppContext'
import { ConfigsTab } from './ConfigsTab'
import { ConnectionTab } from './ConnectionTab'
import { SettingsTab } from './SettingsTab'
import { ReachabilityTab } from './ReachabilityTab'
import { TrafficTab } from './TrafficTab'

export function MainPanel() {
  const { activeTab } = useApp()

  switch (activeTab) {
    case 'connection':
      return <ConnectionTab />
    case 'configs':
      return <ConfigsTab />
    case 'traffic':
      return <TrafficTab />
    case 'settings':
      return <SettingsTab />
    case 'reachability':
      return <ReachabilityTab />
    default:
      return <ConnectionTab />
  }
}
