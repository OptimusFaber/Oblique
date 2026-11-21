import { useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { t } from '../i18n'

export function LogsTab({ embed = false }: { embed?: boolean }) {
  const { lang, logs, clearLogs, autoScrollLog } = useApp()
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!autoScrollLog || !boxRef.current) return
    boxRef.current.scrollTop = 0
  }, [logs, autoScrollLog])

  return (
    <div
      className={embed ? 'flex flex-1 flex-col gap-1.5 py-1' : 'flex flex-1 flex-col gap-2 p-3'}
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={clearLogs}
          className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          {t(lang, 'clearLogs')}
        </button>
      </div>
      <div
        ref={boxRef}
        className="max-h-[min(420px,50vh)] flex-1 overflow-auto rounded-xl border border-neutral-200 bg-neutral-950 p-2 font-mono text-[11px] leading-relaxed text-emerald-300 dark:border-neutral-800"
      >
        {logs.length === 0 ? (
          <span className="text-neutral-500">—</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
