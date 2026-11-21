export type TabId =
  | 'connection'
  | 'configs'
  | 'traffic'
  | 'settings'
  | 'reachability'

/** Site reachability probe row (demo sim; desktop uses real probes). */
export type ReachStatus =
  | 'idle'
  | 'checking'
  | 'ok'
  | 'blocked'
  | 'geo'
  | 'timeout'
  | 'error'
  /** HTTP reached but CORS hides status; geo-HTML 200 not detectable in browser */
  | 'limited'

export interface ReachSiteRow {
  id: string
  url: string
  status: ReachStatus
  detailRu: string
  detailEn: string
  checkedAtMs: number | null
}

export type TransportMode = 'proxy' | 'tunnel'

export type ThemeChoice = 'light' | 'dark' | 'system'

export type Lang = 'ru' | 'en'

/** Endpoint configuration — fields feed the live outbound profile on connect. */
export interface Server {
  id: string
  /** Short label in lists */
  tag: string
  /** Protocol / link type: vless, vmess, trojan, shadowsocks, socks5, … */
  serverType: string
  host: string
  port: number
  password: string
  method: string
  obfuscation: string
  plugin: string
  tcpFastOpen: boolean
  udpRelay: boolean
  udpOverTcp: boolean
  proxyPass: string
  comments: string
  latencyMs: number | null
  /** ISO 3166-1 alpha-2, e.g. JP — for flag display in lists / graphs */
  countryCode: string
  username?: string
  tls?: boolean
  sni?: string
  alpn?: string[]
  fingerprint?: string
  insecure?: boolean
  flow?: string
  transport?: string
  path?: string
  wsHost?: string
  serviceName?: string
  realityPublicKey?: string
  realityShortId?: string
  alterId?: number
  security?: string
}

/** Named “scene” (e.g. Wi-Fi / cellular / work) for routing, Shadowrocket-style. */
export interface RoutingScene {
  id: string
  name: string
}

export type GroupRoutingMode = 'config' | 'proxy' | 'direct' | 'scene'

/** A pool of servers with optional chain fallback, like SR groups. */
export interface ServerGroup {
  id: string
  name: string
  memberServerIds: string[]
  /** Try next member when the current is unavailable */
  fallback: boolean
  /** How this group is used in policy/routing (demo; desktop maps to profile). */
  routing: GroupRoutingMode
  /** When routing is `scene`, pick a named scene. */
  sceneId: string | null
  subscriptionUrl?: string
}

export type RuleMode = 'vpn' | 'direct' | 'block'

export interface ConfigRule {
  id: string
  pattern: string
  mode: RuleMode
}

/** Serializable outbound used when “connected”; mirrors sing-box–like knobs. */
export type OutboundProfile = Record<string, unknown>

/**
 * Active flows through VPN — mirrors desktop `Stats::ConnectionMetadata`
 * (sites / processes using the tunnel, not your server list).
 */
export interface ActiveVpnFlow {
  id: string
  dest: string
  domain: string
  process: string
  protocol: string
  network: string
  outbound: string
  upload: number
  download: number
  createdAtMs: number
}

/** Extra knobs similar to Shadowrocket advanced — UI-only; desktop bridges to real prefs. */
export interface AdvancedAppSettings {
  /** Prefer remote DNS (DoH) when connected */
  dnsOverHttps: boolean
  /** Route IPv6 through tunnel when available */
  ipv6: boolean
  /** Skip proxy for local / LAN */
  bypassLan: boolean
  /** Mux (smux / h2mux) — if core supports it */
  mux: boolean
  /** Sniff and override destination from TLS / HTTP */
  sniff: boolean
  /** Strict mode for rules / routing (strict vs loose) */
  strictRouting: boolean
  /** Reject unknown protocols from routing */
  blockQuic: boolean
  /** Hysteria / QUIC UDP buffer (demo label only) */
  quicGso: boolean
}
