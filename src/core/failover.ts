export function chooseFailover<T extends { id: string; latency: number }>(working: T[], primary: string | null, current: string | null, failures: number): T | undefined {
  const preferred = working.find(s => s.id === primary)
  if (preferred) return preferred.id === current ? undefined : preferred
  if (working.some(s => s.id === current) || failures < 2) return undefined
  return [...working].sort((a, b) => a.latency - b.latency)[0]
}
