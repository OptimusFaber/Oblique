/**
 * Brand / tab / UI SVGs — only from this repo: `src/assets/brand/`.
 * Do not import from external folders (e.g. Desktop/images).
 */
import favicon from '../assets/brand/oblique-white.svg'
import logoBlack from '../assets/brand/oblique-black.svg'
import logoWhite from '../assets/brand/oblique-white.svg'

import tabConnection from '../assets/brand/internet-web-browser.svg'
import tabConfigs from '../assets/brand/network-routing.svg'
import tabTraffic from '../assets/brand/swap-verical.svg'
import tabSettings from '../assets/brand/preferences.svg'
import tabReachability from '../assets/brand/info-button.svg'

import uiTest from '../assets/brand/test.svg'
import uiThemeChange from '../assets/brand/theme-change.svg'
import uiLanguage from '../assets/brand/language.svg'
import uiTimer from '../assets/brand/timer.svg'
import uiScanButton from '../assets/brand/scan-button.svg'
import uiQrCode from '../assets/brand/qr-code.svg'

import type { TabId } from '../types'

/** Small inline SVGs for labels and buttons (monochrome-friendly filters in components). */
export const SG_UI_ICONS = {
  test: uiTest,
  themeChange: uiThemeChange,
  language: uiLanguage,
  timer: uiTimer,
  scanButton: uiScanButton,
  qrCode: uiQrCode,
} as const

export const SG_ASSETS = {
  favicon,
  logo: { light: logoBlack, dark: logoWhite },
  tab: {
    connection: tabConnection,
    configs: tabConfigs,
    traffic: tabTraffic,
    settings: tabSettings,
    reachability: tabReachability,
  } satisfies Record<TabId, string>,
}
