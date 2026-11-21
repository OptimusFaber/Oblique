/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ActiveVpnFlow, AdvancedAppSettings, ConfigRule, Lang, OutboundProfile, ReachSiteRow, RuleMode, RoutingScene, Server, ServerGroup, TabId, ThemeChoice, TransportMode } from '../types'
import { chooseFailover } from '../core/failover'
import { buildMainOutbound, buildSingBoxConfigJson, serverTag } from '../core/buildSingBoxConfig'
import { coreCall, setNativeWindowMode, tauriDetectCountry, tauriStartCore, tauriStopCore, tauriTcpPingMs } from '../lib/tauriCore'
import { isDesktopApp } from '../lib/runtime'
import { normalizeServer } from '../utils/parseServer'

function load<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem('oblique_' + key) ?? localStorage.getItem('sg_' + key)
    if (!value) return fallback
    let parsed: unknown
    try { parsed = JSON.parse(value) } catch { parsed = value }
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback
    if (typeof parsed !== typeof fallback && fallback !== null) return fallback
    if (key === 'v2_servers' && Array.isArray(parsed)) return parsed.map(s => normalizeServer(s)).filter(Boolean) as T
    return parsed as T
  } catch { return fallback }
}
function useSaved<T>(key: string, initial: T) {
  const [value, set] = useState<T>(() => load(key, initial))
  useEffect(() => { localStorage.setItem('oblique_' + key, JSON.stringify(value)) }, [key, value])
  return [value, set] as const
}
const defaults: AdvancedAppSettings = { dnsOverHttps: true, ipv6: true, bypassLan: true, mux: false, sniff: true, strictRouting: true, blockQuic: false, quicGso: false }
function useAppValue() {
  const [theme, setTheme] = useSaved<ThemeChoice>('theme', 'system')
  const [lang, setLang] = useSaved<Lang>('lang', 'ru')
  const [transport, setTransportState] = useSaved<TransportMode>('transport', 'proxy')
  const [servers, setServers] = useSaved<Server[]>('v2_servers', [])
  const [serverGroups, setGroups] = useSaved<ServerGroup[]>('v2_groups', [])
  const [routingScenes, setScenes] = useSaved<RoutingScene[]>('v2_scenes', [])
  const [advanced, setAdvancedState] = useSaved<AdvancedAppSettings>('v2_advanced', defaults)
  const [rules, setRules] = useSaved<ConfigRule[]>('rules', [])
  const [activeServerId, setActive] = useSaved<string | null>('active_server', null)
  const [activeGroupId, setGroup] = useSaved<string | null>('active_group', null)
  const [autoScrollLog, setAutoScrollLog] = useSaved('auto_scroll_log', true)
  const [logsEnabled, setLogsEnabled] = useSaved('logs_enabled', true)
  const [testAfterStart, setTestAfterStart] = useSaved('test_after_start', true)
  const [maxLogLines, setMaxLogLines] = useSaved('max_log_lines', 200)
  const [reachSites, setReachSites] = useSaved<ReachSiteRow[]>('reach_sites', [])
  const [activeTab, setActiveTab] = useState<TabId>('connection')
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const testingRef = useRef(false)
  const testGeneration = useRef(0)
  const [connectedSince, setConnectedSince] = useState<number | null>(null)
  const [connectNotice, setConnectNotice] = useState('')
  const [connectError, setConnectError] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [activeVpnFlows, setActiveVpnFlows] = useState<ActiveVpnFlow[]>([])
  const [traffic, setTraffic] = useState({ download: 0, upload: 0, totalDownload: 0, totalUpload: 0 })
  const [layoutWide, setLayoutWide] = useState(window.innerWidth >= 780)
  const [compactWindow, setCompactWindow] = useSaved('compact_window', false)
  const [systemDark, setSystemDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches)
  const latch = useRef(false)
  const connectedRef = useRef(false)
  const latestServers = useRef(servers)
  latestServers.current = servers
  const primary = useRef<string | null>(null)
  const current = useRef<string | null>(null)
  const loadedIds = useRef(new Set<string>())
  const countryLookups = useRef(new Set<string>())
  const previousTotals = useRef({ down: 0, up: 0, at: Date.now() })
  const resolvedDark = theme === 'dark' || theme === 'system' && systemDark
  const redact = useCallback((line: string) => {
    for (const s of latestServers.current) if (s.password) line = line.split(s.password).join('***')
    return line
  }, [])
  const pushLog = useCallback((line: string) => {
    line = redact(line)
    if (logsEnabled) setLogs(p => [`[${new Date().toLocaleTimeString()}] ${line}`, ...p].slice(0, maxLogLines))
  }, [logsEnabled, maxLogLines, redact])
  const reset = useCallback(() => {
    connectedRef.current = false; setConnected(false); setConnectedSince(null); setActiveVpnFlows([])
    setTraffic({ download: 0, upload: 0, totalDownload: 0, totalUpload: 0 }); loadedIds.current.clear()
  }, [])
  useEffect(() => {
    const resize = () => setLayoutWide(window.innerWidth >= 780)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const change = () => setSystemDark(mq.matches)
    window.addEventListener('resize', resize); mq.addEventListener('change', change)
    return () => { window.removeEventListener('resize', resize); mq.removeEventListener('change', change) }
  }, [])
  useEffect(() => { if (isDesktopApp()) void setNativeWindowMode(compactWindow).catch(e => pushLog('Window mode: ' + String(e))) }, [compactWindow, pushLog])
  useEffect(() => {
    if (!isDesktopApp()) return
    void coreCall<{ running: boolean; error?: string }>('core_status').then(status => {
      if (!status.running && status.error?.startsWith('Proxy recovery failed:')) {
        setConnectNotice(status.error)
        setConnectError(true)
      }
    }).catch(() => undefined)
  }, [])
  useEffect(() => {
    if (!isDesktopApp()) return
    let cancelled = false
    for (const srv of servers) {
      if (srv.countryCode || countryLookups.current.has(srv.host)) continue
      countryLookups.current.add(srv.host)
      void tauriDetectCountry(srv.host).then(code => {
        if (!cancelled && code) setServers(current => current.map(s => s.id === srv.id && !s.countryCode ? { ...s, countryCode: code } : s))
      }).catch(() => undefined)
    }
    return () => { cancelled = true }
  }, [servers, setServers])
  useEffect(() => { document.documentElement.classList.toggle('dark', resolvedDark) }, [resolvedDark])
  useEffect(() => { if (!activeServerId && servers.length) setActive(servers[0].id) }, [activeServerId, servers, setActive])

  const editable = () => {
    if (connectedRef.current || latch.current) { setConnectNotice('Отключитесь перед изменением настроек / Disconnect before changing settings'); return false }
    return true
  }
  const start = async (srv: Server, preferredId = srv.id) => {
    const pool = servers.filter(s => { try { buildMainOutbound(s, advanced); return true } catch { return false } })
    const built = buildSingBoxConfigJson(srv, transport, { ...defaults, ...advanced }, rules, pool)
    if (built.ok === false) throw new Error(built.error)
    setConnectNotice('Проверяем VPN-подключение… / Checking VPN connection…')
    setConnectError(false)
    await tauriStartCore(built.json, transport === 'proxy', advanced.bypassLan)
    loadedIds.current = new Set([srv.id, ...pool.map(s => s.id)])
    previousTotals.current = { down: 0, up: 0, at: Date.now() }
    primary.current = preferredId; current.current = srv.id; setActive(srv.id)
    connectedRef.current = true; setConnected(true); setConnectedSince(Date.now()); setConnectNotice(''); setConnectError(false)
    pushLog('VPN connected: ' + srv.tag)
  }
  const toggleConnect = async () => {
    if (latch.current) return
    testGeneration.current += 1; testingRef.current = false; setTesting(false)
    latch.current = true; setBusy(true)
    try {
      if (connectedRef.current) { await tauriStopCore(); reset(); setConnectNotice(''); setConnectError(false); pushLog('Disconnected') }
      else {
        const s = servers.find(s => s.id === activeServerId) || servers[0]
        if (!s) throw new Error('Добавьте VPN-профиль / Add a VPN profile')
        const group = activeGroupId ? serverGroups.find(g => g.fallback && g.id === activeGroupId && g.memberServerIds.includes(s.id)) : serverGroups.find(g => g.fallback && g.memberServerIds.includes(s.id))
        const candidates = [s, ...(group ? servers.filter(x => x.id !== s.id && group.memberServerIds.includes(x.id)) : [])]
        let lastError: unknown = new Error('No working servers')
        let ready = false
        for (const candidate of candidates) {
          try { await start(candidate, s.id); ready = true; break }
          catch (e) { lastError = e; pushLog(candidate.tag + ': ' + String(e)) }
        }
        if (!ready) throw lastError
      }
    } catch (e) { reset(); setConnectNotice(redact(String(e))); setConnectError(true); pushLog(String(e)) }
    finally { latch.current = false; setBusy(false) }
  }
  const setActiveServer = async (id: string) => {
    if (latch.current) return
    if (!connectedRef.current) { setActive(id); return }
    latch.current = true; setBusy(true)
    try {
      const srv = servers.find(s => s.id === id)
      if (!srv || !loadedIds.current.has(id)) throw new Error('Отключитесь и выберите этот профиль / Disconnect to select this profile')
      await coreCall('core_delay', { tag: serverTag(srv) })
      await coreCall('core_select', { tag: serverTag(srv) })
      primary.current = id; current.current = id; setActive(id); setConnectNotice(''); pushLog('Server selected: ' + srv.tag)
    } catch (e) { setConnectNotice(redact(String(e))) }
    finally { latch.current = false; setBusy(false) }
  }
  useEffect(() => {
    if (!connected || !isDesktopApp()) return
    let cancelled = false
    let failures = 0
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const s = await coreCall<{ running: boolean; error?: string; data?: { downloadTotal: number; uploadTotal: number; connections?: { id: string; metadata: { host?: string; destinationIP?: string; destinationPort?: string; process?: string; processPath?: string; network?: string; type?: string }; chains?: string[]; download: number; upload: number; start: string }[] } }>('core_status')
        if (cancelled) return
        if (!s.running) { reset(); setConnectNotice(s.error || 'VPN core stopped'); setConnectError(true); return }
        failures = 0
        const d = s.data!
        const now = Date.now(), prev = previousTotals.current, seconds = Math.max((now - prev.at) / 1000, .1)
        setTraffic({ download: Math.max(0, (d.downloadTotal - prev.down) / seconds), upload: Math.max(0, (d.uploadTotal - prev.up) / seconds), totalDownload: d.downloadTotal, totalUpload: d.uploadTotal })
        previousTotals.current = { down: d.downloadTotal, up: d.uploadTotal, at: now }
        setActiveVpnFlows((d.connections || []).map(c => ({ id: c.id, dest: `${c.metadata.destinationIP || ''}:${c.metadata.destinationPort || ''}`, domain: c.metadata.host || '', process: c.metadata.process || c.metadata.processPath || '', protocol: c.metadata.type || '', network: c.metadata.network || '', outbound: c.chains?.join(' → ') || '', upload: c.upload, download: c.download, createdAtMs: Date.parse(c.start) || now })))
        if (logsEnabled) {
          const lines = await coreCall<string[]>('core_logs')
          if (!cancelled && lines.length) setLogs(p => [...lines.map(redact).reverse(), ...p].slice(0, maxLogLines))
        }
      } catch (e) {
        if (!cancelled && ++failures >= 3) {
          try { await tauriStopCore() } catch (stopError) { pushLog(String(stopError)) }
          reset(); setConnectNotice('Потеряна связь с ядром / Core unavailable: ' + String(e)); setConnectError(true); return
        }
      }
      if (!cancelled) timer = setTimeout(poll, 1000)
    }
    void poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [connected, reset, logsEnabled, maxLogLines, pushLog, redact])

  useEffect(() => {
    if (!connected) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let misses = 0
    const check = async () => {
      try {
        if (latch.current) return
        const primaryId = primary.current
        const currentId = current.current
        const group = activeGroupId ? serverGroups.find(g => g.fallback && g.id === activeGroupId && g.memberServerIds.includes(primaryId || '')) : serverGroups.find(g => g.fallback && g.memberServerIds.includes(primaryId || ''))
        if (!group) return
        const candidates = latestServers.current.filter(s => loadedIds.current.has(s.id) && group.memberServerIds.includes(s.id))
        const results: { server: Server; ms: number }[] = []
        for (const server of candidates) {
          if (cancelled || !connectedRef.current) return
          try { const ms = await coreCall<number>('core_delay', { tag: serverTag(server) }); results.push({ server, ms }) } catch { /* A failed HTTP probe is not a working server. */ }
        }
        if (cancelled || latch.current || !connectedRef.current || primary.current !== primaryId || current.current !== currentId) return
        setServers(p => p.map(s => candidates.some(c => c.id === s.id) ? { ...s, latencyMs: results.find(r => r.server.id === s.id)?.ms ?? null } : s))
        const alive = results.find(r => r.server.id === current.current)
        misses = alive ? 0 : misses + 1
        const next = chooseFailover(results.map(r => ({ ...r, id: r.server.id, latency: r.ms })), primary.current, current.current, misses)
        if (next && next.server.id !== current.current) {
          await coreCall('core_select', { tag: serverTag(next.server) })
          if (cancelled) return
          current.current = next.server.id; setActive(next.server.id); misses = 0; pushLog('Auto failover: ' + next.server.tag)
        }
        if (!results.length) setConnectNotice('Серверы группы недоступны. Повторяем проверку… / Group unavailable, retrying…')
        else setConnectNotice('')
      } catch (e) { if (!cancelled) pushLog('Failover check: ' + String(e)) } finally { if (!cancelled) timer = setTimeout(() => void check(), 30000) }
    }
    timer = setTimeout(() => void check(), 30000)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [connected, serverGroups, activeGroupId, setServers, setActive, pushLog])

  const testLatencies = async () => {
    if (latch.current || testingRef.current) return
    testingRef.current = true; setTesting(true)
    const generation = ++testGeneration.current
    try {
      if (!isDesktopApp()) throw new Error('Проверка доступна в desktop-приложении / Desktop app required')
      const results: { id: string; ms: number | null }[] = []
      const pending = [...servers]
      const worker = async () => {
        while (pending.length && generation === testGeneration.current) {
          const s = pending.shift()!
          let ms: number | null = null
          try { if (!connectedRef.current || loadedIds.current.has(s.id)) { const value = connectedRef.current ? await coreCall<number>('core_delay', { tag: serverTag(s) }) : await tauriTcpPingMs(s.host, s.port); ms = value === 0xffffffff ? null : value } } catch { /* Failed probe */ }
          results.push({ id: s.id, ms })
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, pending.length) }, worker))
      if (generation !== testGeneration.current) return
      setServers(p => p.map(s => { const r = results.find(r => r.id === s.id); return r ? { ...s, latencyMs: r.ms } : s }))
      setConnectNotice(connectedRef.current ? 'HTTP-проверка через каждый VPN-сервер завершена / VPN HTTP checks complete' : 'TCP-проверка завершена; она не проверяет авторизацию VPN / TCP reachability only')
    } catch (e) { if (generation === testGeneration.current) setConnectNotice(redact(String(e))) }
    finally { if (generation === testGeneration.current) { testingRef.current = false; setTesting(false) } }
  }
  const checkReachSite = async (id: string) => {
    const row = reachSites.find(r => r.id === id); if (!row) return
    setReachSites(p => p.map(r => r.id === id ? { ...r, status: 'checking' } : r))
    try {
      const url = row.url.includes('://') ? row.url : 'https://' + row.url
      const result = await coreCall<{ status: number; elapsedMs: number }>('core_probe', { url })
      const detail = `HTTP ${result.status} · ${result.elapsedMs} ms`
      setReachSites(p => p.map(r => r.id === id ? { ...r, status: result.status === 451 ? 'geo' : result.status === 403 ? 'blocked' : 'ok', detailRu: detail, detailEn: detail, checkedAtMs: Date.now() } : r))
    } catch (e) { setReachSites(p => p.map(r => r.id === id ? { ...r, status: 'error', detailRu: String(e), detailEn: String(e), checkedAtMs: Date.now() } : r)) }
  }
  const liveOutbound: OutboundProfile | null = connected ? { tag: servers.find(s => s.id === activeServerId)?.tag || '', app_transport: transport } : null
  return {
    version: '2.1.0', theme, setTheme, lang, setLang, transport, setTransport: (v: TransportMode) => { if (editable()) setTransportState(v) }, compactWindow, setCompactWindow: (v: boolean) => setCompactWindow(v),
    servers, activeServerId, activeTab, setActiveTab, connected, busy, testing, connectedSince, connectNotice, setConnectNotice, connectError,
    layoutWide, resolvedDark, rules, logs, pushLog, liveOutbound, activeVpnFlows, traffic, serverGroups, routingScenes, activeGroupId,
    setActiveGroup: (id: string | null) => { if (editable()) { setGroup(id); const group = serverGroups.find(g => g.id === id); if (group && !group.memberServerIds.includes(activeServerId || '')) setActive(group.memberServerIds[0] || null) } },
    advanced: { ...defaults, ...advanced }, setAdvanced: (patch: Partial<AdvancedAppSettings>) => { if (editable()) setAdvancedState(a => ({ ...defaults, ...a, ...patch })) },
    toggleConnect, setActiveServer, testLatencies,
    addServer: (s: Server) => { if (editable()) { const n = normalizeServer(s); if (n) { setServers(p => [...p, n]); setActive(n.id); if (activeGroupId) setGroups(p => p.map(g => g.id === activeGroupId ? { ...g, memberServerIds: [...g.memberServerIds, n.id] } : g)) } } },
    importServers: (items: Server[], subscriptionUrl?: string) => {
      if (!editable()) return false
      const group = subscriptionUrl ? serverGroups.find(g => g.subscriptionUrl === subscriptionUrl) : undefined
      const oldIds = new Set(group?.memberServerIds || [])
      setServers(p => [...p.filter(s => !oldIds.has(s.id)), ...items])
      setActive(items[0]?.id || activeServerId)
      if (subscriptionUrl || items.length > 1) {
        const next: ServerGroup = { id: group?.id || crypto.randomUUID(), name: group?.name || (subscriptionUrl ? new URL(subscriptionUrl).hostname : lang === 'ru' ? 'Импортированные серверы' : 'Imported servers'), memberServerIds: items.map(s => s.id), fallback: true, routing: 'config', sceneId: null, subscriptionUrl }
        setGroups(p => [...p.filter(g => g.id !== group?.id).map(g => ({ ...g, memberServerIds: g.memberServerIds.filter(id => !oldIds.has(id)) })), next])
        setGroup(next.id)
      } else setGroup(null)
      return true
    },
    updateServer: (s: Server) => { if (editable()) setServers(p => p.map(x => x.id === s.id ? s : x)) },
    removeServer: (id: string) => { if (editable()) { setServers(p => p.filter(s => s.id !== id)); setGroups(p => p.map(g => ({ ...g, memberServerIds: g.memberServerIds.filter(x => x !== id) }))); if (id === activeServerId) setActive(null) } },
    addRule: (pattern: string, mode: RuleMode) => { if (editable()) setRules(p => [...p, { id: crypto.randomUUID(), pattern, mode }]) },
    updateRule: (id: string, patch: Partial<ConfigRule>) => { if (editable()) setRules(p => p.map(r => r.id === id ? { ...r, ...patch } : r)) },
    removeRule: (id: string) => { if (editable()) setRules(p => p.filter(r => r.id !== id)) },
    addServerGroup: (g: ServerGroup) => { if (editable()) setGroups(p => [...p, g]) },
    updateServerGroup: (g: ServerGroup) => { if (editable()) setGroups(p => p.map(x => x.id === g.id ? g : x)) },
    removeServerGroup: (id: string) => { if (editable()) { setGroups(p => p.filter(g => g.id !== id)); if (activeGroupId === id) setGroup(null) } },
    addRoutingScene: (s: RoutingScene) => setScenes(p => [...p, s]), updateRoutingScene: (s: RoutingScene) => setScenes(p => p.map(x => x.id === s.id ? s : x)), removeRoutingScene: (id: string) => setScenes(p => p.filter(s => s.id !== id)),
    clearLogs: () => setLogs([]), loadSample: () => setConnectNotice('Добавьте действующие VPN-ссылки / Import valid VPN links'),
    autoScrollLog, setAutoScrollLog, logsEnabled, setLogsEnabled, testAfterStart, setTestAfterStart, maxLogLines, setMaxLogLines,
    reachSites, addReachSite: (url: string) => setReachSites(p => [...p, { id: crypto.randomUUID(), url, status: 'idle', detailRu: '', detailEn: '', checkedAtMs: null }]),
    removeReachSite: (id: string) => setReachSites(p => p.filter(r => r.id !== id)), setReachSiteUrl: (id: string, url: string) => setReachSites(p => p.map(r => r.id === id ? { ...r, url, status: 'idle' } : r)),
    checkReachSite, checkAllReachSites: () => { for (const r of reachSites) void checkReachSite(r.id) },
  }
}
const AppContext = createContext<ReturnType<typeof useAppValue> | null>(null)
export function AppProvider({ children }: { children: ReactNode }) { return <AppContext.Provider value={useAppValue()}>{children}</AppContext.Provider> }
export function useApp() { const ctx = useContext(AppContext); if (!ctx) throw new Error('useApp outside AppProvider'); return ctx }
