/** True when the UI is loaded inside a Tauri 2+ webview (Windows / Linux / macOS app). */
export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false
  return Object.prototype.hasOwnProperty.call(window, '__TAURI_INTERNALS__')
}
