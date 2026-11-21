import { test, expect } from '@playwright/test'
const uuid='00000000-0000-4000-8000-000000000001'
const links=`vless://${uuid}@edge.example.com:443?security=tls&type=grpc&serviceName=grpc&sni=origin.example.com#CDN-gRPC\nvless://${uuid}@edge.example.com:2053?security=tls&type=ws&path=%2Fvpn&host=origin.example.com#CDN-WS`
test('imports multiple CDN profiles, persists credentials and blocks simulated connections', async ({ page }) => {
 const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/')
 await expect(page.getByText('Oblique ·')).toBeVisible()
 await page.getByText('Импорт профилей и подписок').click()
 await page.getByRole('textbox',{name:'VPN-ссылки',exact:true}).fill(links)
 await page.getByRole('button',{name:'Импортировать',exact:true}).click()
 await expect(page.getByText('Добавлено профилей: 2')).toBeVisible()
 await page.reload()
 await expect(page.getByText('CDN-gRPC',{exact:true}).first()).toBeVisible()
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('oblique_v2_servers')!))
 expect(stored).toHaveLength(2); expect(stored[0].password).toBe(uuid); expect(stored[0].serviceName).toBe('grpc')
 expect(stored[1].path).toBe('/vpn'); expect(stored[1].port).toBe(2053)
 await page.getByRole('button',{name:'Подключить VPN',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('desktop')
 await expect(page.getByRole('button',{name:'Подключить VPN',exact:true})).toHaveAttribute('aria-pressed','false')
 expect(errors).toEqual([])
 await page.screenshot({path:'artifacts/oblique-light.png',fullPage:true})
})
test('rejects partial malformed import without saving a subset',async({page})=>{
 await page.goto('/');await page.getByText('Импорт профилей и подписок').click()
 await page.getByRole('textbox',{name:'VPN-ссылки',exact:true}).fill(links+'\nbad-profile')
 await page.getByRole('button',{name:'Импортировать',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('строка 3')
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('oblique_v2_servers')!))
 expect(stored).toHaveLength(0)
})
test('dark theme and settings survive reload without demo traffic',async({page})=>{
 await page.goto('/')
 await page.getByRole('button',{name:'Настройки',exact:true}).click()
 await page.getByRole('combobox').first().selectOption('dark')
 await expect(page.locator('html')).toHaveClass('dark')
 await page.reload();await expect(page.locator('html')).toHaveClass('dark')
 await page.getByRole('button',{name:'Активность',exact:true}).click()
 await expect(page.getByText('↓ 0.00 Mbps · 0.00 MiB')).toBeVisible()
 await page.screenshot({path:'artifacts/oblique-dark.png',fullPage:true})
})
test('desktop connection tries the group backup when the primary fails readiness', async ({ page }) => {
 await page.addInitScript(() => {
  const w=window as unknown as {__TAURI_INTERNALS__:unknown; starts:string[]}
  w.starts=[]
  w.__TAURI_INTERNALS__={invoke:async(command:string,args?:{configJson?:string})=>{
   if(command==='core_start'){
    const config=JSON.parse(args!.configJson!)
    w.starts.push(config.outbounds[0].default)
    if(w.starts.length===1)throw new Error('Primary VPN probe failed')
    return {status:204}
   }
   if(command==='core_status')return {running:true,data:{downloadTotal:0,uploadTotal:0,connections:[]}}
   if(command==='core_logs')return []
   return null
  }}
 })
 await page.goto('/');await page.getByText('Импорт профилей и подписок').click()
 await page.getByRole('textbox',{name:'VPN-ссылки',exact:true}).fill(links)
 await page.getByRole('button',{name:'Импортировать',exact:true}).click()
 await page.getByRole('button',{name:'Подключить VPN',exact:true}).click()
 await expect(page.getByRole('button',{name:'Отключить VPN',exact:true})).toBeVisible()
 const starts=await page.evaluate(()=>(window as unknown as {starts:string[]}).starts)
 expect(starts).toHaveLength(2);expect(starts[0]).not.toBe(starts[1])
 await page.getByRole('button',{name:'Отключить VPN',exact:true}).click()
 await expect(page.getByRole('button',{name:'Подключить VPN',exact:true})).toHaveAttribute('aria-pressed','false')
})
test('desktop readiness failure leaves the app disconnected', async ({ page }) => {
 await page.addInitScript(() => {
  (window as unknown as {__TAURI_INTERNALS__:unknown}).__TAURI_INTERNALS__={invoke:async(command:string)=>{
   if(command==='core_start')throw new Error('VPN readiness failed')
   return null
  }}
 })
 await page.goto('/');await page.getByText('Импорт профилей и подписок').click()
 await page.getByRole('textbox',{name:'VPN-ссылки',exact:true}).fill(links.split('\n')[0])
 await page.getByRole('button',{name:'Импортировать',exact:true}).click()
 await page.getByRole('button',{name:'Подключить VPN',exact:true}).click()
 await expect(page.getByRole('status').filter({hasText:'VPN readiness failed'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Подключить VPN',exact:true})).toHaveAttribute('aria-pressed','false')
})
