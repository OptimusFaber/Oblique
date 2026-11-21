import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseServerFromText, normalizeServer, parseSubscription } from '../src/utils/parseServer'
import { buildMainOutbound, buildSingBoxConfigJson } from '../src/core/buildSingBoxConfig'
const uuid = '00000000-0000-4000-8000-000000000001'
const advanced = { dnsOverHttps: true, ipv6: true, bypassLan: true, mux: false, sniff: true, strictRouting: true, blockQuic: false, quicGso: false }
const link = `vless://${uuid}@edge.example.com:2053?type=ws&security=tls&sni=sni.example.com&host=origin.example.com&path=%2Fvpn%3Fed%3D2048&fp=chrome#CDN%20WS`
test('CDN WebSocket link retains UUID, port, Host, path, SNI and TLS after persistence', () => {
 const parsed = parseServerFromText(link)!
 const server = normalizeServer(JSON.parse(JSON.stringify(parsed)))!
 assert.equal(server.password, uuid); assert.equal(server.port,2053); assert.equal(server.tag,'CDN WS')
 const out = buildMainOutbound(server, advanced)
 assert.deepEqual(out.transport,{type:'ws',path:'/vpn?ed=2048',headers:{Host:'origin.example.com'}})
 assert.equal((out.tls as {server_name:string}).server_name,'sni.example.com')
})
test('CDN gRPC preserves serviceName and distinct TLS SNI', () => {
 const s = normalizeServer(parseServerFromText(`vless://${uuid}@edge.example.com:443?security=tls&type=grpc&serviceName=oblique-grpc&sni=origin.example.com`)!)!
 assert.deepEqual(buildMainOutbound(s,advanced).transport,{type:'grpc',service_name:'oblique-grpc'})
})
test('Reality retains public key, short ID, fingerprint, flow', () => {
 const s=normalizeServer(parseServerFromText(`vless://${uuid}@edge.example.com:443?security=reality&pbk=key&sid=1234&fp=firefox&flow=xtls-rprx-vision&sni=example.com`)!)!
 const o=buildMainOutbound(s,advanced)
 assert.equal(o.flow,'xtls-rprx-vision'); assert.deepEqual((o.tls as Record<string,unknown>).reality,{enabled:true,public_key:'key',short_id:'1234'})
})
test('Shadowsocks SIP002 and legacy Base64 credentials retain colons in password', () => {
 const auth=Buffer.from('aes-256-gcm:p:a:ss').toString('base64url')
 assert.equal(parseServerFromText(`ss://${auth}@example.com:8388#SS`)?.password,'p:a:ss')
 assert.equal(parseServerFromText('ss://'+Buffer.from('aes-256-gcm:pass@example.com:8388').toString('base64'))?.password,'pass')
})
test('VMess Base64 imports authentication, TLS, WebSocket and Unicode names', () => {
 const raw={v:'2',ps:'Сервер',add:'example.com',port:'443',id:uuid,aid:'0',net:'ws',path:'/vmess',host:'origin.example.com',tls:'tls',sni:'sni.example.com'}
 const s=normalizeServer(parseServerFromText('vmess://'+Buffer.from(JSON.stringify(raw)).toString('base64'))!)!
 assert.equal(s.tag,'Сервер'); assert.equal(s.password,uuid); assert.equal(s.transport,'ws')
})
test('IPv6 and URI-encoded Trojan credentials', () => {
 const s=parseServerFromText('trojan://p%40ss%3Aword@[2001:db8::1]:443?sni=example.com')!
 assert.equal(s.host,'2001:db8::1'); assert.equal(s.password,'p@ss:word'); assert.equal(s.tls,true)
})
test('HTTP basic authentication and default ports', () => {
 const s=parseServerFromText('https://user:p%40ss@example.com')!
 assert.equal(s.username,'user'); assert.equal(s.password,'p@ss'); assert.equal(s.port,443)
 const o=buildMainOutbound(normalizeServer(s)!,advanced); assert.equal(o.type,'http'); assert.equal(o.username,'user')
})
test('Base64 subscription imports all profiles atomically', () => {
 const raw=link+'\n'+link.replace('2053','443')
 const servers=parseSubscription(Buffer.from(raw).toString('base64'))
 assert.equal(servers.length,2); assert.notEqual(servers[0].id,servers[1].id)
 assert.equal(parseSubscription(Buffer.from(raw).toString('base64').match(/.{1,76}/g)!.join('\n')).length,2)
 assert.throws(()=>parseSubscription(link+'\nbad-profile'),/строка 2/)
})
test('Invalid ports and unsupported transports fail clearly', () => {
 assert.equal(normalizeServer({host:'example.com',port:0}),null)
 assert.equal(normalizeServer({host:'example.com',port:65536}),null)
 assert.equal(normalizeServer({host:'example.com',port:1.5}),null)
 const s=normalizeServer(parseServerFromText(link)!)!
 assert.throws(()=>buildMainOutbound({...s,transport:'xhttp'},advanced),/Unsupported transport/)
})
test('1.13 config uses reject actions, modern DNS and a loopback-only controller', () => {
 const server=normalizeServer(parseServerFromText(link)!)!
 const built=buildSingBoxConfigJson(server,'tunnel',advanced,[{id:'1',pattern:'ads.*',mode:'block'}])
 assert.equal(built.ok,true)
 if (built.ok===false) return
 const c=JSON.parse(built.json)
 assert.equal(c.outbounds.some((o:{type:string})=>o.type==='block'),false)
 assert.ok(c.route.rules.some((r:{action:string})=>r.action==='reject'))
 assert.equal(c.dns.servers[1].type,'https'); assert.equal(c.dns.servers[1].detour,'proxy')
 assert.equal(c.experimental.clash_api.external_controller,'127.0.0.1:17891')
 assert.equal(c.inbounds[0].listen,'127.0.0.1')
 assert.deepEqual(c.inbounds[1].address,['172.19.0.1/30','fdfe:dcba:9876::1/126'])
})
test('Switches apply to the config rather than just the UI', () => {
 const server=normalizeServer(parseServerFromText(link)!)!
 const built=buildSingBoxConfigJson(server,'tunnel',{...advanced,dnsOverHttps:false,ipv6:false,sniff:false,blockQuic:true},[])
 if (built.ok===false) assert.fail(built.error)
 const c=JSON.parse(built.json)
 assert.equal(c.dns.final,'bootstrap'); assert.equal(c.dns.servers.length,1)
 assert.ok(c.inbounds[1].address.some((a:string)=>a.includes(':')), 'Disabled IPv6 must still be captured by TUN before rejecting it')
 assert.equal(c.route.rules.some((r:{action:string})=>r.action==='sniff'),false)
 assert.ok(c.route.rules.some((r:{ip_version:number;action:string})=>r.ip_version===6&&r.action==='reject'))
 assert.ok(c.route.rules.some((r:{port:number;action:string})=>r.port===443&&r.action==='reject'))
})

import { chooseFailover } from '../src/core/failover'
test('failover waits for repeated failures, chooses lowest latency and restores primary', () => {
 const backups=[{id:'slow',latency:200},{id:'fast',latency:20}]
 assert.equal(chooseFailover(backups,'primary','primary',1),undefined)
 assert.equal(chooseFailover(backups,'primary','primary',2)?.id,'fast')
 assert.equal(chooseFailover(backups,'primary','fast',10),undefined)
 assert.equal(chooseFailover([...backups,{id:'primary',latency:300}],'primary','fast',0)?.id,'primary')
 assert.equal(chooseFailover([],'primary','fast',2),undefined)
})
