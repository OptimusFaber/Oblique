import type { AdvancedAppSettings, ConfigRule, Server, TransportMode } from '../types'

export const SG_MIXED_PORT = 17890
export const serverTag = (s: Server) => `server-${s.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
type Json = Record<string, unknown>

export function buildMainOutbound(s: Server, advanced: AdvancedAppSettings): Json {
  if (!s.host || !Number.isInteger(s.port) || s.port < 1 || s.port > 65535) throw new Error('Invalid server host/port')
  if (s.proxyPass) throw new Error('Цепочки прокси пока не поддерживаются / Proxy chains are not supported')
  if (s.plugin || s.obfuscation) throw new Error('Shadowsocks plugins are not supported by this build')
  const type = s.serverType === 'socks5' ? 'socks' : s.serverType === 'https' ? 'http' : s.serverType
  const o: Json = { type, tag: serverTag(s), server: s.host, server_port: s.port, tcp_fast_open: s.tcpFastOpen }
  if (!s.udpRelay) o.network = 'tcp'
  if (['vless', 'vmess'].includes(type)) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.password)) throw new Error('VLESS/VMess: требуется корректный UUID / Valid UUID required')
    o.uuid = s.password
    if (type === 'vless' && s.flow) o.flow = s.flow
    if (type === 'vmess') { o.security = s.security || 'auto'; o.alter_id = s.alterId || 0 }
  } else if (['trojan', 'shadowsocks'].includes(type)) {
    if (!s.password) throw new Error('Требуется пароль / Password required')
    o.password = s.password
    if (type === 'shadowsocks') {
      if (!s.method) throw new Error('Shadowsocks cipher required')
      o.method = s.method
      if (s.udpOverTcp) o.udp_over_tcp = { enabled: true, version: 2 }
    }
  } else if (['socks', 'http'].includes(type)) {
    if (s.username) o.username = s.username
    if (s.password) o.password = s.password
    if (type === 'socks') o.version = '5'
  } else throw new Error(`Unsupported protocol: ${s.serverType}`)
  if (s.tls ?? ['trojan', 'https'].includes(s.serverType)) {
    const tls: Json = { enabled: true, server_name: s.sni || s.host, insecure: s.insecure === true }
    if (s.alpn?.length) tls.alpn = s.alpn
    if (s.fingerprint || s.realityPublicKey) tls.utls = { enabled: true, fingerprint: s.fingerprint || 'chrome' }
    if (s.realityPublicKey) tls.reality = { enabled: true, public_key: s.realityPublicKey, short_id: s.realityShortId || '' }
    o.tls = tls
  }
  const tr = s.transport || 'tcp'
  if (tr !== 'tcp') {
    if (!['vless', 'vmess', 'trojan'].includes(type)) throw new Error(`Transport ${tr} is not supported for ${type}`)
    if (tr === 'ws') o.transport = { type: 'ws', path: s.path || '/', headers: s.wsHost ? { Host: s.wsHost } : {} }
    else if (tr === 'grpc') o.transport = { type: 'grpc', service_name: s.serviceName || '' }
    else if (tr === 'http' || tr === 'h2') o.transport = { type: 'http', path: s.path || '/', host: s.wsHost ? [s.wsHost] : [] }
    else if (tr === 'httpupgrade') o.transport = { type: 'httpupgrade', path: s.path || '/', host: s.wsHost || s.host }
    else throw new Error(`Unsupported transport: ${tr}`)
  }
  if (advanced.mux && ['vless', 'vmess', 'trojan', 'shadowsocks'].includes(type) && !s.flow) o.multiplex = { enabled: true, protocol: 'h2mux', max_streams: 32 }
  return o
}

function patternFields(pattern: string): Json {
  const p = pattern.trim().toLowerCase()
  if (!p) throw new Error('Пустое правило / Empty rule')
  if (p.startsWith('*.') && !p.slice(2).includes('*')) return { domain_suffix: [p.slice(2)] }
  if (p.includes('*')) return { domain_regex: ['^' + p.split('*').map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'] }
  return { domain: [p] }
}

export function buildSingBoxConfigJson(server: Server, transport: TransportMode, advanced: AdvancedAppSettings,
  rules: ConfigRule[], pool: Server[] = []): { ok: true; json: string; hint: string } | { ok: false; error: string; hint: string } {
  try {
    const unique = [server, ...pool.filter(s => s.id !== server.id)]
    const outbounds = unique.map(s => buildMainOutbound(s, advanced))
    const routeRules: Json[] = []
    if (advanced.sniff) routeRules.push({ action: 'sniff' })
    routeRules.push({ protocol: 'dns', action: 'hijack-dns' }, { port: 53, action: 'hijack-dns' })
    if (advanced.blockQuic) routeRules.push({ network: 'udp', port: 443, action: 'reject' })
    if (transport === 'tunnel' && !advanced.ipv6) routeRules.push({ ip_version: 6, action: 'reject' })
    for (const r of rules) routeRules.push({ ...patternFields(r.pattern), ...(r.mode === 'block' ? { action: 'reject' } : { action: 'route', outbound: r.mode === 'direct' ? 'direct' : 'proxy' }) })
    if (advanced.bypassLan) routeRules.push({ ip_is_private: true, action: 'route', outbound: 'direct' })
    const mixed: Json = { type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: SG_MIXED_PORT }
    const inbounds = [mixed]
    if (transport === 'tunnel') inbounds.push({ type: 'tun', tag: 'tun-in', interface_name: 'oblique-tun',
      // Keep the IPv6 route even when disabled, then reject it below instead of leaking it outside TUN.
      address: ['172.19.0.1/30', 'fdfe:dcba:9876::1/126'], mtu: 1500,
      auto_route: true, strict_route: advanced.strictRouting, stack: 'system' })
    const dns: Json = { servers: [{ type: 'local', tag: 'bootstrap' }], strategy: advanced.ipv6 ? 'prefer_ipv4' : 'ipv4_only', final: 'bootstrap' }
    if (advanced.dnsOverHttps) {
      (dns.servers as Json[]).push({ type: 'https', tag: 'remote', server: '1.1.1.1', server_port: 443,
        path: '/dns-query', tls: { enabled: true, server_name: 'cloudflare-dns.com' }, detour: 'proxy' })
      dns.final = 'remote'
    }
    const obj = { log: { level: 'info', timestamp: true }, dns, inbounds,
      outbounds: [{ type: 'selector', tag: 'proxy', outbounds: unique.map(serverTag), default: serverTag(server), interrupt_exist_connections: true }, ...outbounds, { type: 'direct', tag: 'direct' }],
      route: { rules: routeRules, final: 'proxy', auto_detect_interface: true, default_domain_resolver: { server: 'bootstrap', strategy: 'prefer_ipv4' } },
      experimental: { clash_api: { external_controller: '127.0.0.1:17891', secret: '', access_control_allow_origin: [] } } }
    return { ok: true, json: JSON.stringify(obj, null, 2), hint: transport === 'proxy' ? 'System proxy: 127.0.0.1:17890' : 'TUN enabled' }
  } catch (e) { return { ok: false, error: String(e instanceof Error ? e.message : e), hint: '' } }
}
export const parseSingBoxError = (s: string) => s.trim().slice(0, 1000) || 'Core exited'
