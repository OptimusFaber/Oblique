import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { t } from '../i18n'
import type { RuleMode, ServerGroup } from '../types'

export function ConfigsTab() {
  const {
    lang,
    rules,
    addRule,
    updateRule,
    removeRule,
    servers,
    serverGroups,
    addServerGroup,
    updateServerGroup,
    removeServerGroup,
    connected,
    busy,
  } = useApp()
  const [pattern, setPattern] = useState('')
  const [mode, setMode] = useState<RuleMode>('vpn')

  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState<Record<string, boolean>>({})
  const [groupFallback, setGroupFallback] = useState(true)

  const presets: { labelKey: 'presetLocalDirect' | 'presetStreamVpn' | 'presetBlockAds'; p: string; m: RuleMode }[] =
    [
      { labelKey: 'presetLocalDirect', p: '*.local', m: 'direct' },
      { labelKey: 'presetStreamVpn', p: '*.netflix.com', m: 'vpn' },
      { labelKey: 'presetBlockAds', p: 'ads.*', m: 'block' },
    ]

  const toggleMember = (id: string) => {
    setGroupMembers((m) => ({ ...m, [id]: !m[id] }))
  }

  const commitGroup = () => {
    const memberServerIds = Object.entries(groupMembers)
      .filter(([, v]) => v)
      .map(([k]) => k)
    const g: ServerGroup = {
      id: `grp-${Date.now()}`,
      name: groupName.trim() || (lang === 'ru' ? 'Группа' : 'Group'),
      memberServerIds,
      fallback: groupFallback,
      routing: 'config',
      sceneId: null,
    }
    addServerGroup(g)
    setGroupName('')
    setGroupMembers({})
  }

  return (
    <fieldset disabled={connected || busy} className="flex flex-1 flex-col gap-3 p-3 pb-6 disabled:opacity-60">
      <p className="text-xs text-neutral-600 dark:text-neutral-400">{t(lang, 'configsHint')}</p>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
        <p className="text-sm font-bold text-neutral-800 dark:text-neutral-100">{t(lang, 'groupsTitle')}</p>
        <p className="mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">{t(lang, 'groupsHint')}</p>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300">
          {t(lang, 'groupName')}
          <input
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </label>
        <p className="mb-1 mt-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
          {t(lang, 'groupMembers')}
        </p>
        <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 p-2 dark:border-neutral-700">
          {servers.length === 0 ? (
            <span className="text-xs text-neutral-500">{t(lang, 'groupNoServers')}</span>
          ) : (
            servers.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={!!groupMembers[s.id]}
                  onChange={() => toggleMember(s.id)}
                />
                <span className="truncate">
                  {s.tag} <span className="text-neutral-500">({s.serverType})</span>
                </span>
              </label>
            ))
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={groupFallback}
              onChange={(e) => setGroupFallback(e.target.checked)}
            />
            {t(lang, 'groupFallback')}
          </label>
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 dark:bg-orange-700 dark:hover:bg-orange-600"
          onClick={commitGroup}
        >
          {t(lang, 'groupCreate')}
        </button>

        {serverGroups.length > 0 && (
          <ul className="mt-3 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
            {serverGroups.map((g) => (
              <li
                key={g.id}
                className="rounded-lg border border-neutral-200 bg-white p-2 text-xs dark:border-neutral-700 dark:bg-neutral-950/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <input
                      className="w-full bg-transparent font-semibold"
                      value={g.name}
                      onChange={(e) => updateServerGroup({ ...g, name: e.target.value })}
                    />
                    <div className="text-neutral-500">
                      {t(lang, 'groupFallback')}: {g.fallback ? 'on' : 'off'} · {g.routing}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-red-600 dark:text-red-400"
                    onClick={() => removeServerGroup(g.id)}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
          {t(lang, 'configsQuickTitle')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((x) => (
            <button
              key={x.labelKey}
              type="button"
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              onClick={() => addRule(x.p, x.m)}
            >
              {t(lang, x.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[140px] flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          placeholder={t(lang, 'pattern')}
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        />
        <select
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          value={mode}
          onChange={(e) => setMode(e.target.value as RuleMode)}
        >
          <option value="vpn">{t(lang, 'ruleVpn')}</option>
          <option value="direct">{t(lang, 'ruleDirect')}</option>
          <option value="block">{t(lang, 'ruleBlock')}</option>
        </select>
        <button
          type="button"
          onClick={() => {
            if (!pattern.trim()) return
            addRule(pattern.trim(), mode)
            setPattern('')
          }}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 dark:bg-orange-700 dark:hover:bg-orange-600"
        >
          {t(lang, 'addRule')}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-50 dark:bg-neutral-900/80">
            <tr>
              <th className="px-3 py-2 font-medium text-neutral-500 dark:text-neutral-400">
                {t(lang, 'pattern')}
              </th>
              <th className="px-3 py-2 font-medium text-neutral-500 dark:text-neutral-400">
                {t(lang, 'mode')}
              </th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-neutral-500">
                  —
                </td>
              </tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id} className="bg-white dark:bg-neutral-950/40">
                  <td className="px-3 py-2 font-mono text-neutral-800 dark:text-neutral-200">
                    <input
                      className="w-full bg-transparent outline-none"
                      value={r.pattern}
                      onChange={(e) => updateRule(r.id, { pattern: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                      value={r.mode}
                      onChange={(e) =>
                        updateRule(r.id, { mode: e.target.value as RuleMode })
                      }
                    >
                      <option value="vpn">{t(lang, 'ruleVpn')}</option>
                      <option value="direct">{t(lang, 'ruleDirect')}</option>
                      <option value="block">{t(lang, 'ruleBlock')}</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeRule(r.id)}
                      className="text-red-600 hover:underline dark:text-red-400"
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
    </fieldset>
  )
}
