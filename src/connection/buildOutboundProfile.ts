import type { AdvancedAppSettings, OutboundProfile, Server, TransportMode } from '../types'

/** Build the live routing profile from the form — this is what “connect” applies. */
export function buildOutboundProfile(
  server: Server,
  appTransport: TransportMode,
  advanced?: AdvancedAppSettings,
): OutboundProfile {
  const st = server.serverType.toLowerCase()
  const cc = (server.countryCode || '').toUpperCase().trim().slice(0, 2) || null
  return {
    tag: server.tag,
    type: st,
    server: server.host,
    server_port: server.port,
    country: cc,
    test_country: cc,
    password: server.password || undefined,
    method: server.method || undefined,
    obfuscation: server.obfuscation || undefined,
    plugin: server.plugin || undefined,
    plugin_opts:
      server.plugin || server.obfuscation
        ? {
            mode: server.obfuscation || undefined,
            host: server.host,
          }
        : undefined,
    tcp_fast_open: server.tcpFastOpen,
    udp_relay: server.udpRelay,
    udp_over_tcp: server.udpOverTcp,
    proxy_pass: server.proxyPass || undefined,
    comments: server.comments || undefined,
    app_transport: appTransport,
    app_advanced: advanced
      ? {
          dns_over_https: advanced.dnsOverHttps,
          ipv6: advanced.ipv6,
          bypass_lan: advanced.bypassLan,
          mux: advanced.mux,
          sniff: advanced.sniff,
          strict_routing: advanced.strictRouting,
          block_quic: advanced.blockQuic,
          quic_gso: advanced.quicGso,
        }
      : undefined,
    stream: {
      tcp_fast_open: server.tcpFastOpen,
      udp_forward: server.udpRelay,
      udp_over_tcp: server.udpOverTcp,
    },
    dial: {
      tcp_fast_open: server.tcpFastOpen,
    },
  }
}

export function redactProfileForLog(p: OutboundProfile): OutboundProfile {
  const o = { ...p }
  if (typeof o.password === 'string' && o.password.length > 0) {
    o.password = '***'
  }
  return o
}
