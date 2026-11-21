mod engine;
mod proxy;
pub mod watchdog;
use std::sync::{Arc,Mutex};
use serde_json::Value;
use tauri::Manager;
type Shared = Arc<Mutex<engine::Engine>>;

#[tauri::command]
async fn core_start(app:tauri::AppHandle,state:tauri::State<'_,Shared>,config_json:String,use_proxy:bool,bypass_lan:bool)->Result<Value,String>{
 let core=engine::resolve_core(&app)?;
 let config:Value=serde_json::from_str(&config_json).map_err(|e|e.to_string())?;
 let engine=state.inner().clone();
 tauri::async_runtime::spawn_blocking(move||engine.lock().map_err(|e|e.to_string())?.start(core,config,use_proxy,bypass_lan)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn core_stop(state:tauri::State<'_,Shared>)->Result<(),String>{
 let engine=state.inner().clone();
 tauri::async_runtime::spawn_blocking(move||engine.lock().map_err(|e|e.to_string())?.stop()).await.map_err(|e|e.to_string())?
}
#[tauri::command]
fn core_hint(app:tauri::AppHandle)->String{engine::resolve_core(&app).map(|p|format!("Core: {}",p.display())).unwrap_or_else(|e|e)}
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
  if let Err(e)=proxy::restore(&path){return Err(std::io::Error::other(format!("Cannot recover previous proxy settings: {e}")).into());}
  let shared=Arc::new(Mutex::new(engine::Engine::new(path)));
  app.manage(shared.clone());
  std::thread::spawn(move||loop{
   std::thread::sleep(std::time::Duration::from_secs(2));
   if let Ok(mut state)=shared.try_lock(){if let Err(e)=state.poll(){log::error!("VPN watchdog: {e}");}}
  });
  Ok(())
 })
 .invoke_handler(tauri::generate_handler![core_start,core_stop,core_hint,core_status,core_logs,core_delay,core_select,core_probe,tcp_ping_ms,fetch_subscription])
 .build(tauri::generate_context!()).expect("Could not start Oblique");
 app.run(|app,event|if let tauri::RunEvent::Exit=event {if let Some(state)=app.try_state::<Shared>(){if let Ok(mut engine)=state.lock(){let _=engine.stop();};}});
}
