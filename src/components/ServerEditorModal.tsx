import { useEffect, useState } from 'react'
import type { Lang, Server, ServerGroup } from '../types'
import { normalizeServer, parseServerFromText } from '../utils/parseServer'
import { COMMON_COUNTRY_OPTIONS } from '../utils/countryFlags'

const field = 'mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950'
export function ServerEditorModal({ open, onClose, initial, onSubmit, lang }: {
  open: boolean; onClose: () => void; initial: Server | null; onSubmit: (s: Server) => void; lang: Lang;
  resolvedDark: boolean; servers: Server[]; serverGroups: ServerGroup[]
}) {
  const [form, setForm] = useState<Partial<Server>>({})
  const [uri, setUri] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setForm(initial || { serverType: 'vless', port: 443, tls: true, transport: 'tcp' }); setError(''); setUri('') } }, [open, initial])
  if (!open) return null
  const ru = lang === 'ru'
  const patch = (p: Partial<Server>) => setForm(f => ({ ...f, ...p }))
  const textField = (key: keyof Server, label: string, secret = false) => <label className="block text-sm" key={key}>{label}<input className={field} type={secret ? 'password' : 'text'} value={String(form[key] ?? '')} onChange={e => patch({ [key]: e.target.value })} autoComplete="off" /></label>
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <form onSubmit={e => { e.preventDefault(); const s = normalizeServer(form); if (!s) { setError(ru ? 'Проверьте адрес и порт (1–65535)' : 'Check host and port (1–65535)'); return } onSubmit(s); onClose() }} className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900" role="dialog" aria-modal="true" aria-label={ru ? 'VPN-профиль' : 'VPN profile'}>
      <h2 className="mb-3 text-xl font-bold">{initial ? (ru ? 'Изменить профиль' : 'Edit profile') : (ru ? 'Добавить профиль' : 'Add profile')}</h2>
      <div className="space-y-3 overflow-y-auto px-1">
        <label className="block text-sm">{ru ? 'VPN-ссылка' : 'VPN link'}<textarea className={field} value={uri} onChange={e => setUri(e.target.value)} placeholder="vless://…" spellCheck={false} /></label>
        <button type="button" className="rounded-lg border px-3 py-2" onClick={() => { const s = parseServerFromText(uri); if (!s) setError(ru ? 'Не удалось разобрать ссылку' : 'Invalid link'); else { setForm({ ...s, id: initial?.id }); setError('') } }}>{ru ? 'Заполнить из ссылки' : 'Apply link'}</button>
        {textField('tag', ru ? 'Название' : 'Name')}
        <label className="block text-sm">{ru ? 'Протокол' : 'Protocol'}<select className={field} value={form.serverType || 'vless'} onChange={e => patch({ serverType: e.target.value })}>{['vless','vmess','trojan','shadowsocks','socks5','http','https'].map(p => <option key={p}>{p}</option>)}</select></label>
        {textField('host', ru ? 'Адрес сервера' : 'Server host')}
        <label className="block text-sm">{ru ? 'Страна сервера' : 'Server country'}
          <select className={field} value={form.countryCode || ''} onChange={e => patch({ countryCode: e.target.value })}>
            <option value="">{ru ? 'Определить автоматически' : 'Detect automatically'}</option>
            {COMMON_COUNTRY_OPTIONS.map(country => <option value={country.code} key={country.code}>{ru ? country.ru : country.en}</option>)}
          </select>
        </label>
        <label className="block text-sm">{ru ? 'Порт' : 'Port'}<input className={field} type="number" min={1} max={65535} value={form.port ?? 443} onChange={e => patch({ port: Number(e.target.value) })} required /></label>
        {['socks5','http','https'].includes(form.serverType || '') && textField('username', ru ? 'Пользователь' : 'Username')}
        {textField('password', ['vless','vmess'].includes(form.serverType || '') ? 'UUID' : (ru ? 'Пароль' : 'Password'), true)}
        {form.serverType === 'shadowsocks' && textField('method', ru ? 'Шифр (например aes-256-gcm)' : 'Cipher (e.g. aes-256-gcm)')}
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.tls ?? false} onChange={e => patch({ tls: e.target.checked })} />TLS</label>
        {form.tls && <>{textField('sni', 'TLS SNI')}{textField('fingerprint', 'uTLS fingerprint (chrome, firefox, safari…)')}
          {textField('realityPublicKey', 'Reality public key')}{textField('realityShortId', 'Reality short ID')}
          <label className="block text-sm">ALPN<input className={field} value={form.alpn?.join(',') || ''} onChange={e => patch({ alpn: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.insecure ?? false} onChange={e => patch({ insecure: e.target.checked })} />{ru ? 'Разрешить недействительный сертификат' : 'Allow invalid certificate'}</label>
        </>}
        {['vless','vmess','trojan'].includes(form.serverType || '') && <>
          <label className="block text-sm">{ru ? 'Транспорт' : 'Transport'}<select className={field} value={form.transport || 'tcp'} onChange={e => patch({ transport: e.target.value })}>{['tcp','ws','grpc','http','httpupgrade'].map(t => <option key={t}>{t}</option>)}</select></label>
          {form.transport === 'grpc' ? textField('serviceName', 'gRPC serviceName') : form.transport !== 'tcp' && <>{textField('path', 'Path')}{textField('wsHost', 'Host')}</>}
          {form.serverType === 'vless' && textField('flow', 'Flow (xtls-rprx-vision)')}
        </>}
        {textField('comments', ru ? 'Заметка' : 'Note')}
      </div>
      {error && <p role="alert" className="mt-2 text-red-500">{error}</p>}
      <div className="mt-4 flex justify-end gap-3"><button type="button" onClick={onClose}>{ru ? 'Отмена' : 'Cancel'}</button><button className="rounded-xl bg-sky-600 px-4 py-2 text-white dark:bg-orange-700" type="submit">{ru ? 'Сохранить' : 'Save'}</button></div>
    </form>
  </div>
}
