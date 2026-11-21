use std::{fs, path::PathBuf, time::{Duration,Instant}};

pub fn maybe_run() -> bool {
    let args:Vec<String>=std::env::args().collect();
    if args.get(1).map(String::as_str)!=Some("--oblique-watchdog") { return false; }
    if args.len()!=6 { return true; }
    let (Ok(parent),Ok(core))=(args[2].parse::<u32>(),args[3].parse::<u32>()) else {return true;};
    let snapshot=PathBuf::from(&args[4]);
    let stop_file=PathBuf::from(&args[5]);
    #[cfg(unix)] {
        loop {
            let alive=unsafe{libc::getppid() as u32==parent && libc::kill(parent as i32,0)==0};
            if !alive { break; }
            std::thread::sleep(Duration::from_millis(500));
        }
        let _=fs::write(&stop_file,b"stop");
        unsafe{libc::kill(core as i32,libc::SIGTERM);}
        let deadline=Instant::now()+Duration::from_secs(5);
        while Instant::now()<deadline {
            if unsafe{libc::kill(core as i32,0)}!=0 {break;}
            std::thread::sleep(Duration::from_millis(100));
        }
        if unsafe{libc::kill(core as i32,0)}==0 {unsafe{libc::kill(core as i32,libc::SIGKILL);}}
    }
    #[cfg(windows)] unsafe {
        use windows_sys::Win32::System::Threading::{OpenProcess,WaitForSingleObject,TerminateProcess,PROCESS_TERMINATE,PROCESS_SYNCHRONIZE};
        use windows_sys::Win32::Foundation::CloseHandle;
        let process=OpenProcess(PROCESS_SYNCHRONIZE,0,parent);
        if !process.is_null() { WaitForSingleObject(process,u32::MAX); CloseHandle(process); }
        let _=fs::write(&stop_file,b"stop");
        let child=OpenProcess(PROCESS_TERMINATE|PROCESS_SYNCHRONIZE,0,core);
        if !child.is_null() {
            if WaitForSingleObject(child,5000)!=0 {TerminateProcess(child,1);}
            CloseHandle(child);
        }
    }
    let _=crate::proxy::restore(&snapshot);
    let _=fs::remove_file(stop_file);
    let _=fs::remove_file(snapshot.with_file_name("run.json"));
    true
}
