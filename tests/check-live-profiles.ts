import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { parseSubscription } from '../src/utils/parseServer'
import { buildSingBoxConfigJson } from '../src/core/buildSingBoxConfig'
const source=process.argv[2];if(!source)throw new Error('Usage: check-live-profiles.ts /path/to/private/profiles.txt')
const servers=parseSubscription(readFileSync(source,'utf8'))
const core=path.resolve('src-tauri/resources',process.platform==='win32'?'oblique-core.exe':'oblique-core')
const dir=mkdtempSync(path.join(tmpdir(),'oblique-live-'))
const run=promisify(execFile)
const freePort=()=>new Promise<number>(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=(s.address() as {port:number}).port;s.close(()=>resolve(p))})})
const advanced={dnsOverHttps:true,ipv6:true,bypassLan:true,mux:false,sniff:true,strictRouting:true,blockQuic:false,quicGso:false}
let child:ChildProcess|null=null
const results:{index:number;transport:string;port:number;config:boolean;http?:number;error?:string}[]=[]
try{
 for(const [index,server] of servers.entries()){
  const result:{index:number;transport:string;port:number;config:boolean;http?:number;error?:string}={index:index+1,transport:server.transport||'tcp',port:server.port,config:false}
  const built=buildSingBoxConfigJson(server,'proxy',advanced,[])
  if(built.ok===false){result.error='config-builder';results.push(result);continue}
  const c=JSON.parse(built.json);const port=await freePort();c.inbounds[0].listen_port=port;c.experimental.clash_api.external_controller=`127.0.0.1:${await freePort()}`;c.experimental.clash_api.secret=crypto.randomUUID()
  const file=path.join(dir,`profile-${index}.json`);writeFileSync(file,JSON.stringify(c),{mode:0o600})
  const checked=spawnSync(core,['sing-box','check','-c',file],{encoding:'utf8'});result.config=checked.status===0
  if(!result.config){result.error='core-config-rejected';results.push(result);continue}
  child=spawn(core,['sing-box','run','-c',file],{stdio:'ignore'})
  await new Promise(r=>setTimeout(r,1500))
  try{
   const out=await run('curl',['--silent','--show-error','--max-time','12','--noproxy','','--proxy',`socks5h://127.0.0.1:${port}`,'--output',process.platform==='win32'?'NUL':'/dev/null','--write-out','%{http_code}','https://cp.cloudflare.com/generate_204'],{timeout:16000})
   result.http=Number(out.stdout.trim())
  }catch{result.error='vpn-request-failed'}
  if(child.exitCode===null){const done=new Promise<void>(r=>child!.once('exit',()=>r()));child.kill();await done}child=null
  results.push(result)
 }
 console.log(JSON.stringify({profiles:results,working:results.filter(r=>r.http===204).length},null,2))
}finally{child?.kill();rmSync(dir,{recursive:true,force:true})}
