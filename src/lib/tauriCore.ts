import { isDesktopApp } from './runtime'
export async function coreCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktopApp()) throw new Error('Откройте desktop-приложение Oblique / Open the Oblique desktop app')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}
export const tauriStartCore = (configJson: string, useProxy: boolean, bypassLan: boolean) => coreCall('core_start', { configJson, useProxy, bypassLan })
export const tauriStopCore = () => coreCall<void>('core_stop')
export const tauriCoreHint = () => isDesktopApp() ? coreCall<string>('core_hint') : Promise.resolve('Предпросмотр интерфейса. VPN доступен в desktop-приложении Oblique.')
export const tauriTcpPingMs = (host: string, port: number) => coreCall<number>('tcp_ping_ms', { host, port })
