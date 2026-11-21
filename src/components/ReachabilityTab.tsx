import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { t } from '../i18n'
import type { ReachStatus } from '../types'

type ReachI18n =
  | 'reach_idle'
  | 'reach_checking'
  | 'reach_ok'
  | 'reach_blocked'
  | 'reach_geo'
  | 'reach_timeout'
  | 'reach_error'
  | 'reach_limited'

const REACH_KEYS: Record<ReachStatus, ReachI18n> = {
  idle: 'reach_idle',
  checking: 'reach_checking',
  ok: 'reach_ok',
  blocked: 'reach_blocked',
  geo: 'reach_geo',
  timeout: 'reach_timeout',
  error: 'reach_error',
  limited: 'reach_limited',
}

function statusClass(s: ReachStatus): string {
  switch (s) {
    case 'ok':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'blocked':
      return 'text-red-600 dark:text-red-400'
    case 'geo':
    case 'limited':
      return 'text-amber-600 dark:text-amber-400'
    case 'timeout':
    case 'error':
      return 'text-orange-700 dark:text-orange-400'
    case 'checking':
      return 'text-sky-600 dark:text-orange-400 animate-pulse'
    default:
      return 'text-neutral-500 dark:text-neutral-400'
  }
}

export function ReachabilityTab() {
  const {
    lang,
    connected,
    reachSites,
    addReachSite,
    removeReachSite,
    setReachSiteUrl,
    checkReachSite,
    checkAllReachSites,
  } = useApp()
  const [draft, setDraft] = useState('')

  const statusLabel = (s: ReachStatus) => t(lang, REACH_KEYS[s] as Parameters<typeof t>[1])

  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      <p className="text-xs text-neutral-600 dark:text-neutral-400">{t(lang, 'reachHint')}</p>
      <p className="text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
        {t(lang, 'reachSimNote')}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-[160px] flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          placeholder={t(lang, 'reachPlaceholder')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              addReachSite(draft)
              setDraft('')
            }
          }}
        />
        <button
          type="button"
          className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 dark:bg-orange-700 dark:hover:bg-orange-600"
          onClick={() => {
            addReachSite(draft)
            setDraft('')
          }}
        >
          {t(lang, 'reachAdd')}
        </button>
        <button
          type="button"
          disabled={reachSites.length === 0}
          className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 disabled:opacity-40 dark:border-neutral-600 dark:text-neutral-100"
          onClick={() => checkAllReachSites()}
        >
          {t(lang, 'reachCheckAll')}
        </button>
      </div>

      {!connected && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {t(lang, 'reachNeedConnect')}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 dark:bg-neutral-900/80">
            <tr>
              <th className="px-3 py-2 font-medium text-neutral-500 dark:text-neutral-400">
                {t(lang, 'reachColSite')}
              </th>
              <th className="w-[7.5rem] px-2 py-2 font-medium text-neutral-500 dark:text-neutral-400">
                {t(lang, 'reachColState')}
              </th>
              <th className="px-2 py-2 font-medium text-neutral-500 dark:text-neutral-400">
                {t(lang, 'reachColInfo')}
              </th>
              <th className="w-24 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {reachSites.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-neutral-500">
                  {t(lang, 'reachEmpty')}
                </td>
              </tr>
            ) : (
              reachSites.map((row) => (
                <tr key={row.id} className="bg-white dark:bg-neutral-950/40">
                  <td className="px-3 py-2 align-top">
                    <input
                      className="w-full bg-transparent font-mono text-[11px] text-neutral-800 outline-none dark:text-neutral-200"
                      value={row.url}
                      onChange={(e) => setReachSiteUrl(row.id, e.target.value)}
                    />
                  </td>
                  <td className={`px-2 py-2 align-top font-semibold ${statusClass(row.status)}`}>
                    {statusLabel(row.status)}
                  </td>
                  <td className="px-2 py-2 align-top text-[11px] leading-snug text-neutral-600 dark:text-neutral-400">
                    {lang === 'ru' ? row.detailRu : row.detailEn}
                  </td>
                  <td className="px-2 py-2 align-top text-right">
                    <button
                      type="button"
                      className="mr-1 text-sky-600 hover:underline dark:text-orange-400"
                      onClick={() => checkReachSite(row.id)}
                    >
                      {t(lang, 'reachRecheck')}
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline dark:text-red-400"
                      onClick={() => removeReachSite(row.id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
