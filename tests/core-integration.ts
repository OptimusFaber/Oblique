import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { createServer as createTcpServer, connect } from 'node:net'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseServerFromText, normalizeServer } from '../src/utils/parseServer'
import { buildSingBoxConfigJson } from '../src/core/buildSingBoxConfig'
const core=path.resolve('src-tauri/resources',process.platform==='win32'?'oblique-core.exe':'oblique-core')
const dir=mkdtempSync(path.join(tmpdir(),'oblique-integration-'))
const children=new Set<ChildProcess>()
const stopFiles=new Map<ChildProcess,string>()
const advanced={dnsOverHttps:false,ipv6:false,bypassLan:false,mux:false,sniff:true,strictRouting:true,blockQuic:false,quicGso:false}
const uuid='00000000-0000-4000-8000-000000000001'
async function freePort(){return new Promise<number>(resolve=>{const s=createTcpServer();s.listen(0,'127.0.0.1',()=>{const p=(s.address() as {port:number}).port;s.close(()=>resolve(p))})})}
async function ready(port:number,child:ChildProcess){for(let n=0;n<100;n++){
 if(child.exitCode!==null)throw new Error('Core exited before readiness')
 if(await new Promise<boolean>(resolve=>{const s=connect(port,'127.0.0.1');s.on('connect',()=>{s.destroy();resolve(true)});s.on('error',()=>resolve(false))}))return
 await new Promise(r=>setTimeout(r,100))
}throw new Error('Readiness timeout')}
function start(config:unknown,name:string){const file=path.join(dir,name+'.json');writeFileSync(file,JSON.stringify(config),{mode:0o600});const check=spawnSync(core,['sing-box','check','-c',file],{encoding:'utf8'});assert.equal(check.status,0,check.stderr)
 const stopFile=path.join(dir,name+'.stop');const c=spawn(core,['sing-box','run','-c',file,'--oblique-stop-file',stopFile],{stdio:['ignore','pipe','pipe']});children.add(c);stopFiles.set(c,stopFile);let log='';c.stdout?.on('data',d=>{log=(log+d).slice(-10000)});c.stderr?.on('data',d=>{log=(log+d).slice(-10000)});c.on('exit',()=>children.delete(c));return{child:c,log:()=>log}}
async function stop(c:ChildProcess){if(c.exitCode!==null)return;const ended=new Promise<void>(r=>c.once('exit',()=>r()));writeFileSync(stopFiles.get(c)!,'stop');const timeout=setTimeout(()=>c.kill(),5000);try{await ended;assert.equal(c.exitCode,0,'Console-less shutdown must close the core cleanly')}finally{clearTimeout(timeout)}}
function fetchVia(port:number,target:string){return new Promise<number>((resolve,reject)=>{const r=request({host:'127.0.0.1',port,path:target,method:'GET',headers:{Host:new URL(target).host},timeout:4000},res=>{res.resume();res.on('end',()=>resolve(res.statusCode!))});r.on('error',reject);r.on('timeout',()=>r.destroy(new Error('timeout')));r.end()})}
const origin=createServer((_req,res)=>{res.writeHead(204,{'X-Oblique-Test':'passed'});res.end()})
try{
 assert.equal(spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(dir,'key.pem'),'-out',path.join(dir,'cert.pem'),'-subj','/CN=oblique.test','-days','1'],{stdio:'ignore'}).status,0)
 await new Promise<void>(r=>origin.listen(0,'127.0.0.1',r));const originPort=(origin.address() as {port:number}).port
 for(const transport of ['tcp','ws','grpc']){
  const serverPort=await freePort(),mixedPort=await freePort(),apiPort=await freePort()
  const inbound:Record<string,unknown>={type:'vless',tag:'vpn-server',listen:'127.0.0.1',listen_port:serverPort,users:[{uuid}],tls:{enabled:true,certificate_path:path.join(dir,'cert.pem'),key_path:path.join(dir,'key.pem')}}
  if(transport==='ws')inbound.transport={type:'ws',path:'/vpn'}
  if(transport==='grpc')inbound.transport={type:'grpc',service_name:'oblique-grpc'}
  const upstream=start({log:{level:'info'},inbounds:[inbound],outbounds:[{type:'direct',tag:'direct'}],route:{final:'direct'}},transport+'-server');await ready(serverPort,upstream.child)
  const link=`vless://${uuid}@127.0.0.1:${serverPort}?security=tls&sni=oblique.test&allowInsecure=1&type=${transport}&path=%2Fvpn&serviceName=oblique-grpc#Integration`
  const server=normalizeServer(parseServerFromText(link)!)!
  const built=buildSingBoxConfigJson(server,'proxy',advanced,[]);if(built.ok===false)throw new Error(built.error)
  const cfg=JSON.parse(built.json);cfg.inbounds[0].listen_port=mixedPort;cfg.experimental.clash_api.external_controller=`127.0.0.1:${apiPort}`;cfg.experimental.clash_api.secret='test-secret'
  const client=start(cfg,transport+'-client');await ready(apiPort,client.child)
  assert.equal(await fetchVia(mixedPort,`http://127.0.0.1:${originPort}/generate_204`),204)
  assert.ok(upstream.log().includes('inbound/vless'), 'Request must traverse the actual VLESS inbound')
  const response=await fetch(`http://127.0.0.1:${apiPort}/connections`,{headers:{Authorization:'Bearer test-secret'}});assert.equal(response.status,200)
  const stats=await response.json() as {uploadTotal:number;downloadTotal:number};assert.ok(stats.uploadTotal>0);assert.ok(stats.downloadTotal>0)
  const forbidden=await fetch(`http://127.0.0.1:${apiPort}/connections`);assert.equal(forbidden.status,401)
  await stop(upstream.child)
  let unavailable=false;try{unavailable=(await fetchVia(mixedPort,`http://127.0.0.1:${originPort}/`))!==204}catch{unavailable=true};assert.ok(unavailable)
  await stop(client.child)
  console.log(`PASS VLESS TLS ${transport}: import → config check → real proxy request → real stats → API authentication → outage`)
 }
 const extraProtocols=['vmess','trojan','shadowsocks','socks5','http','https']
 for(const protocol of extraProtocols){
  const serverPort=await freePort(),mixedPort=await freePort(),apiPort=await freePort()
  const password='p:a@ss-word',username='test-user'
  const type=['socks5','http','https'].includes(protocol)?'mixed':protocol
  const inbound:Record<string,unknown>={type,tag:'test-'+protocol,listen:'127.0.0.1',listen_port:serverPort}
  if(protocol==='vmess')inbound.users=[{uuid,alterId:0}]
  if(protocol==='trojan')inbound.users=[{password}]
  if(protocol==='shadowsocks'){inbound.method='aes-128-gcm';inbound.password=password}
  if(['socks5','http','https'].includes(protocol))inbound.users=[{username,password}]
  if(['trojan','https'].includes(protocol))inbound.tls={enabled:true,certificate_path:path.join(dir,'cert.pem'),key_path:path.join(dir,'key.pem')}
  const upstream=start({log:{level:'info'},inbounds:[inbound],outbounds:[{type:'direct',tag:'direct'}],route:{final:'direct'}},protocol+'-server');await ready(serverPort,upstream.child)
  let uri:string
  if(protocol==='vmess')uri='vmess://'+Buffer.from(JSON.stringify({v:'2',ps:'VMess',add:'127.0.0.1',port:serverPort,id:uuid,aid:0,net:'tcp',tls:''})).toString('base64')
  else if(protocol==='shadowsocks')uri=`ss://${Buffer.from('aes-128-gcm:'+password).toString('base64url')}@127.0.0.1:${serverPort}`
  else uri=`${protocol}://${protocol==='trojan'?encodeURIComponent(password):username+':'+encodeURIComponent(password)}@127.0.0.1:${serverPort}?sni=oblique.test&allowInsecure=1`
  const server=normalizeServer(parseServerFromText(uri)!)!
  assert.ok(server,'Profile import failed for '+protocol)
  const built=buildSingBoxConfigJson(server,'proxy',advanced,[]);if(built.ok===false)throw new Error(built.error)
  const cfg=JSON.parse(built.json);cfg.inbounds[0].listen_port=mixedPort;cfg.experimental.clash_api.external_controller=`127.0.0.1:${apiPort}`
  const client=start(cfg,protocol+'-client');await ready(apiPort,client.child)
  assert.equal(await fetchVia(mixedPort,`http://127.0.0.1:${originPort}/generate_204`),204)
  assert.ok(upstream.log().includes('inbound/'+type))
  await stop(client.child);await stop(upstream.child)
  console.log(`PASS ${protocol}: imported credentials → config check → actual authenticated proxy request → graceful shutdown`)
 }
 // A syntactically valid UUID is not proof of authorization.
 const serverPort=await freePort(),mixedPort=await freePort(),apiPort=await freePort()
 const upstream=start({log:{level:'error'},inbounds:[{type:'vless',listen:'127.0.0.1',listen_port:serverPort,users:[{uuid}]}],outbounds:[{type:'direct'}]},'auth-server');await ready(serverPort,upstream.child)
 const wrong=normalizeServer({host:'127.0.0.1',port:serverPort,password:'00000000-0000-4000-8000-000000000002',serverType:'vless'})!
 const built=buildSingBoxConfigJson(wrong,'proxy',advanced,[]);if(built.ok===false)throw new Error(built.error)
 const cfg=JSON.parse(built.json);cfg.inbounds[0].listen_port=mixedPort;cfg.experimental.clash_api.external_controller=`127.0.0.1:${apiPort}`
 const client=start(cfg,'wrong-auth');await ready(apiPort,client.child)
 let rejected=false;try{rejected=(await fetchVia(mixedPort,`http://127.0.0.1:${originPort}/`))!==204}catch{rejected=true};assert.ok(rejected)
 await stop(client.child);await stop(upstream.child);console.log('PASS wrong UUID: running process does not imply a working VPN')
}finally{for(const c of children)c.kill();origin.close();rmSync(dir,{recursive:true,force:true})}
