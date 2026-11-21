"""Real WebKitGTK + Rust IPC test. Runs under a private D-Bus/dconf profile."""
import json, os, sys, subprocess, time, tempfile, pathlib, urllib.request, urllib.error, shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]

def child(private):
    env=os.environ.copy()
    env.update(TAURI_WEBVIEW_AUTOMATION='true', WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS='1', WEBKIT_DISABLE_DMABUF_RENDERER='1', LIBGL_ALWAYS_SOFTWARE='1', DISPLAY=':93')
    app=ROOT/'src-tauri/target/release/oblique'
    driver=None; xvfb=None; sid=None
    base='http://127.0.0.1:4449'
    def call(method, endpoint, body=None):
        data=None if body is None else json.dumps(body).encode()
        req=urllib.request.Request(base+endpoint,data=data,headers={'Content-Type':'application/json'},method=method)
        try:
            with urllib.request.urlopen(req,timeout=60) as r: data=json.load(r)
        except urllib.error.HTTPError as e:
            raise RuntimeError(e.read().decode()[:1000])
        if isinstance(data.get('value'),dict) and data['value'].get('error'): raise RuntimeError(str(data['value'])[:1000])
        return data.get('value',data)
    def execute(script,args=None): return call('POST',f'/session/{sid}/execute/sync',{'script':script,'args':args or []})
    def wait_for(script, seconds=50):
        end=time.time()+seconds
        while time.time()<end:
            if execute(script): return
            time.sleep(.4)
        raise AssertionError('Native UI did not reach expected state')
    def proxy_mode(): return subprocess.check_output(['gsettings','get','org.gnome.system.proxy','mode'],env=env,text=True).strip()
    try:
        xvfb=subprocess.Popen(['Xvfb',':93','-screen','0','1200x800x24'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        time.sleep(.5)
        driver=subprocess.Popen(['WebKitWebDriver','--port=4449'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        for _ in range(100):
            try: call('GET','/status'); break
            except Exception: time.sleep(.1)
        value=call('POST','/session',{'capabilities':{'alwaysMatch':{'webkitgtk:browserOptions':{'binary':str(app),'args':[]}}}})
        sid=value['sessionId']
        wait_for("return document.querySelector('h1')?.textContent === 'Oblique'")
        profiles=json.loads((private/'fixture/profiles.json').read_text())
        execute("localStorage.setItem('oblique_v2_servers',JSON.stringify(arguments[0]));location.reload();return true",[profiles])
        wait_for("return !!document.querySelector('[aria-label=\"Подключить VPN\"]')")
        before=proxy_mode()
        execute("document.querySelector('[aria-label=\"Подключить VPN\"]').click();return true")
        wait_for("return !!document.querySelector('[aria-label=\"Отключить VPN\"]')")
        assert proxy_mode()=="'manual'"
        print('PASS native WebKit UI → real Rust IPC → verified VPN connection → desktop proxy applied',flush=True)
        execute("document.querySelector('[aria-label=\"Отключить VPN\"]').click();return true")
        wait_for("return !!document.querySelector('[aria-label=\"Подключить VPN\"]:not(:disabled)')")
        assert proxy_mode()==before
        print('PASS native disconnect restores previous GNOME proxy',flush=True)
        execute("document.querySelector('[aria-label=\"Подключить VPN\"]').click();return true")
        wait_for("return !!document.querySelector('[aria-label=\"Отключить VPN\"]')")
        pids=[]
        for proc in pathlib.Path('/proc').iterdir():
            if not proc.name.isdigit(): continue
            try:
                if os.readlink(proc/'exe')!=str(app): continue
                args=(proc/'cmdline').read_bytes().split(b'\0')
                if b'--oblique-watchdog' in args: continue
                process_env=(proc/'environ').read_bytes().split(b'\0')
                if ('XDG_CONFIG_HOME='+env['XDG_CONFIG_HOME']).encode() in process_env: pids.append(int(proc.name))
            except (FileNotFoundError,PermissionError,ProcessLookupError): pass
        assert len(pids)==1,'Must identify exactly the isolated test application'
        os.kill(pids[0],9)
        for _ in range(100):
            if proxy_mode()==before: break
            time.sleep(.1)
        assert proxy_mode()==before,'Crash watchdog did not restore desktop proxy'
        print('PASS actual application SIGKILL → independent watchdog → desktop proxy restored',flush=True)
    finally:
        if sid:
            try: call('DELETE',f'/session/{sid}')
            except Exception: pass
        for process in [driver,xvfb]:
            if process:
                process.terminate()
                try: process.wait(timeout=5)
                except subprocess.TimeoutExpired: process.kill();process.wait()

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--child': child(pathlib.Path(sys.argv[2]))
    else:
        if len(sys.argv)!=2: raise SystemExit('Usage: python3 tests/native-ui.py /path/to/private/profiles.txt')
        with tempfile.TemporaryDirectory(prefix='oblique-native-') as tmp:
            private=pathlib.Path(tmp)
            env=os.environ.copy()
            for key,folder in [('XDG_CONFIG_HOME','config'),('XDG_DATA_HOME','data'),('XDG_CACHE_HOME','cache')]:
                path=private/folder;path.mkdir();env[key]=str(path)
            env['XDG_CURRENT_DESKTOP']='GNOME'
            env['OBLIQUE_CORE']=str(ROOT/'src-tauri/resources/oblique-core')
            subprocess.run(['node','--import','tsx','tests/write-private-fixture.ts',sys.argv[1],str(private/'fixture')],cwd=ROOT,env=env,check=True)
            subprocess.run(['dbus-run-session','--',sys.executable,__file__,'--child',tmp],cwd=ROOT,env=env,check=True)
