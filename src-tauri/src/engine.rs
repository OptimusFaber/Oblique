use std::{collections::VecDeque, fs, io::{BufRead, BufReader}, net::{TcpListener, TcpStream}, path::PathBuf, process::{Child, Command, Stdio}, sync::{Arc,Mutex}, time::{Duration,Instant}};
use serde_json::{json, Value};
use tauri::Manager;
use crate::proxy;

#[derive(Clone)]
pub struct ApiClient { token:String, api_port:u16, mixed_port:u16 }
impl ApiClient {
    fn api(&self, path:&str) -> Result<reqwest::blocking::Response,String> {
        reqwest::blocking::Client::builder().no_proxy().timeout(Duration::from_secs(10)).build().map_err(|e|e.to_string())?
          .get(format!("http://127.0.0.1:{}{path}",self.api_port)).bearer_auth(&self.token).send().and_then(|r|r.error_for_status()).map_err(|e|e.to_string())
    }
    pub fn connections(&self) -> Result<Value,String> {
        let data:Value=self.api("/connections")?.json().map_err(|e|e.to_string())?;
        Ok(json!({"running":true,"data":data}))
    }
    pub fn delay(&self, tag:&str) -> Result<u64,String> {
        let client=reqwest::blocking::Client::builder().no_proxy().timeout(Duration::from_secs(9)).build().map_err(|e|e.to_string())?;
        let mut url=reqwest::Url::parse(&format!("http://127.0.0.1:{}/proxies/",self.api_port)).map_err(|e|e.to_string())?;
        url.path_segments_mut().map_err(|_|"Invalid URL")?.pop_if_empty().push(tag).push("delay");
        for target in ["https://cp.cloudflare.com/generate_204","https://www.gstatic.com/generate_204"] {
            let data=client.get(url.clone()).query(&[("url",target),("timeout","6000")]).bearer_auth(&self.token).send().and_then(|r|r.error_for_status()).and_then(|r|r.json::<Value>());
            if let Ok(data)=data { if let Some(delay)=data["delay"].as_u64(){return Ok(delay);} }
        }
        Err("VPN HTTP probes failed".into())
    }
    pub fn select(&self, tag:&str) -> Result<(),String> {
        reqwest::blocking::Client::builder().no_proxy().timeout(Duration::from_secs(5)).build().map_err(|e|e.to_string())?
          .put(format!("http://127.0.0.1:{}/proxies/proxy",self.api_port)).bearer_auth(&self.token).json(&json!({"name":tag})).send().and_then(|r|r.error_for_status()).map_err(|e|e.to_string())?;
        Ok(())
    }
    pub fn probe(&self, url:&str) -> Result<Value,String> {
        let u=reqwest::Url::parse(url).map_err(|e|e.to_string())?;
        if !["https","http"].contains(&u.scheme()) || !u.username().is_empty() || u.password().is_some() { return Err("Use an HTTP(S) URL without credentials".into()); }
        let start=Instant::now();
        let response=reqwest::blocking::Client::builder().no_proxy().proxy(reqwest::Proxy::all(format!("socks5h://127.0.0.1:{}",self.mixed_port)).map_err(|e|e.to_string())?)
          .timeout(Duration::from_secs(15)).redirect(reqwest::redirect::Policy::limited(5)).build().map_err(|e|e.to_string())?
          .get(u).send().map_err(|e|e.to_string())?;
        Ok(json!({"status":response.status().as_u16(),"elapsedMs":start.elapsed().as_millis()}))
    }
}

pub struct Engine {
    child: Option<Child>, guard: Option<Child>, pub logs: Arc<Mutex<VecDeque<String>>>,
    token: String, api_port: u16, mixed_port: u16, snapshot: PathBuf,
    last_error: String, stop_file: Option<PathBuf>, pub online: bool,
}
impl Engine {
    pub fn new(snapshot: PathBuf) -> Self { Self { child:None,guard:None, logs:Arc::new(Mutex::new(VecDeque::new())),token:String::new(),api_port:0,mixed_port:17890,snapshot,last_error:String::new(),stop_file:None,online:false } }
    pub fn stop(&mut self) -> Result<(),String> {
        self.online=false;
        if let Some(mut g)=self.guard.take() { let _=g.kill(); let _=g.wait(); }
        // Restore the desktop settings before taking away its proxy.
        let restored=proxy::restore(&self.snapshot);
        if let Some(mut c)=self.child.take() {
            if let Some(path)=&self.stop_file { let _=fs::write(path,b"stop"); }
            #[cfg(unix)] unsafe { libc::kill(c.id() as i32, libc::SIGTERM); }
            let deadline=Instant::now()+Duration::from_secs(5);
            while Instant::now()<deadline { if matches!(c.try_wait(),Ok(Some(_))) { break; } std::thread::sleep(Duration::from_millis(50)); }
            if !matches!(c.try_wait(),Ok(Some(_))) { let _=c.kill(); }
            let _=c.wait();
        }
        if let Some(path)=self.stop_file.take(){let _=fs::remove_file(path);}
        let _=fs::remove_file(self.snapshot.with_file_name("run.json"));
        restored
    }
    pub fn poll(&mut self) -> Result<(),String> {
        if let Some(c)=self.child.as_mut() {
            if let Some(status)=c.try_wait().map_err(|e|e.to_string())? {
                self.last_error=format!("VPN core exited ({status}). {}", self.tail());
                self.child=None; self.online=false;
                if let Some(mut g)=self.guard.take(){let _=g.kill();let _=g.wait();}
                let restored=proxy::restore(&self.snapshot);
                if let Some(path)=self.stop_file.take(){let _=fs::remove_file(path);}
                let _=fs::remove_file(self.snapshot.with_file_name("run.json"));
                restored?;
            }
        }
        Ok(())
    }
    fn tail(&self) -> String { self.logs.lock().map(|v|v.iter().rev().take(8).cloned().collect::<Vec<_>>().join("\n")).unwrap_or_default() }
    fn client(&self) -> ApiClient { ApiClient { token:self.token.clone(),api_port:self.api_port,mixed_port:self.mixed_port } }
    pub fn api_snapshot(&mut self) -> Result<ApiClient,String> {
        self.poll()?;
        if !self.online {return Err(if self.last_error.is_empty(){"VPN is disconnected".into()}else{self.last_error.clone()});}
        Ok(self.client())
    }
    pub fn connections(&mut self) -> Result<Value,String> {
        self.poll()?;
        if !self.online {return Ok(json!({"running":false,"error":self.last_error}));}
        self.client().connections()
    }
    pub fn probe(&self,url:&str) -> Result<Value,String> {
        if !self.online {return Err("VPN is disconnected".into());}
        self.client().probe(url)
    }
    pub fn start(&mut self, core:PathBuf, config:Value, use_proxy:bool, bypass_lan:bool) -> Result<Value,String> {
        let result=self.start_inner(core,config,use_proxy,bypass_lan);
        if result.is_err() { if let Err(cleanup)=self.stop() { return Err(format!("{}; proxy recovery failed: {cleanup}",result.unwrap_err())); } }
        result
    }
    fn start_inner(&mut self, core:PathBuf, mut config:Value, use_proxy:bool, bypass_lan:bool) -> Result<Value,String> {
        self.stop()?;
        self.last_error.clear();
        self.logs.lock().map_err(|e|e.to_string())?.clear();
        let listener=TcpListener::bind("127.0.0.1:0").map_err(|e|e.to_string())?;
        self.api_port=listener.local_addr().map_err(|e|e.to_string())?.port();
        self.token=uuid::Uuid::new_v4().to_string();
        // When the kernel has IPv6 disabled globally there is no IPv6 path to capture.
        #[cfg(target_os="linux")]
        if fs::read_to_string("/proc/sys/net/ipv6/conf/all/disable_ipv6").map(|s|s.trim()=="1").unwrap_or(false) {
            if let Some(inbounds)=config["inbounds"].as_array_mut() { for inbound in inbounds {
                if inbound["type"]=="tun" { if let Some(addresses)=inbound["address"].as_array_mut() { addresses.retain(|a|!a.as_str().unwrap_or("").contains(':')); } }
            } }
        }
        config["experimental"]["clash_api"]["external_controller"]=json!(format!("127.0.0.1:{}",self.api_port));
        config["experimental"]["clash_api"]["secret"]=json!(self.token);
        // Reserve the proxy port check and fail clearly if another application owns it.
        self.mixed_port=config["inbounds"][0]["listen_port"].as_u64().ok_or("Mixed inbound is missing")?.try_into().map_err(|_|"Invalid port")?;
        let check_port=TcpListener::bind(("127.0.0.1",self.mixed_port)).map_err(|_|format!("Port {} is already in use",self.mixed_port))?;
        let dir=self.snapshot.parent().ok_or("Data directory missing")?;
        fs::create_dir_all(dir).map_err(|e|e.to_string())?;
        let path=dir.join("run.json");
        let stop_file=dir.join(format!("stop-{}.signal",uuid::Uuid::new_v4()));
        self.stop_file=Some(stop_file.clone());
        #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; fs::set_permissions(dir,fs::Permissions::from_mode(0o700)).map_err(|e|e.to_string())?; }
        fs::write(&path,serde_json::to_vec_pretty(&config).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
        #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; fs::set_permissions(&path,fs::Permissions::from_mode(0o600)).map_err(|e|e.to_string())?; }
        let mut validate=Command::new(&core);
        validate.args(["sing-box","check","--disable-color","-c"]).arg(&path);
        #[cfg(windows)] { use std::os::windows::process::CommandExt; validate.creation_flags(0x08000000); }
        let checked=validate.output().map_err(|e|e.to_string())?;
        if !checked.status.success() { return Err(format!("Configuration rejected: {}",String::from_utf8_lossy(&checked.stderr))); }
        drop(listener); drop(check_port);
        let mut command=Command::new(&core);
        command.args(["sing-box","run","--disable-color","-c"]).arg(&path).arg("--oblique-stop-file").arg(&stop_file).current_dir(core.parent().ok_or("Core directory missing")?).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
        #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
        let mut child=command.spawn().map_err(|e|e.to_string())?;
        for reader in [child.stdout.take().map(|r|Box::new(r) as Box<dyn std::io::Read+Send>), child.stderr.take().map(|r|Box::new(r) as Box<dyn std::io::Read+Send>)].into_iter().flatten() {
            let logs=self.logs.clone();
            std::thread::spawn(move || { for line in BufReader::new(reader).lines().map_while(Result::ok) { if let Ok(mut q)=logs.lock() { q.push_back(line.chars().take(2048).collect()); while q.len()>500 { q.pop_front(); } } } });
        }
        let core_pid=child.id();
        self.child=Some(child);
        let mut guard=Command::new(std::env::current_exe().map_err(|e|e.to_string())?);
        guard.arg("--oblique-watchdog").arg(std::process::id().to_string()).arg(core_pid.to_string()).arg(&self.snapshot).arg(&stop_file).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
        #[cfg(windows)] { use std::os::windows::process::CommandExt; guard.creation_flags(0x08000000); }
        match guard.spawn(){Ok(g)=>self.guard=Some(g),Err(e)=>{let _=self.stop();return Err(format!("Could not start crash recovery: {e}"));}}

        let result=(|| -> Result<Value,String> {
            let deadline=Instant::now()+Duration::from_secs(15);
            loop {
                self.poll()?;
                if self.child.is_none() { return Err(self.last_error.clone()); }
                if self.client().api("/version").is_ok() { break; }
                if Instant::now()>deadline { return Err(format!("Core startup timed out. {}",self.tail())); }
                std::thread::sleep(Duration::from_millis(150));
            }
            // Test the selected outbound directly. User routing rules may send
            // a health-check domain to DIRECT and must not create a false positive.
            let tag=config["outbounds"].as_array().and_then(|list|list.iter().find(|o|o["type"]=="selector" && o["tag"]=="proxy")).and_then(|o|o["default"].as_str()).ok_or("Selected VPN outbound missing")?;
            let latency=self.client().delay(tag)?;
            self.poll()?;
            if self.child.is_none(){return Err(self.last_error.clone());}
            TcpStream::connect_timeout(&std::net::SocketAddr::from(([127,0,0,1],self.mixed_port)),Duration::from_secs(2)).map_err(|e|format!("Proxy listener is not ready: {e}"))?;
            self.online=true;
            let check=json!({"latencyMs":latency});
            if use_proxy { proxy::enable(&self.snapshot,self.mixed_port,bypass_lan)?; }
            Ok(check)
        })();
        if result.is_err() { let _=self.stop(); }
        result
    }
    pub fn logs(&self) -> Vec<String> { self.logs.lock().map(|mut v|v.drain(..).collect()).unwrap_or_default() }
}
impl Drop for Engine { fn drop(&mut self) { let _=self.stop(); } }

pub fn resolve_core(app:&tauri::AppHandle) -> Result<PathBuf,String> {
    for name in ["OBLIQUE_CORE"] {
        if let Ok(p)=std::env::var(name) { let p=PathBuf::from(p); if p.is_file() { return Ok(p); } return Err(format!("{name} is not a file")); }
    }
    let name=if cfg!(windows) { "oblique-core.exe" } else { "oblique-core" };
    if let Ok(dir)=app.path().resource_dir() {
        for p in [dir.join("resources").join(name),dir.join(name)] { if p.is_file() { return Ok(p); } }
    }
    let p=std::env::current_exe().map_err(|e|e.to_string())?.parent().ok_or("Executable directory missing")?.join(name);
    if p.is_file() { return Ok(p); }
    Err("VPN core is missing. Reinstall Oblique with its bundled core.".into())
}

pub fn tcp_ping(host:&str,port:u16) -> u32 {
    use std::net::ToSocketAddrs;
    if host.is_empty() || port==0 { return u32::MAX; }
    if let Ok(addrs)=(host,port).to_socket_addrs() { for addr in addrs {
        let start=Instant::now(); if TcpStream::connect_timeout(&addr,Duration::from_secs(3)).is_ok() { return start.elapsed().as_millis().min(u128::from(u32::MAX)) as u32; }
    }}
    u32::MAX
}
