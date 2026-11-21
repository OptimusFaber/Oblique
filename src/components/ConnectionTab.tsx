import { useEffect, useState } from 'react'
import { ImportPanel } from './ImportPanel'
import { redactProfileForLog } from '../connection/buildOutboundProfile'
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

  const frameConnected = resolvedDark
    ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-neutral-950'
    : 'ring-2 ring-sky-500/90 ring-offset-2 ring-offset-neutral-100'

  const frameIdle = 'ring-0 border-0 bg-transparent shadow-none'

  const imgConnected = resolvedDark
    ? 'opacity-100 grayscale-0 [filter:drop-shadow(0_4px_18px_rgba(234,88,12,0.55))]'
    : 'opacity-100 grayscale-0 [filter:drop-shadow(0_4px_14px_rgba(14,165,233,0.4))]'

  const imgIdle = 'opacity-85 grayscale contrast-95'

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
    <div className="flex flex-1 flex-col gap-4 p-3 pb-5">
      <h1 className="px-1 text-2xl font-bold tracking-tight">Oblique</h1>
      <ImportPanel />
      {serverGroups.length > 0 && <label className="flex items-center gap-3 px-1 text-sm"><span>{lang === 'ru' ? 'Группа' : 'Group'}</span><select aria-label={lang === 'ru' ? 'Группа серверов' : 'Server group'} disabled={connected || busy} value={activeGroupId || ''} onChange={e => setActiveGroup(e.target.value || null)} className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"><option value="">{lang === 'ru' ? 'Все серверы' : 'All servers'}</option>{serverGroups.map(g => <option value={g.id} key={g.id}>{g.name} ({g.memberServerIds.length})</option>)}</select></label>}
      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex shrink-0 justify-end">
          <div className="flex rounded-full border border-neutral-200 bg-neutral-100 p-0.5 dark:border-neutral-700 dark:bg-neutral-900">
            {(['proxy', 'tunnel'] as const).map((m) => (
              <button
                key={m}
                type="button"
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

        <div className="flex flex-col items-center gap-2 px-1">
          <button
            type="button"
            disabled={busy} onClick={() => void toggleConnect()}
            className={
              'flex h-[8.5rem] w-[8.5rem] max-w-[min(8.5rem,calc(100vw-4rem))] shrink-0 items-center justify-center rounded-[1.35rem] transition-[box-shadow,ring] ' +
              (connected ? frameConnected : frameIdle)
            }
            aria-pressed={connected}
            aria-label={connected ? (lang === 'ru' ? 'Отключить VPN' : 'Disconnect VPN') : (lang === 'ru' ? 'Подключить VPN' : 'Connect VPN')}
          >
            <img
              src={SG_ASSETS.logo}
              alt=""
              className={
                'h-[7.25rem] w-[7.25rem] max-h-[min(7.25rem,calc(100vw-5rem))] max-w-[min(7.25rem,calc(100vw-5rem))] object-contain transition-all duration-200 ' +
                (connected ? imgConnected : imgIdle) + (resolvedDark ? '' : ' brightness-0')
              }
              draggable={false}
            />
          </button>
          <span
            className={
              'text-center text-sm font-semibold leading-snug ' +
              (connected
                ? resolvedDark
                  ? 'text-orange-400'
                  : 'text-sky-600'
                : 'text-neutral-500 dark:text-neutral-400')
            }
          >
            {busy ? (lang === 'ru' ? 'Подождите…' : 'Please wait…') : connected ? t(lang, 'connected') : t(lang, 'notConnected')}
          </span>
          {connectNotice ? (
            <p
              role="status"
              className="max-w-[min(24rem,100%)] text-center text-xs font-medium text-amber-800 dark:text-amber-200/90"
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

      {connected && liveOutbound && (
        <div className="shrink-0 rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2 dark:border-neutral-800 dark:bg-neutral-900/60">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {t(lang, 'activeProfile')}
          </p>
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-snug text-neutral-800 dark:text-orange-100/90">
            {JSON.stringify(redactProfileForLog(liveOutbound))}
          </pre>
        </div>
      )}

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
          className="flex h-14 w-full shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-2xl font-black text-neutral-700 hover:border-sky-400 hover:bg-sky-50 dark:border-neutral-600 dark:bg-neutral-900/50 dark:text-neutral-200 dark:hover:border-orange-500 dark:hover:bg-orange-950/20"
        >
          +
        </button>
      ) : (
        <>
          <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-visible rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full min-w-[520px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
                <tr>
                  <th className="w-11 px-2 py-2.5" />
                  <th className="w-9 px-1 py-2.5" title={t(lang, 'fieldCountry')}>
                    {lang === 'ru' ? 'Стр.' : 'CC'}
                  </th>
                  <th className="whitespace-nowrap px-2 py-2.5">{t(lang, 'tag')}</th>
                  <th className="whitespace-nowrap px-2 py-2.5">{t(lang, 'fieldType')}</th>
                  <th className="whitespace-nowrap px-2 py-2.5">{t(lang, 'host')}</th>
                  <th className="whitespace-nowrap px-2 py-2.5">{t(lang, 'port')}</th>
                  <th className="whitespace-nowrap px-2 py-2.5">{t(lang, 'latency')}</th>
                  <th className="w-[5.5rem] whitespace-nowrap px-1 py-2.5">{t(lang, 'edit')}</th>
                  <th className="w-[5.5rem] whitespace-nowrap px-1 py-2.5">{t(lang, 'delete')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {visibleServers.map((s) => {
                  const active = s.id === activeServerId
                  return (
                    <tr
                      key={s.id}
                      className={
                        active
                          ? 'bg-sky-50/90 dark:bg-orange-950/35'
                          : 'bg-white dark:bg-neutral-950/50'
                      }
                    >
                      <td className="px-2 py-2.5 align-middle">
                        {active ? (
                          <button
                            type="button"
                            onClick={() => setActiveServer(s.id)}
                            className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-sky-500 bg-sky-500 text-white dark:border-orange-500 dark:bg-gradient-to-br dark:from-orange-600 dark:to-red-600 dark:text-white"
                            aria-label={t(lang, 'active')}
                          >
                            <span className="h-2 w-2 rounded-full bg-white" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveServer(s.id)}
                            className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-neutral-300 bg-white hover:border-sky-400 dark:border-neutral-600 dark:bg-neutral-900 dark:hover:border-orange-500"
                            aria-label={t(lang, 'active')}
                          />
                        )}
                      </td>
                      <td className="px-1 py-2.5 text-center text-lg leading-none" title={s.countryCode || '—'}>
                        {s.countryCode ? countryCodeToFlagEmoji(s.countryCode) : '—'}
                      </td>
                      <td className="max-w-[100px] truncate px-2 py-2.5 font-medium text-neutral-900 dark:text-neutral-100">
                        {s.tag}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-neutral-600 dark:text-neutral-300">
                        {s.serverType}
                      </td>
                      <td className="max-w-[120px] truncate px-2 py-2.5 font-mono text-[11px] text-neutral-700 dark:text-neutral-200">
                        {s.host}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-mono text-neutral-700 dark:text-neutral-200">
                        {s.port}
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5 font-mono text-neutral-600 dark:text-neutral-300">
                        {s.latencyMs != null ? `${s.latencyMs} ms` : '—'}
                      </td>
                      <td className="px-1 py-2.5">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] font-bold uppercase text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-orange-300 dark:hover:bg-orange-950/40"
                        >
                          {t(lang, 'edit')}
                        </button>
                      </td>
                      <td className="px-1 py-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t(lang, 'deleteServerConfirm'))) removeServer(s.id)
                          }}
                          className="w-full rounded-lg border border-red-200/80 bg-red-50 px-2 py-1 text-[10px] font-bold uppercase text-red-800 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
                        >
                          {t(lang, 'delete')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-lg font-black text-white dark:bg-gradient-to-r dark:from-orange-700 dark:to-red-700 dark:text-white"
          >
            +
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
