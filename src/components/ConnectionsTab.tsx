import { useApp } from '../context/AppContext'
import { t } from '../i18n'
import { displayDestination, formatFlowTraffic, protocolCell } from '../utils/flowFormat'

export function ConnectionsTab({ embed = false }: { embed?: boolean }) {
  const { lang, transport, connected, activeVpnFlows } = useApp()

  return (
    <div
      className={
        embed
          ? 'flex flex-1 flex-col gap-2 py-1'
          : 'flex flex-1 flex-col gap-3 p-3'
      }
    >
      <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
        {t(lang, 'connectionsHint')}
      </p>
      <p className="text-[11px] text-neutral-500">
        {lang === 'ru' ? 'Транспорт приложения:' : 'App transport:'}{' '}
        <span className="font-semibold text-neutral-700 dark:text-neutral-200">{t(lang, transport)}</span>
      </p>

      {!connected ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-600">
          {t(lang, 'connectionsDisconnected')}
        </div>
      ) : activeVpnFlows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-600">
          …
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead className="bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="whitespace-nowrap px-2 py-2.5">{t(lang, 'connDestination')}</th>
                <th className="whitespace-nowrap px-2 py-2.5">{t(lang, 'connProcess')}</th>
                <th className="whitespace-nowrap px-2 py-2.5">{t(lang, 'connProtocol')}</th>
                <th className="whitespace-nowrap px-2 py-2.5">{t(lang, 'connOutbound')}</th>
                <th className="whitespace-nowrap px-2 py-2.5">{t(lang, 'connTraffic')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {activeVpnFlows.map((flow) => (
                <tr key={flow.id} className="bg-white dark:bg-neutral-950/50">
                  <td className="max-w-[140px] truncate px-2 py-2 font-medium text-neutral-900 dark:text-neutral-100">
                    {displayDestination(flow)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-neutral-700 dark:text-neutral-300">
                    {flow.process}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                    {protocolCell(flow.network, flow.protocol)}
                  </td>
                  <td className="max-w-[120px] truncate px-2 py-2 text-neutral-600 dark:text-neutral-300">
                    {flow.outbound}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                    {formatFlowTraffic(flow.upload, flow.download)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {connected && (
        <p className="text-[10px] leading-snug text-neutral-500 dark:text-neutral-500">
          {lang === 'ru' ? 'Данные ядра VPN. Имя процесса может быть недоступно на вашей системе.' : 'Live VPN core data. Process names may be unavailable on your system.'}
        </p>
      )}
    </div>
  )
}
