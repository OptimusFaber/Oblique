#!/usr/bin/env node
/**
 * Generates src-tauri/icons/* from brand logo (required for bundling / OS icon).
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
/** Black 1024×1024 canvas + brand logo (see src-tauri/app-icon-on-black.svg). */
const svg = path.join(root, 'src-tauri/app-icon-on-black.svg')
const out = path.join(root, 'src-tauri/icons')

const r = spawnSync('npx', ['tauri', 'icon', svg, '-o', out], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})
process.exit(r.status ?? 1)
