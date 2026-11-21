mod engine;
mod proxy;
mod watchdog;
use std::{fs, path::PathBuf, time::Duration};
use serde_json::{json,Value};
fn main(){
 if watchdog::maybe_run(){return;}
 let args:Vec<String>=std::env::args().collect();
 if args.len()<4 { eprintln!("Usage: oblique-engine-test CORE CONFIG TEMP_DIRECTORY [--proxy] [--wait]");std::process::exit(2); }
 let core=PathBuf::from(&args[1]);
 let config:Value=serde_json::from_slice(&fs::read(&args[2]).expect("config file")).expect("config JSON");
 let dir=PathBuf::from(&args[3]);fs::create_dir_all(&dir).unwrap();
 let snapshot=dir.join("proxy-backup.json");
 let use_proxy=args.iter().any(|a|a=="--proxy");
 let mut e=engine::Engine::new(snapshot.clone());
 e.start(core.clone(),config.clone(),use_proxy,true).expect("VPN start must complete an HTTP probe");
 assert_eq!(e.connections().unwrap()["running"],json!(true));
 assert_eq!(e.probe("https://cp.cloudflare.com/generate_204").unwrap()["status"],json!(204));
 let tag=config["outbounds"].as_array().unwrap().iter().find(|o|o["type"]=="vless").unwrap()["tag"].as_str().unwrap();
 e.api_snapshot().unwrap().delay(tag).expect("Clash per-profile HTTP delay must work");
 e.api_snapshot().unwrap().select(tag).expect("Live selector must work");
 println!("PASS native engine: validated config, readiness, HTTPS through SOCKS, live status");
 if args.iter().any(|a|a=="--wait") {
  println!("READY_FOR_CRASH_TEST");
  loop{std::thread::sleep(Duration::from_secs(1));}
 }
 e.stop().expect("restore proxy and stop");
 assert!(!snapshot.exists());assert_eq!(e.connections().unwrap()["running"],json!(false));
 assert!(!dir.join("run.json").exists());
 println!("PASS native engine: stopped, restored proxy snapshot, removed run config");
 let mut wrong=config.clone();
 if let Some(outbounds)=wrong["outbounds"].as_array_mut(){for o in outbounds{if o["type"]=="vless"{o["uuid"]=json!("00000000-0000-4000-8000-000000000099");}}}
 // A DIRECT rule for the health domains must never mask invalid VPN credentials.
 wrong["route"]["rules"].as_array_mut().unwrap().insert(0,json!({"domain_suffix":["cloudflare.com","gstatic.com"],"action":"route","outbound":"direct"}));
 assert!(e.start(core.clone(),wrong,false,true).is_err(),"Wrong credentials must fail native readiness even when health domains route DIRECT");
 assert_eq!(e.connections().unwrap()["running"],json!(false));
 println!("PASS native engine: wrong UUID rejected, no false connected state");
 let mut invalid=config.clone();invalid["outbounds"]=json!([{"type":"invalid-protocol","tag":"proxy"}]);
 assert!(e.start(core,invalid,false,true).is_err());
 assert_eq!(e.connections().unwrap()["running"],json!(false));
 e.stop().unwrap();println!("PASS native engine: invalid config rejected without a leftover process");
}
