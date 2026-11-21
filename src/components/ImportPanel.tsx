import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { parseSubscription } from '../utils/parseServer'
import { coreCall } from '../lib/tauriCore'
export function ImportPanel() {
  const { lang, connected, busy, importServers, serverGroups } = useApp()
  const [text, setText] = useState(''), [url, setUrl] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(false)
  const ru = lang === 'ru'
  const apply = (raw: string, sourceUrl?: string) => {
    const profiles = parseSubscription(raw)
    if (!importServers(profiles, sourceUrl)) throw new Error(ru ? 'Отключитесь для импорта' : 'Disconnect to import')
    setText(''); setNotice(`${ru ? 'Добавлено профилей' : 'Profiles imported'}: ${profiles.length}`)
  }
  const cls = 'w-full rounded-lg border border-neutral-300 bg-transparent p-2 text-sm dark:border-neutral-700'
  return <details className="rounded-xl border border-neutral-300 p-3 dark:border-neutral-700"><summary className="cursor-pointer font-semibold">{ru ? 'Импорт профилей и подписок' : 'Import profiles and subscriptions'}</summary>
    <fieldset disabled={connected || busy || loading} className="mt-3 space-y-3 disabled:opacity-50">
      <textarea aria-label={ru ? 'VPN-ссылки' : 'VPN links'} className={cls} rows={3} value={text} onChange={e => setText(e.target.value)} placeholder={ru ? 'Вставьте VPN-ссылки или Base64-подписку' : 'Paste VPN links or Base64 subscription'} spellCheck={false} />
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => { try { apply(text) } catch (e) { setNotice(String(e)) } }} className="rounded-lg bg-sky-600 px-3 py-2 text-white dark:bg-orange-700">{ru ? 'Импортировать' : 'Import'}</button>
      <label className="cursor-pointer rounded-lg border px-3 py-2 text-sm">{ru ? 'Открыть файл' : 'Open file'}<input className="hidden" type="file" accept=".txt,.conf" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 2 * 1024 * 1024) { setNotice('Maximum 2 MiB'); return } try { apply(await f.text()) } catch (err) { setNotice(String(err)) } }} /></label></div>
      <input className={cls} type="url" aria-label={ru ? 'URL подписки' : 'Subscription URL'} placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} />
      <button type="button" onClick={async () => { setLoading(true); setNotice(''); try { apply(await coreCall<string>('fetch_subscription', { url }), url) } catch (e) { setNotice(String(e)) } finally { setLoading(false) } }} className="rounded-lg border px-3 py-2 text-sm">{ru ? 'Загрузить подписку' : 'Fetch subscription'}</button>
      {serverGroups.filter(g => g.subscriptionUrl).map(g => <div key={g.id} className="flex items-center justify-between gap-2 text-sm"><span>{g.name}</span><button type="button" className="rounded-lg border px-3 py-2" onClick={async () => { setLoading(true); try { apply(await coreCall<string>('fetch_subscription', { url: g.subscriptionUrl }), g.subscriptionUrl) } catch (e) { setNotice(String(e)) } finally { setLoading(false) } }}>{ru ? 'Обновить подписку' : 'Refresh subscription'}</button></div>)}
    </fieldset>
    {(connected || busy) && <p className="mt-2 text-xs">{ru ? 'Отключитесь для импорта' : 'Disconnect to import'}</p>}
    {notice && <p role="status" className="mt-2 break-words text-sm">{notice}</p>}
  </details>
}
