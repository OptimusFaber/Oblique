import { t } from '../i18n'
import { SG_ASSETS } from '../lib/sgAssets'
import type { TabId } from '../types'
import { useApp } from '../context/AppContext'

const tabs: TabId[] = [
  'connection',
  'configs',
  'traffic',
  'settings',
  'reachability',
]

const shortLabels: Record<TabId, { ru: string; en: string }> = {
  connection: { ru: 'Главная', en: 'Home' },
  configs: { ru: 'Маршруты', en: 'Routing' },
  traffic: { ru: 'Трафик', en: 'Traffic' },
  settings: { ru: 'Опции', en: 'Options' },
  reachability: { ru: 'Сайты', en: 'Sites' },
}

export function Sidebar({ orientation }: { orientation: 'left' | 'top' }) {
  const { activeTab, setActiveTab, lang, resolvedDark } = useApp()
  const isTop = orientation === 'top'

  return (
    <nav
      className={
        isTop
          ? 'flex w-full shrink-0 flex-nowrap items-center justify-around gap-0.5 overflow-x-auto overflow-y-hidden border-b border-neutral-200 bg-neutral-50/95 px-1 py-1 dark:border-neutral-800 dark:bg-neutral-950/90'
          : 'flex w-[76px] shrink-0 flex-col items-center gap-1.5 overflow-y-auto overflow-x-hidden border-r border-neutral-200 bg-neutral-50/95 px-1 py-3 dark:border-neutral-800 dark:bg-neutral-950/90'
      }
      aria-label="Navigation"
    >
      {tabs.map((id) => {
        const on = activeTab === id
        const src = SG_ASSETS.tab[id]
        const iconLight = !resolvedDark
        const iconTone =
          'object-contain object-center ' +
          (iconLight ? 'brightness-0 ' : 'brightness-0 invert ')
        return (
          <button
            key={id}
            type="button"
            title={t(lang, id)}
            onClick={() => setActiveTab(id)}
            className={
              (isTop
                ? 'min-w-[60px] flex-1 flex-col px-1 py-1'
                : 'flex w-full flex-col items-center justify-center px-1 py-2.5') +
              ' flex items-center justify-center rounded-xl transition-colors ' +
              (on
                ? 'bg-sky-500/15 dark:bg-orange-500/15'
                : 'hover:bg-neutral-200/90 dark:hover:bg-neutral-800/90')
            }
          >
            <span className="flex h-7 w-7 items-center justify-center">
              <img
                src={src}
                alt=""
                className={
                  (isTop ? 'h-6 w-6' : 'h-10 w-10') +
                  ' max-h-10 max-w-10 ' +
                  iconTone +
                  (on
                    ? iconLight
                      ? 'opacity-100'
                      : 'opacity-100 saturate-110'
                    : iconLight
                      ? 'opacity-50'
                      : 'opacity-60')
                }
                draggable={false}
              />
            </span>
            {isTop && (
              <span className="mt-0.5 w-full truncate whitespace-nowrap text-center text-[10px] font-semibold leading-tight text-neutral-700 dark:text-neutral-200">
                <span className="sm:hidden">{shortLabels[id][lang]}</span><span className="hidden sm:inline">{t(lang, id)}</span>
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
