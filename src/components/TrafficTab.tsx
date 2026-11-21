import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { ConnectionsTab } from './ConnectionsTab'
import { LogsTab } from './LogsTab'
export function TrafficTab() {
  const { traffic, connected, lang } = useApp()
  const [points, setPoints] = useState<{ down: number; up: number }[]>([])
  useEffect(() => { if (connected) setPoints(p => [...p.slice(-89), { down: traffic.download, up: traffic.upload }]); else setPoints([]) }, [traffic, connected])
  const max = Math.max(1024, ...points.flatMap(p => [p.down, p.up]))
  const path = (key: 'down' | 'up') => points.map((p, i) => `${i ? 'L' : 'M'}${i * 320 / 89},${116 - p[key] / max * 110}`).join(' ')
  const rate = (n: number) => (n * 8 / 1e6).toFixed(2) + ' Mbps'
  const total = (n: number) => (n / 1024 / 1024).toFixed(2) + ' MiB'
  return <div className="space-y-4 p-4">
    <div className="flex justify-between text-sm"><span className="text-sky-500">↓ {rate(traffic.download)} · {total(traffic.totalDownload)}</span><span className="text-violet-500">↑ {rate(traffic.upload)} · {total(traffic.totalUpload)}</span></div>
    <svg viewBox="0 0 320 120" className="h-40 w-full rounded-xl border border-neutral-300 dark:border-neutral-700" role="img" aria-label={lang === 'ru' ? 'Скорость трафика VPN' : 'VPN traffic rate'}><path d={path('down')} fill="none" stroke="#0ea5e9" strokeWidth="2" /><path d={path('up')} fill="none" stroke="#8b5cf6" strokeWidth="2" /></svg>
    {!connected && <p className="text-center text-sm text-neutral-500">{lang === 'ru' ? 'Подключитесь для просмотра трафика' : 'Connect to see traffic'}</p>}
    <ConnectionsTab embed /><LogsTab embed />
  </div>
}
