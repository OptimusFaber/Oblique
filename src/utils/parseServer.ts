import type { Server } from '../types'

type PartialServer = Partial<Server> & { protocol?: string }

export function normalizeServer(p: PartialServer): Server | null {
  const host = p.host?.trim().replace(/^\[|\]$/g, '')
  const port = Number(p.port)
  if (!host || /[\s/]/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) return null
  return {
    ...p,
    id: p.id || crypto.randomUUID(), tag: (p.tag?.trim() || host).slice(0, 128),
    serverType: (p.serverType || p.protocol || 'vless').toLowerCase(), host, port,
    password: p.password ?? '', method: p.method ?? '', obfuscation: p.obfuscation ?? '',
    plugin: p.plugin ?? '', tcpFastOpen: p.tcpFastOpen ?? false, udpRelay: p.udpRelay ?? true,
    udpOverTcp: p.udpOverTcp ?? false, proxyPass: p.proxyPass ?? '', comments: p.comments ?? '',
    latencyMs: p.latencyMs ?? null, countryCode: (p.countryCode ?? '').toUpperCase().slice(0, 2),
  }
}

function decode64(raw: string): string {
  const b = raw.trim().replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(b.padEnd(Math.ceil(b.length / 4) * 4, '=')), c => c.charCodeAt(0)))
}

export function parseServerFromText(raw: string): PartialServer | null {
  const s = raw.trim()
  try {
    if (s.startsWith('vmess://')) {
      const j = JSON.parse(decode64(s.slice(8).split('#')[0]))
      return normalizeServer({ tag: j.ps, serverType: 'vmess', host: j.add, port: Number(j.port),
        password: j.id, alterId: Number(j.aid || 0), security: j.scy || 'auto', tls: j.tls === 'tls',
        sni: j.sni || j.host || j.add, transport: j.net || 'tcp', path: j.path || '',
        wsHost: j.host || '', serviceName: j.net === 'grpc' ? j.path : '', fingerprint: j.fp || '',
        alpn: typeof j.alpn === 'string' ? j.alpn.split(',').filter(Boolean) : [] })
    }
    if (s.startsWith('ss://')) {
      let body = s.slice(5)
      const hash = body.indexOf('#')
      const tag = hash < 0 ? 'Shadowsocks' : decodeURIComponent(body.slice(hash + 1))
      body = hash < 0 ? body : body.slice(0, hash)
      if (!body.includes('@')) body = decode64(body)
      const u = new URL('ss://' + body)
      let auth = decodeURIComponent(u.username)
      if (u.password) auth += ':' + decodeURIComponent(u.password)
      if (!auth.includes(':')) auth = decode64(auth)
      const sep = auth.indexOf(':')
      if (sep < 1) return null
      const plugin = u.searchParams.get('plugin') || ''
      return normalizeServer({ tag, serverType: 'shadowsocks', host: u.hostname, port: Number(u.port || 8388),
        method: auth.slice(0, sep), password: auth.slice(sep + 1), plugin })
    }
    const u = new URL(s)
    const proto = u.protocol.slice(0, -1).toLowerCase()
    if (!['vless', 'trojan', 'socks', 'socks5', 'http', 'https'].includes(proto)) return null
    const q = u.searchParams
    const sec = q.get('security') || (proto === 'trojan' || proto === 'https' ? 'tls' : 'none')
    if (!['tls', 'reality', 'none', ''].includes(sec)) return null
    const username = decodeURIComponent(u.username)
    return normalizeServer({
      tag: decodeURIComponent(u.hash.slice(1)) || u.hostname, serverType: proto === 'socks' ? 'socks5' : proto,
      host: u.hostname, port: Number(u.port || (proto === 'http' ? 80 : proto === 'socks5' || proto === 'socks' ? 1080 : 443)),
      password: proto === 'vless' || proto === 'trojan' ? username : decodeURIComponent(u.password),
      username: proto === 'vless' || proto === 'trojan' ? '' : username,
      tls: sec === 'tls' || sec === 'reality', sni: q.get('sni') || q.get('peer') || u.hostname.replace(/^\[|\]$/g, ''),
      alpn: (q.get('alpn') || '').split(',').filter(Boolean), fingerprint: q.get('fp') || '',
      insecure: q.get('allowInsecure') === '1' || q.get('insecure') === '1', flow: q.get('flow') || '',
      transport: q.get('type') || 'tcp', path: q.get('path') || '/', wsHost: q.get('host') || '',
      serviceName: q.get('serviceName') || '', realityPublicKey: q.get('pbk') || '', realityShortId: q.get('sid') || '',
    })
  } catch { return null }
}

/** Atomic import: reject unsupported or malformed lines rather than silently dropping profiles. */
export function parseSubscription(raw: string): Server[] {
  let text = raw.trim().replace(/^\uFEFF/, '')
  if (!text.includes('://')) {
    try { text = decode64(text) } catch { throw new Error('Ожидаются VPN-ссылки или Base64-подписка / Expected VPN links or a Base64 subscription') }
  }
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'))
  if (!lines.length) throw new Error('Подписка пуста / Empty subscription')
  return lines.map((line, i) => {
    const s = normalizeServer(parseServerFromText(line) || {})
    if (!s) throw new Error(`Некорректный или неподдерживаемый профиль, строка ${i + 1} / Invalid or unsupported profile`)
    return s
  })
}

export const buildServer = normalizeServer
