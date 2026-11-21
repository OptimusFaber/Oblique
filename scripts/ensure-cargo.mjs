#!/usr/bin/env node
/**
 * Tauri needs `cargo`. "cargo metadata" ENOENT = Rust not installed or ~/.cargo/bin not in PATH.
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'

const cargoBin = join(homedir(), '.cargo', 'bin')
const rawPath = process.env.PATH || ''
const pathEnv = [cargoBin, rawPath].filter(Boolean).join(':')
const r = spawnSync('cargo', ['--version'], {
  encoding: 'utf8',
  shell: false,
  env: { ...process.env, PATH: pathEnv },
})

if (r.status !== 0) {
  console.error(`
[Oblique] Не найден \`cargo\` (Rust).

  1) Установите: https://rustup.rs
     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

  2) Подгрузите PATH в ЭТОМ терминале:
     source "$HOME/.cargo/env"

  3) Проверка:  cargo --version
     Снова:     npm run dev

---
[Oblique] \`cargo\` not found. Install Rust from https://rustup.rs, then:
  source "$HOME/.cargo/env"
  cargo --version
  npm run dev
`)
  process.exit(1)
}
process.exit(0)
