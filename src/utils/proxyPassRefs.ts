import type { Server, ServerGroup } from '../types'

const P = 'sg-ref:'

export function encodeGroupProxyRef(groupId: string): string {
  return `${P}group:${groupId}`
}

export function encodeServerProxyRef(serverId: string): string {
  return `${P}server:${serverId}`
}

export function parseProxyPassRef(
  raw: string,
): { kind: 'group' | 'server'; id: string } | null {
  if (!raw.startsWith(P)) return null
  const rest = raw.slice(P.length)
  const m = /^(group|server):(.+)$/.exec(rest)
  if (!m) return null
  return { kind: m[1] as 'group' | 'server', id: m[2] }
}

export function formatProxyPassForDisplay(
  raw: string,
  servers: Server[],
  groups: ServerGroup[],
  lang: 'ru' | 'en',
): string {
  const ref = parseProxyPassRef(raw)
  if (!ref) return raw
  if (ref.kind === 'server') {
    const s = servers.find((x) => x.id === ref.id)
    if (s) return s.tag
  } else {
    const g = groups.find((x) => x.id === ref.id)
    if (g) return g.name
  }
  return lang === 'ru' ? '(ссылка устарела)' : '(dangling ref)'
}
