/**
 * Ciphers allowed by this UI (aligned with sing-box / sing-shadowsocks).
 * If a value is not in this list, the editor rejects it for Shadowsocks.
 */
export const SUPPORTED_SHADOWSOCKS_METHODS: readonly string[] = [
  'none',
  'table',
  'rc4-md5',
  'rc4-md5-6',
  'salsa20',
  'chacha20',
  'chacha20-ietf',
  'aes-256-cfb',
  'aes-192-cfb',
  'aes-128-cfb',
  'aes-256-cfb1',
  'aes-192-cfb1',
  'aes-128-cfb1',
  'aes-256-cfb8',
  'aes-192-cfb8',
  'aes-128-cfb8',
  'aes-256-ctr',
  'aes-192-ctr',
  'aes-128-ctr',
  'bf-cfb',
  'camelia-128-cfb',
  'camelia-192-cfb',
  'camelia-256-cfb',
  'cast5-cfb',
  'des-cfb',
  'idea-cfb',
  'rc2-cfb',
  'seed-cfb',
  'aes-256-gcm',
  'aes-192-gcm',
  'aes-128-gcm',
  'chacha20-ietf-poly1305',
  'chacha20-poly1305',
  'xchacha20-ietf-poly1305',
  '2022-blake3-aes-256-gcm',
  '2022-blake3-aes-128-gcm',
  '2022-blake3-chacha20-poly1305',
] as const

const set = new Set(SUPPORTED_SHADOWSOCKS_METHODS)

export function isSupportedShadowsocksMethod(method: string): boolean {
  const m = method.trim()
  if (!m) return false
  return set.has(m)
}
