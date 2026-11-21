import type { ActiveVpnFlow } from '../types'
export function displayDestination(flow: ActiveVpnFlow): string {
  const d = flow.domain?.trim()
  if (d) return d
  return flow.dest
}

export function formatFlowTraffic(up: number, down: number): string {
  const r = (n: number) =>
    n < 1024
      ? `${n} B`
      : n < 1024 * 1024
        ? `${(n / 1024).toFixed(1)} KB`
        : `${(n / (1024 * 1024)).toFixed(2)} MB`
  return `${r(up)}↑ ${r(down)}↓`
}

function protocolCell(network: string, protocol: string): string {
  if (!protocol) return network
  return `${network} (${protocol})`
}


export { protocolCell }
