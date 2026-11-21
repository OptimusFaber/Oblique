import { AppProvider, useApp } from './context/AppContext'
import { t } from './i18n'
import { MainPanel } from './components/MainPanel'
import { Sidebar } from './components/Sidebar'

function Shell() {
  const { layoutWide, lang, version } = useApp()

  return (
    <div
      className={
        'flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 ' +
        (layoutWide ? '' : 'mx-auto max-w-[400px] shadow-xl ring-1 ring-black/5 dark:ring-white/10')
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {layoutWide ? (
          <>
            <Sidebar orientation="top" />
            <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
              <MainPanel />
            </main>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-row">
            <Sidebar orientation="left" />
            <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
              <MainPanel />
            </main>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-neutral-200 px-3 py-2 text-center text-[10px] leading-tight text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
        Oblique · {t(lang, 'version')} {version}
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
