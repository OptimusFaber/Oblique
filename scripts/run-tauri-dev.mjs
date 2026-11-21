#!/usr/bin/env node
/**
 * On Linux, WebKitGTK may need these for EGL/GBM (same as user workaround).
 * Windows/macOS: passthrough to `tauri dev`.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { homedir } from 'node:os'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const cargoBin = path.join(homedir(), '.cargo', 'bin')
const pathEnv = [cargoBin, process.env.PATH || ''].filter(Boolean).join(':')

const env = { ...process.env, PATH: pathEnv }
if (process.platform === 'linux') {
  env.GDK_BACKEND = 'x11'
  env.WEBKIT_DISABLE_DMABUF_RENDERER = '1'
}

const child = spawn('npx', ['tauri', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env,
})

child.on('exit', (c) => process.exit(c ?? 1))
