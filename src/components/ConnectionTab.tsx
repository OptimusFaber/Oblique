import { useEffect, useState } from 'react'
import { ImportPanel } from './ImportPanel'
import { useApp } from '../context/AppContext'
import { t } from '../i18n'
import { SG_ASSETS, SG_UI_ICONS } from '../lib/sgAssets'
import type { Server } from '../types'
import { countryCodeToFlagEmoji } from '../utils/countryFlags'
import { ServerEditorModal } from './ServerEditorModal'

function formatSessionClock(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const inlineIconClass =
  'h-4 w-4 shrink-0 object-contain brightness-0 dark:invert'

export function ConnectionTab() {
  const {
    lang,
    transport,
    setTransport,
    connected,
    busy,
    testing,
    connectedSince,
    toggleConnect,
    servers,
    activeServerId,
    setActiveServer,
    addServer,
    updateServer,
    removeServer,
    testLatencies,
    resolvedDark,
    liveOutbound,
    serverGroups,
    activeGroupId,
    setActiveGroup,
    connectNotice,
    connectError,
    compactWindow,
  } = useApp()

  const [, setTick] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<Server | null>(null)

  useEffect(() => {
    if (!connected || !connectedSince) return
    const id = window.setInterval(() => setTick((x) => x + 1), 1000)
    return () => window.clearInterval(id)
  }, [connected, connectedSince])

  const visibleServers = activeGroupId ? servers.filter(s => serverGroups.find(g => g.id === activeGroupId)?.memberServerIds.includes(s.id)) : servers

  const uptime =
    connected && connectedSince
      ? formatSessionClock(Date.now() - connectedSince)
      : '00:00:00'

  const visualState = connected ? 'connected' : connectError ? 'error' : 'idle'
  const selectedServer = servers.find(s => s.id === activeServerId)

  const openAdd = () => {
    setEditingServer(null)
    setModalOpen(true)
  }

  const openEdit = (s: Server) => {
    setEditingServer(s)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingServer(null)
  }

  const submitServer = (s: Server) => {
    if (editingServer) updateServer(s)
    else addServer(s)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 p-3 pb-5">
      <div className="flex items-center justify-between gap-2 px-1">
        <h1 className="text-2xl font-bold tracking-tight">Oblique</h1>
        <span className="text-[10px] text-neutral-500">{compactWindow ? (lang === 'ru' ? 'Компактное окно' : 'Compact window') : (lang === 'ru' ? 'Полное окно' : 'Full window')}</span>
      </div>
      <ImportPanel />
      {serverGroups.length > 0 && <label className="flex items-center gap-3 px-1 text-sm"><span>{lang === 'ru' ? 'Группа' : 'Group'}</span><select aria-label={lang === 'ru' ? 'Группа серверов' : 'Server group'} disabled={connected || busy} value={activeGroupId || ''} onChange={e => setActiveGroup(e.target.value || null)} className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"><option value="">{lang === 'ru' ? 'Все серверы' : 'All servers'}</option>{serverGroups.map(g => <option value={g.id} key={g.id}>{g.name} ({g.memberServerIds.length})</option>)}</select></label>}
      <div className="flex shrink-0 flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="flex shrink-0 justify-end">
          <div className="flex rounded-full border border-neutral-200 bg-neutral-100 p-0.5 dark:border-neutral-700 dark:bg-neutral-900">
            {(['proxy', 'tunnel'] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={connected || busy}
                onClick={() => setTransport(m)}
                className={
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ' +
                  (transport === m
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
                    : 'text-neutral-500 dark:text-neutral-400')
                }
              >
                {t(lang, m)}
              </button>
            ))}
          </div>
        </div>
        <p className="text-right text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
          {transport === 'proxy'
            ? (lang === 'ru' ? 'Прокси для приложений, использующих настройки системы' : 'Proxy for apps using system proxy settings')
            : (lang === 'ru' ? 'TUN направляет системный трафик через VPN' : 'TUN routes system traffic through VPN')}
        </p>

        <div className="flex flex-col items-center gap-2 px-1">
          <button
            type="button"
            disabled={busy} onClick={() => void toggleConnect()}
            className={
              'flex h-[8.5rem] w-[8.5rem] max-w-[min(8.5rem,calc(100vw-4rem))] shrink-0 items-center justify-center rounded-[1.8rem] border-2 bg-[#0b172b] transition-all duration-300 ' +
              (visualState === 'connected' ? 'border-cyan-300 shadow-[0_0_22px_4px_rgba(34,211,238,.48),inset_0_0_18px_rgba(56,189,248,.22)]' : visualState === 'error' ? 'border-orange-500 shadow-[0_0_20px_3px_rgba(239,68,68,.45)]' : 'border-slate-700 hover:border-sky-400 hover:shadow-[0_0_16px_rgba(56,189,248,.2)]')
            }
            aria-pressed={connected}
            aria-label={connected ? (lang === 'ru' ? 'Отключить VPN' : 'Disconnect VPN') : (lang === 'ru' ? 'Подключить VPN' : 'Connect VPN')}
          >
            <img
              src={SG_ASSETS.logo}
              alt=""
              className={
                'h-[7rem] w-[7rem] max-h-[min(7rem,calc(100vw-5rem))] max-w-[min(7rem,calc(100vw-5rem))] object-contain transition-all duration-300 ' +
                (visualState === 'connected' ? '[filter:drop-shadow(0_0_13px_rgba(56,189,248,.95))]' : visualState === 'error' ? '[filter:drop-shadow(0_0_12px_rgba(249,115,22,.9))]' : 'opacity-90')
              }
              draggable={false}
            />
          </button>
          <span
            className={
              'text-center text-sm font-semibold leading-snug ' +
              (connected ? 'text-sky-600 dark:text-cyan-300' : connectError ? 'text-orange-600 dark:text-orange-400' : 'text-neutral-500 dark:text-neutral-400')
            }
          >
            {busy ? (lang === 'ru' ? 'Подключаем…' : 'Connecting…') : connected ? t(lang, 'connected') : connectError ? (lang === 'ru' ? 'Ошибка подключения' : 'Connection failed') : t(lang, 'notConnected')}
          </span>
          <span className="text-center text-xs text-neutral-500 dark:text-neutral-400">{connected ? (lang === 'ru' ? 'Нажмите, чтобы отключить' : 'Click to disconnect') : (lang === 'ru' ? 'Нажмите, чтобы подключить' : 'Click to connect')}</span>
          {connectNotice ? (
            <p
              role="status"
              className={'max-w-[min(24rem,100%)] text-center text-xs font-medium ' + (connectError ? 'text-orange-700 dark:text-orange-300' : 'text-neutral-600 dark:text-neutral-300')}
            >
              {connectNotice}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2 text-center">
        <img src={SG_UI_ICONS.timer} alt="" className={inlineIconClass} draggable={false} />
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t(lang, 'uptime')}:
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
          {uptime}
        </span>
      </div>

      {connected && liveOutbound && selectedServer && <div className="shrink-0 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/60">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{t(lang, 'activeProfile')}</p>
        <p className="truncate text-sm font-semibold">{selectedServer.tag}</p>
        <p className="truncate font-mono text-[11px] text-neutral-500">{selectedServer.host}:{selectedServer.port}</p>
      </div>}

      <div className="flex shrink-0 items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-bold text-neutral-800 dark:text-neutral-100">
          {t(lang, 'servers')}
        </h3>
        <button
          type="button"
          disabled={busy || testing} onClick={() => void testLatencies()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <img src={SG_UI_ICONS.test} alt="" className={inlineIconClass} draggable={false} />
          {t(lang, 'test')}
        </button>
      </div>

      {visibleServers.length === 0 ? (
        <button
          type="button"
          onClick={openAdd}
          className="flex h-14 w-full shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-sm font-bold text-neutral-700 hover:border-sky-400 hover:bg-sky-50 dark:border-neutral-600 dark:bg-neutral-900/50 dark:text-neutral-200 dark:hover:border-orange-500 dark:hover:bg-orange-950/20"
        >
          {lang === 'ru' ? '+ Добавить VPN-сервер' : '+ Add VPN server'}
        </button>
      ) : (
        <>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {visibleServers.map((s) => {
                const active = s.id === activeServerId
                return <li key={s.id} className={'p-3 ' + (active ? 'bg-sky-50/90 dark:bg-sky-950/25' : 'bg-white dark:bg-neutral-950/50')}>
                  <div className="flex min-w-0 items-center gap-2">
                    <button type="button" onClick={() => setActiveServer(s.id)} aria-label={t(lang, 'active')} aria-pressed={active} className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ' + (active ? 'border-cyan-400 bg-sky-600' : 'border-neutral-300 dark:border-neutral-600')}>
                      {active && <span className="h-2 w-2 rounded-full bg-white" />}
                    </button>
                    <span className="shrink-0 text-xl" title={s.countryCode || (lang === 'ru' ? 'Страна неизвестна' : 'Country unknown')}>{s.countryCode ? countryCodeToFlagEmoji(s.countryCode) : '🌐'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.tag}</div>
                      <div className="truncate font-mono text-[11px] text-neutral-500 dark:text-neutral-400">{s.host}:{s.port} · {s.serverType.toUpperCase()}</div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-xs text-neutral-500">{s.latencyMs != null ? `${s.latencyMs} ms` : '—'}</div>
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => openEdit(s)} className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold dark:border-neutral-700">{t(lang, 'edit')}</button>
                    <button type="button" onClick={() => { if (window.confirm(t(lang, 'deleteServerConfirm'))) removeServer(s.id) }} className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-900 dark:text-red-300">{t(lang, 'delete')}</button>
                  </div>
                </li>
              })}
            </ul>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-sm font-bold text-white dark:bg-gradient-to-r dark:from-sky-700 dark:to-cyan-700 dark:text-white"
          >
            {lang === 'ru' ? '+ Добавить сервер' : '+ Add server'}
          </button>
        </>
      )}

      <ServerEditorModal
        open={modalOpen}
        onClose={closeModal}
        initial={editingServer}
        onSubmit={submitServer}
        lang={lang}
        resolvedDark={resolvedDark}
        servers={servers}
        serverGroups={serverGroups}
      />
    </div>
  )
}
