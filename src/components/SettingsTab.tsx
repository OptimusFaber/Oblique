import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { t } from '../i18n'
import { SG_UI_ICONS } from '../lib/sgAssets'
import type { Lang, ThemeChoice } from '../types'

const inlineIconClass =
  'h-4 w-4 shrink-0 object-contain brightness-0 dark:invert'

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-950/80">
      <span className="text-sm text-neutral-800 dark:text-neutral-200">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 rounded border-neutral-300 text-sky-600 focus:ring-sky-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-orange-500 dark:focus:ring-orange-500"
      />
    </label>
  )
}

export function SettingsTab() {
  const {
    lang,
    setLang,
    theme,
    setTheme,
    version,
    autoScrollLog,
    setAutoScrollLog,
    logsEnabled,
    setLogsEnabled,
    maxLogLines,
    setMaxLogLines,
    connected,
    busy,
    advanced,
    setAdvanced,
    compactWindow,
    setCompactWindow,
  } = useApp()
  const [advOpen, setAdvOpen] = useState(false)

  return (
    <div className="flex flex-1 flex-col gap-4 p-3 pb-5">
      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <span className="mb-1 flex items-center gap-2">
          <img src={SG_UI_ICONS.themeChange} alt="" className={inlineIconClass} draggable={false} />
          {t(lang, 'theme')}
        </span>
        <select
          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeChoice)}
        >
          <option value="system">{t(lang, 'system')}</option>
          <option value="light">{t(lang, 'light')}</option>
          <option value="dark">{t(lang, 'dark')}</option>
        </select>
      </label>

      <p className="text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
        {t(lang, 'themeSettingsNote')}
      </p>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">{lang === 'ru' ? 'Окно приложения' : 'Application window'}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={!compactWindow} onClick={() => setCompactWindow(false)} className={'rounded-xl border px-3 py-3 text-sm font-semibold ' + (!compactWindow ? 'border-sky-500 bg-sky-50 dark:border-orange-500 dark:bg-orange-950/30' : 'border-neutral-200 dark:border-neutral-800')}>{lang === 'ru' ? 'Полное окно' : 'Full window'}</button>
          <button type="button" aria-pressed={compactWindow} onClick={() => setCompactWindow(true)} className={'rounded-xl border px-3 py-3 text-sm font-semibold ' + (compactWindow ? 'border-sky-500 bg-sky-50 dark:border-orange-500 dark:bg-orange-950/30' : 'border-neutral-200 dark:border-neutral-800')}>{lang === 'ru' ? 'Компактное' : 'Compact'}</button>
        </div>
        <p className="text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">{lang === 'ru' ? 'Компактный режим — узкое вертикальное окно для быстрого подключения.' : 'Compact mode uses a narrow vertical window for quick connection.'}</p>
      </div>

      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <span className="mb-1 flex items-center gap-2">
          <img src={SG_UI_ICONS.language} alt="" className={inlineIconClass} draggable={false} />
          {t(lang, 'language')}
        </span>
        <select
          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
        >
          <option value="ru">Русский</option>
          <option value="en">English</option>
        </select>
      </label>

      <p className="text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
        {t(lang, 'languageSettingsNote')}
      </p>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
          {t(lang, 'simpleSettings')}
        </p>
        <ToggleRow
          label={t(lang, 'autoScrollLog')}
          checked={autoScrollLog}
          onChange={setAutoScrollLog}
        />
        <ToggleRow
          label={t(lang, 'logsEnabled')}
          checked={logsEnabled}
          onChange={setLogsEnabled}
        />
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t(lang, 'maxLogLines')}
          <select
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            value={maxLogLines}
            onChange={(e) => setMaxLogLines(Number(e.target.value))}
          >
            {[100, 200, 300, 500, 1000, 2000].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold text-neutral-800 dark:text-neutral-200"
          onClick={() => setAdvOpen((o) => !o)}
          aria-expanded={advOpen}
        >
          {t(lang, 'advancedSettings')}
          <span className="text-neutral-400">{advOpen ? '▾' : '▸'}</span>
        </button>
        {advOpen && (
          <fieldset disabled={connected || busy} className="space-y-2 border-t border-neutral-200 px-3 pb-3 pt-2 dark:border-neutral-700 disabled:opacity-50">
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{t(lang, 'advancedHint')}</p>
            <ToggleRow
              label={t(lang, 'advDnsOverHttps')}
              checked={advanced.dnsOverHttps}
              onChange={(v) => setAdvanced({ dnsOverHttps: v })}
            />
            <ToggleRow
              label={t(lang, 'advIpv6')}
              checked={advanced.ipv6}
              onChange={(v) => setAdvanced({ ipv6: v })}
            />
            <ToggleRow
              label={t(lang, 'advBypassLan')}
              checked={advanced.bypassLan}
              onChange={(v) => setAdvanced({ bypassLan: v })}
            />
            <ToggleRow
              label={t(lang, 'advMux')}
              checked={advanced.mux}
              onChange={(v) => setAdvanced({ mux: v })}
            />
            <ToggleRow
              label={t(lang, 'advSniff')}
              checked={advanced.sniff}
              onChange={(v) => setAdvanced({ sniff: v })}
            />
            <ToggleRow
              label={t(lang, 'advStrictRouting')}
              checked={advanced.strictRouting}
              onChange={(v) => setAdvanced({ strictRouting: v })}
            />
            <ToggleRow
              label={t(lang, 'advBlockQuic')}
              checked={advanced.blockQuic}
              onChange={(v) => setAdvanced({ blockQuic: v })}
            />
          </fieldset>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        {t(lang, 'desktopParityHint')}
      </p>

      <div className="mt-auto border-t border-neutral-200 pt-3 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        {t(lang, 'version')}: <span className="font-mono font-semibold">{version}</span>
      </div>
    </div>
  )
}
