import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const core = path.join(root, 'core')
const goos = process.env.GOOS || (process.platform === 'win32' ? 'windows' : 'linux')
const goarch = process.env.GOARCH || 'amd64'
const revision = '89c21d48d74da9a08f3fc77847be68234e4cf143'
function run(bin, args, cwd = root, env = process.env) {
 const r = spawnSync(bin, args, { cwd, stdio: 'inherit', env, shell: process.platform === 'win32' && bin === 'thrift' })
 if (r.status !== 0) throw new Error(`${bin} failed: ${r.error?.message || r.status}`)
}
if (!existsSync(path.join(core, 'sing-box', 'go.mod'))) {
 run('git', ['submodule', 'update', '--init', 'core/sing-box'])
}
if (existsSync(path.join(core, 'sing-box', '.git'))) {
 const pin = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: path.join(core, 'sing-box'), encoding: 'utf8' })
 if (pin.stdout.trim() !== revision) throw new Error(`Expected sing-box ${revision}, run git submodule update --init`)
} else if (readFileSync(path.join(core, 'SING_BOX_REVISION'), 'utf8').trim() !== revision) {
 throw new Error('Source archive revision does not match build manifest')
}
// Go Thrift files are generated and tracked; a release build needs no Thrift installation.
if (!existsSync(path.join(core, 'gen', 'libcore.go'))) throw new Error('Missing generated core/gen/libcore.go')
const output = path.join(root, 'src-tauri', 'resources', goos === 'windows' ? 'oblique-core.exe' : 'oblique-core')
run('go', ['build', '-p', '1', '-trimpath', '-ldflags', '-w -s -checklinkname=0 -X github.com/sagernet/sing-box/constant.Version=1.13.9-oblique',
 '-tags', 'with_clash_api,with_gvisor,with_quic,with_wireguard,with_utls,with_dhcp,with_shadowtls,with_grpc', '-o', output, '.'], core,
 { ...process.env, GOTOOLCHAIN: process.env.OBLIQUE_GOTOOLCHAIN || 'go1.25.7', CGO_ENABLED: '0', GOOS: goos, GOARCH: goarch })
console.log(`Built ${output}`)
