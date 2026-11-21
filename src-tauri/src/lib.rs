mod engine;
mod proxy;
pub mod watchdog;
mod tray;
use std::sync::{Arc,Mutex};
use serde_json::Value;
use tauri::Manager;
type Shared = Arc<Mutex<engine::Engine>>;

#[tauri::command]
async fn core_start(app:tauri::AppHandle,state:tauri::State<'_,Shared>,config_json:String,use_proxy:bool,bypass_lan:bool)->Result<Value,String>{
 let core=engine::resolve_core(&app)?;
 let config:Value=serde_json::from_str(&config_json).map_err(|e|e.to_string())?;
 let engine=state.inner().clone();
 let result=tauri::async_runtime::spawn_blocking(move||engine.lock().map_err(|e|e.to_string())?.start(core,config,use_proxy,bypass_lan)).await.map_err(|e|e.to_string())?;
 #[cfg(windows)] tray::set_connected(&app,result.is_ok());
 result
}
#[tauri::command]
async fn core_stop(app:tauri::AppHandle,state:tauri::State<'_,Shared>)->Result<(),String>{
 let engine=state.inner().clone();
 let result=tauri::async_runtime::spawn_blocking(move||engine.lock().map_err(|e|e.to_string())?.stop()).await.map_err(|e|e.to_string())?;
 #[cfg(windows)] tray::set_connected(&app,false);
 #[cfg(not(windows))] let _=app;
 result
}
#[tauri::command]
fn core_hint(app:tauri::AppHandle)->String{engine::resolve_core(&app).map(|p|format!("Core: {}",p.display())).unwrap_or_else(|e|e)}
#[tauri::command]
fn set_window_mode(app:tauri::AppHandle,compact:bool)->Result<(),String>{
 let window=app.get_webview_window("main").ok_or("Main window is unavailable")?;
 window.unmaximize().map_err(|e|e.to_string())?;
 window.set_fullscreen(false).map_err(|e|e.to_string())?;
 window.set_min_size(Some(tauri::LogicalSize::new(if compact {360.0}else{760.0},if compact {560.0}else{560.0}))).map_err(|e|e.to_string())?;
 window.set_max_size(None::<tauri::LogicalSize<f64>>).map_err(|e|e.to_string())?;
 window.set_size(tauri::LogicalSize::new(if compact {420.0}else{1100.0},if compact {760.0}else{760.0})).map_err(|e|e.to_string())
}
#[tauri::command]
async fn core_status(state:tauri::State<'_,Shared>)->Result<Value,String>{
 let engine=state.inner().clone();
 tauri::async_runtime::spawn_blocking(move||{
  let api={let mut g=engine.lock().map_err(|e|e.to_string())?;match g.api_snapshot(){Ok(api)=>api,Err(e)=>return Ok(serde_json::json!({"running":false,"error":e}))}};
  api.connections()
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
fn core_logs(state:tauri::State<'_,Shared>)->Vec<String>{state.lock().map(|s|s.logs()).unwrap_or_default()}
#[tauri::command]
async fn core_delay(state:tauri::State<'_,Shared>,tag:String)->Result<u64,String>{
 let engine=state.inner().clone();
 let api=engine.lock().map_err(|e|e.to_string())?.api_snapshot()?;
 tauri::async_runtime::spawn_blocking(move||api.delay(&tag)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn core_select(state:tauri::State<'_,Shared>,tag:String)->Result<(),String>{
 let engine=state.inner().clone();
 let api=engine.lock().map_err(|e|e.to_string())?.api_snapshot()?;
 tauri::async_runtime::spawn_blocking(move||api.select(&tag)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn core_probe(state:tauri::State<'_,Shared>,url:String)->Result<Value,String>{
 let engine=state.inner().clone();
 let api=engine.lock().map_err(|e|e.to_string())?.api_snapshot()?;
 tauri::async_runtime::spawn_blocking(move||api.probe(&url)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn tcp_ping_ms(host:String,port:u16)->Result<u32,String>{tauri::async_runtime::spawn_blocking(move||engine::tcp_ping(&host,port)).await.map_err(|e|e.to_string())}
#[tauri::command]
async fn detect_country(host:String)->Result<Option<String>,String>{
 tauri::async_runtime::spawn_blocking(move||{
  use std::net::ToSocketAddrs;
  let ip=(host.as_str(),0).to_socket_addrs().map_err(|e|e.to_string())?.next().ok_or("Host did not resolve")?.ip();
  let local=match ip { std::net::IpAddr::V4(v)=>v.is_loopback()||v.is_private()||v.is_link_local()||v.is_multicast()||v.is_unspecified(), std::net::IpAddr::V6(v)=>v.is_loopback()||v.is_unique_local()||v.is_unicast_link_local()||v.is_multicast()||v.is_unspecified() };
  if local{return Ok(None)}
  #[derive(serde::Deserialize)] struct Geo { country_code:Option<String> }
  let value=reqwest::blocking::Client::builder().no_proxy().https_only(true).timeout(std::time::Duration::from_secs(5)).build().map_err(|e|e.to_string())?
   .get(format!("https://ipapi.co/{ip}/json/")).send().and_then(|r|r.error_for_status()).map_err(|e|e.to_string())?
   .json::<Geo>().map_err(|e|e.to_string())?;
  Ok(value.country_code.filter(|c|c.len()==2).map(|c|c.to_uppercase()))
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn fetch_subscription(url:String)->Result<String,String>{
 tauri::async_runtime::spawn_blocking(move||{
  let u=reqwest::Url::parse(&url).map_err(|e|e.to_string())?;
  if u.scheme()!="https" || !u.username().is_empty() || u.password().is_some(){return Err("Subscription URL must use HTTPS without embedded credentials".into());}
  let mut response=reqwest::blocking::Client::builder().no_proxy().https_only(true).timeout(std::time::Duration::from_secs(20)).redirect(reqwest::redirect::Policy::limited(5)).build().map_err(|e|e.to_string())?
   .get(u).header("User-Agent","Oblique/2.1").send().and_then(|r|r.error_for_status()).map_err(|e|e.to_string())?;
  use std::io::Read;
  let mut data=Vec::new(); (&mut response).take(2*1024*1024+1).read_to_end(&mut data).map_err(|e|e.to_string())?;
  if data.len()>2*1024*1024 {return Err("Subscription exceeds 2 MiB".into());}
  String::from_utf8(data).map_err(|e|e.to_string())
 }).await.map_err(|e|e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(){
 let app=tauri::Builder::default()
 .plugin(tauri_plugin_single_instance::init(|app,_,_|{if let Some(win)=app.get_webview_window("main"){let _=win.show();let _=win.set_focus();}}))
 .plugin(tauri_plugin_log::Builder::new().level(log::LevelFilter::Info).build())
 .setup(|app|{
  let directory=app.path().app_local_data_dir()?;
  std::fs::create_dir_all(&directory)?;
  #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; std::fs::set_permissions(&directory,std::fs::Permissions::from_mode(0o700))?; }
  let path=directory.join("proxy-backup.json");
  let recovery_error=proxy::restore(&path).err();
  if let Some(e)=&recovery_error {log::error!("Cannot recover previous proxy settings: {e}");}
  let mut engine=engine::Engine::new(path);
  if let Some(e)=recovery_error {engine.set_recovery_error(e);}
  let shared=Arc::new(Mutex::new(engine));
  app.manage(shared.clone());
  #[cfg(windows)] tray::install(app.handle())?;
  #[cfg(windows)] let tray_app=app.handle().clone();
  std::thread::spawn(move||loop{
   std::thread::sleep(std::time::Duration::from_secs(2));
   if let Ok(mut state)=shared.try_lock(){
    if let Err(e)=state.poll(){log::error!("VPN watchdog: {e}");}
    #[cfg(windows)] tray::set_connected(&tray_app,state.online);
   }
  });
  Ok(())
 })
 .invoke_handler(tauri::generate_handler![core_start,core_stop,core_hint,set_window_mode,core_status,core_logs,core_delay,core_select,core_probe,tcp_ping_ms,detect_country,fetch_subscription])
 .build(tauri::generate_context!()).expect("Could not start Oblique");
 app.run(|app,event|if let tauri::RunEvent::Exit=event {if let Some(state)=app.try_state::<Shared>(){if let Ok(mut engine)=state.lock(){let _=engine.stop();};}});
}
