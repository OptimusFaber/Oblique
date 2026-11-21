import { AppProvider, useApp } from './context/AppContext'
import { t } from './i18n'
import { MainPanel } from './components/MainPanel'
import { Sidebar } from './components/Sidebar'

function Shell() {
  const { lang, version, compactWindow } = useApp()

  return (
    <div
      className={
        'flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 ' +
        (compactWindow ? 'flex-row' : 'flex-col')
      }
    >
      <div className={compactWindow ? 'flex min-h-0 flex-1' : 'flex min-h-0 flex-1 flex-col'}>
        <Sidebar orientation={compactWindow ? 'left' : 'top'} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <MainPanel />
        </main>
      </div>

      <footer className={'shrink-0 border-neutral-200 text-center text-[10px] leading-tight text-neutral-400 dark:border-neutral-800 dark:text-neutral-500 ' + (compactWindow ? 'border-l px-1 py-2 [writing-mode:vertical-rl]' : 'border-t px-3 py-2')}>
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
