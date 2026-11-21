import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { parseSubscription } from '../src/utils/parseServer'
import { buildSingBoxConfigJson } from '../src/core/buildSingBoxConfig'
const [source, directory] = process.argv.slice(2)
if (!source || !directory) throw new Error('Usage: write-private-fixture.ts PROFILE_FILE PRIVATE_DIRECTORY')
const profiles=parseSubscription(readFileSync(source,'utf8'))
const advanced={dnsOverHttps:true,ipv6:true,bypassLan:true,mux:false,sniff:true,strictRouting:true,blockQuic:false,quicGso:false}
const config=buildSingBoxConfigJson(profiles[0],'proxy',advanced,[],profiles)
if(config.ok===false)throw new Error(config.error)
mkdirSync(directory,{recursive:true,mode:0o700})
writeFileSync(path.join(directory,'profiles.json'),JSON.stringify(profiles),{mode:0o600})
writeFileSync(path.join(directory,'config.json'),config.json,{mode:0o600})
