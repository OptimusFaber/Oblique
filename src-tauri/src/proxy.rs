use std::{fs, path::Path, process::Command};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
struct Entry { schema: String, key: String, value: String }

fn run(program: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new(program);
    let mut arguments:Vec<String>=args.iter().map(|s|s.to_string()).collect();
    if cfg!(windows) && program=="powershell.exe" {
        if let Some(index)=arguments.iter().position(|s|s=="-Command") {
            if let Some(script)=arguments.get_mut(index+1) { *script=format!("[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); {script}"); }
        }
    }
    cmd.args(arguments);
    #[cfg(windows)] { use std::os::windows::process::CommandExt; cmd.creation_flags(0x08000000); }
    let out = cmd.output().map_err(|e| format!("{program}: {e}"))?;
    if !out.status.success() { return Err(String::from_utf8_lossy(&out.stderr).trim().to_string()); }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

pub fn restore(path: &Path) -> Result<(), String> {
    if !path.exists() { return Ok(()); }
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    #[cfg(windows)] {
        // The snapshot is passed as stdin data, never interpolated as PowerShell code.
        use std::io::Write;
        use std::process::Stdio;
        use std::os::windows::process::CommandExt;
        let script = r#"[Console]::InputEncoding=[System.Text.UTF8Encoding]::new();$ErrorActionPreference='Stop';$s=[Console]::In.ReadToEnd()|ConvertFrom-Json;$k='HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings';foreach($n in @('ProxyEnable','ProxyServer','ProxyOverride','AutoConfigURL')){if($null -eq $s.$n){Remove-ItemProperty $k $n -ErrorAction SilentlyContinue}else{Set-ItemProperty $k $n $s.$n}}"#;
        let mut c = Command::new("powershell.exe").args(["-NoProfile", "-NonInteractive", "-Command", script]).creation_flags(0x08000000).stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::piped()).spawn().map_err(|e|e.to_string())?;
        c.stdin.take().ok_or("stdin unavailable")?.write_all(text.as_bytes()).map_err(|e|e.to_string())?;
        let output=c.wait_with_output().map_err(|e|e.to_string())?;
        if !output.status.success() { return Err(format!("Could not restore Windows proxy; recovery snapshot was kept: {}", String::from_utf8_lossy(&output.stderr).trim())); }
        notify_windows();
    }
    #[cfg(not(windows))] {
        let entries: Vec<Entry> = serde_json::from_str(&text).map_err(|e|e.to_string())?;
        for e in entries.iter().rev() {
            if let Err(error)=run("gsettings", &["set", &e.schema, &e.key, &e.value]) { return Err(format!("{error}; recovery snapshot was kept")); }
        }
    }
    fs::remove_file(path).map_err(|e|format!("Could not remove recovered proxy snapshot: {e}"))?;
    Ok(())
}

#[cfg(windows)]
fn notify_windows() {
    #[link(name="wininet")]
    extern "system" { fn InternetSetOptionW(h: *mut core::ffi::c_void, option: u32, buffer: *mut core::ffi::c_void, len: u32) -> i32; }
    unsafe { InternetSetOptionW(std::ptr::null_mut(),39,std::ptr::null_mut(),0); InternetSetOptionW(std::ptr::null_mut(),37,std::ptr::null_mut(),0); }
}

pub fn enable(path: &Path, port: u16, bypass_lan: bool) -> Result<(), String> {
    if path.exists() { return Err("An unrestored proxy snapshot exists. Restart Oblique to recover it.".into()); }
    #[cfg(windows)] {
        let snapshot = run("powershell.exe", &["-NoProfile", "-NonInteractive", "-Command", r#"$ErrorActionPreference='Stop';$p=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings';@{ProxyEnable=$p.ProxyEnable;ProxyServer=$p.ProxyServer;ProxyOverride=$p.ProxyOverride;AutoConfigURL=$p.AutoConfigURL}|ConvertTo-Json -Compress"#])?;
        fs::write(path, snapshot).map_err(|e|e.to_string())?;
        let bypass = if bypass_lan { "<local>;localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.2?.*;172.30.*;172.31.*;192.168.*;[::1]" } else { "localhost;127.*;[::1]" };
        let script = format!(r#"$ErrorActionPreference='Stop';$k='HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings';Set-ItemProperty $k ProxyServer '127.0.0.1:{port}';Set-ItemProperty $k ProxyOverride '{bypass}';Remove-ItemProperty $k AutoConfigURL -ErrorAction SilentlyContinue;Set-ItemProperty $k ProxyEnable 1"#);
        if let Err(e) = run("powershell.exe", &["-NoProfile", "-NonInteractive", "-Command", &script]) { let _=restore(path); return Err(e); }
        notify_windows();
    }
    #[cfg(not(windows))] {
        let desktop=std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default().to_uppercase();
        if !desktop.is_empty() && !["GNOME","UNITY","BUDGIE","CINNAMON"].iter().any(|name|desktop.contains(name)) {
            return Err("Automatic desktop proxy is supported on GNOME-compatible desktops. Use TUN or configure SOCKS5 127.0.0.1:17890 in your application.".into());
        }
        let list = [("org.gnome.system.proxy", "mode"), ("org.gnome.system.proxy", "ignore-hosts"), ("org.gnome.system.proxy", "autoconfig-url"),
                    ("org.gnome.system.proxy.http", "host"), ("org.gnome.system.proxy.http", "port"),
                    ("org.gnome.system.proxy.https", "host"), ("org.gnome.system.proxy.https", "port"),
                    ("org.gnome.system.proxy.socks", "host"), ("org.gnome.system.proxy.socks", "port")];
        let mut entries=Vec::new();
        for (schema,key) in list { entries.push(Entry { schema:schema.into(), key:key.into(), value:run("gsettings", &["get",schema,key])? }); }
        fs::write(path,serde_json::to_string(&entries).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
        let update = || -> Result<(),String> {
            for proto in ["http","https","socks"] {
                let schema=format!("org.gnome.system.proxy.{proto}");
                run("gsettings", &["set",&schema,"host","'127.0.0.1'"])?;
                run("gsettings", &["set",&schema,"port",&port.to_string()])?;
            }
            let bypass = if bypass_lan { "['localhost','127.0.0.0/8','::1','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16']" } else { "['localhost','127.0.0.0/8','::1']" };
            run("gsettings", &["set","org.gnome.system.proxy","ignore-hosts",bypass])?;
            run("gsettings", &["set","org.gnome.system.proxy","mode","'manual'"])?;
            let mode=run("gsettings", &["get","org.gnome.system.proxy","mode"])?;
            if mode != "'manual'" { return Err("Desktop proxy settings were not applied. Use TUN or configure 127.0.0.1:17890 in your application.".into()); }
            Ok(())
        };
        if let Err(e)=update() { let _=restore(path); return Err(e); }
    }
    Ok(())
}
