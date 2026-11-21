"""Run only under `unshare --mount --net`; never changes the host network."""
import os,sys,json,tempfile,pathlib,subprocess,time,socket,struct,threading,http.server,shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
CORE=ROOT/'src-tauri/resources/oblique-core'
UUID='00000000-0000-4000-8000-000000000001'

def run(*args,**kwargs):return subprocess.run(args,check=True,**kwargs)
def output(*args):return subprocess.check_output(args,text=True)

def remote_service():
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self): self.send_response(204);self.end_headers()
        def log_message(self,*args):pass
    servers=[http.server.HTTPServer(('203.0.113.10',18080),Handler)]
    class V6(http.server.HTTPServer):address_family=socket.AF_INET6
    servers.append(V6(('2001:db8:3::10',18080),Handler))
    for server in servers:threading.Thread(target=server.serve_forever,daemon=True).start()
    udp=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);udp.bind(('192.0.2.2',53))
    while True:
        data,addr=udp.recvfrom(2048)
        index=12
        while data[index]:index+=data[index]+1
        index+=1
        kind=struct.unpack('!H',data[index:index+2])[0]
        question=data[12:index+4]
        answer=b''
        if kind==1:answer=b'\xc0\x0c'+struct.pack('!HHIH',1,1,60,4)+socket.inet_aton('203.0.113.10')
        elif kind==28:answer=b'\xc0\x0c'+struct.pack('!HHIH',28,1,60,16)+socket.inet_pton(socket.AF_INET6,'2001:db8:3::10')
        response=data[:2]+struct.pack('!HHHHH',0x8180,1,1 if answer else 0,0,0)+question+answer
        udp.sendto(response,addr)

if len(sys.argv)>1 and sys.argv[1]=='--serve': remote_service();raise SystemExit
if output('readlink','/proc/self/ns/net').strip()==output('readlink','/proc/1/ns/net').strip():
    raise SystemExit('Refusing to run in the host network namespace; use unshare --mount --net')
run('mount','--make-rprivate','/')
# A private /dev supplies the TUN character device without changing host /dev.
run('mount','-t','tmpfs','tmpfs','/dev')
pathlib.Path('/dev/net').mkdir()
for name,major,minor in [('null',1,3),('zero',1,5),('random',1,8),('urandom',1,9),('net/tun',10,200)]:
    os.mknod('/dev/'+name,0o20666,os.makedev(major,minor));os.chmod('/dev/'+name,0o666)
remote=subprocess.Popen(['unshare','--net','--','sleep','600'])
children=[]
try:
    time.sleep(.2)
    ns=['nsenter','-t',str(remote.pid),'--net','--']
    run('ip','link','set','lo','up');run(*ns,'ip','link','set','lo','up')
    run('ip','link','add','client0','type','veth','peer','name','server0')
    run('ip','link','set','server0','netns',str(remote.pid))
    run('ip','addr','add','192.0.2.1/24','dev','client0');run('ip','addr','add','2001:db8:1::1/64','dev','client0')
    run('ip','link','set','client0','up')
    run(*ns,'ip','addr','add','192.0.2.2/24','dev','server0');run(*ns,'ip','addr','add','2001:db8:1::2/64','dev','server0')
    run(*ns,'ip','link','set','server0','up')
    run(*ns,'ip','addr','add','203.0.113.10/32','dev','lo');run(*ns,'ip','addr','add','2001:db8:3::10/128','dev','lo')
    run('ip','route','add','default','via','192.0.2.2');run('ip','-6','route','add','default','via','2001:db8:1::2')
    time.sleep(1)
    service=subprocess.Popen(ns+[sys.executable,__file__,'--serve']);children.append(service)
    before4=output('ip','rule','show');before6=output('ip','-6','rule','show')
    with tempfile.TemporaryDirectory(prefix='oblique-tun-',dir='/home') as tmp:
        temp=pathlib.Path(tmp)
        upstream={'log':{'level':'info'},'inbounds':[{'type':'vless','tag':'test-server','listen':'192.0.2.2','listen_port':18443,'users':[{'uuid':UUID}]}],'outbounds':[{'type':'direct','tag':'direct'}],'route':{'final':'direct'}}
        (temp/'server.json').write_text(json.dumps(upstream))
        log=open(temp/'server.log','w+')
        server=subprocess.Popen(ns+[str(CORE),'sing-box','run','-c',str(temp/'server.json')],stdout=log,stderr=log);children.append(server)
        client={'log':{'level':'info'},'dns':{'servers':[{'type':'udp','tag':'bootstrap','server':'192.0.2.2','server_port':53}],'final':'bootstrap'},
          'inbounds':[{'type':'tun','tag':'tun-in','interface_name':'oblique-test','address':['172.19.0.1/30','fdfe:dcba:9876::1/126'],'mtu':1500,'auto_route':True,'strict_route':True,'stack':'system'}],
          'outbounds':[{'type':'vless','tag':'proxy','server':'192.0.2.2','server_port':18443,'uuid':UUID},{'type':'direct','tag':'direct'}],
          'route':{'auto_detect_interface':True,'default_domain_resolver':{'server':'bootstrap'},'rules':[{'action':'sniff'},{'protocol':'dns','action':'hijack-dns'},{'port':53,'action':'hijack-dns'}],'final':'proxy'},
          'experimental':{'clash_api':{'external_controller':'127.0.0.1:17991','secret':'tun-test'}}}
        (temp/'client.json').write_text(json.dumps(client))
        run(str(CORE),'sing-box','check','-c',str(temp/'client.json'))
        clog=open(temp/'client.log','w+')
        vpn=subprocess.Popen([str(CORE),'sing-box','run','-c',str(temp/'client.json')],stdout=clog,stderr=clog);children.append(vpn)
        try:
            for _ in range(100):
                if vpn.poll() is not None: raise AssertionError((temp/'client.log').read_text()[-4000:])
                if 'oblique-test' in output('ip','link','show'):break
                time.sleep(.1)
            for family,url in [('-4','http://203.0.113.10:18080/'),('-6','http://[2001:db8:3::10]:18080/'),('-4','http://oblique.test:18080/')]:
                code=output('curl',family,'--noproxy','*','--silent','--show-error','--max-time','8','--output','/dev/null','--write-out','%{http_code}',url)
                assert code=='204',code
            log.flush();assert 'inbound/vless' in (temp/'server.log').read_text()
            print('PASS real TUN: IPv4, IPv6, DNS hijack, strict routing, actual VLESS transport',flush=True)
        finally:
            vpn.terminate()
            try:vpn.wait(timeout=8)
            except subprocess.TimeoutExpired:vpn.kill();vpn.wait()
        assert 'oblique-test' not in output('ip','link','show')
        assert output('ip','rule','show')==before4,'IPv4 policy rules were not restored'
        assert output('ip','-6','rule','show')==before6,'IPv6 policy rules were not restored'
        print('PASS TUN stop: interface removed; original IPv4 and IPv6 policy rules restored',flush=True)
        client['route']['rules'].insert(0,{'ip_version':6,'action':'reject'})
        (temp/'client.json').write_text(json.dumps(client))
        vpn=subprocess.Popen([str(CORE),'sing-box','run','-c',str(temp/'client.json')],stdout=clog,stderr=clog);children.append(vpn)
        try:
            for _ in range(100):
                if vpn.poll() is not None:raise AssertionError((temp/'client.log').read_text()[-4000:])
                if 'oblique-test' in output('ip','link','show'):break
                time.sleep(.1)
            time.sleep(.2)
            blocked=subprocess.run(['curl','-6','--noproxy','*','--silent','--max-time','3','--output','/dev/null','--write-out','%{http_code}','http://[2001:db8:3::10]:18080/'],capture_output=True,text=True)
            assert blocked.stdout!='204','IPv6 bypassed TUN while disabled'
            assert output('curl','-4','--noproxy','*','--silent','--max-time','4','--output','/dev/null','--write-out','%{http_code}','http://203.0.113.10:18080/')=='204'
            print('PASS disabled IPv6: literal IPv6 traffic is rejected; IPv4 continues through VPN',flush=True)
        finally:
            vpn.terminate()
            try:vpn.wait(timeout=8)
            except subprocess.TimeoutExpired:vpn.kill();vpn.wait()
        assert output('ip','rule','show')==before4
        assert output('ip','-6','rule','show')==before6

        # Match the DEB installation model: only the core has network capabilities.
        temp.chmod(0o755)
        nonroot_core=temp/'oblique-core'
        shutil.copy2(CORE,nonroot_core);nonroot_core.chmod(0o755)
        run('setcap','cap_net_admin,cap_net_raw,cap_net_bind_service+ep',str(nonroot_core))
        stop_file=temp/'shutdown.signal'
        vpn=subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups',str(nonroot_core),'sing-box','run','-c',str(temp/'client.json'),'--oblique-stop-file',str(stop_file)],stdout=clog,stderr=clog);children.append(vpn)
        try:
            for _ in range(100):
                if vpn.poll() is not None:raise AssertionError((temp/'client.log').read_text()[-4000:])
                if 'oblique-test' in output('ip','link','show'):break
                time.sleep(.1)
            time.sleep(.2)
            assert output('curl','-4','--noproxy','*','--silent','--max-time','4','--output','/dev/null','--write-out','%{http_code}','http://203.0.113.10:18080/')=='204'
            stop_file.write_text('stop')
            assert vpn.wait(timeout=6)==0,'Private shutdown signal did not close the core cleanly'
            print('PASS non-root core: network file capabilities, actual TUN traffic, console-less graceful shutdown',flush=True)
        finally:
            if vpn.poll() is None:vpn.terminate();vpn.wait(timeout=8)
        assert 'oblique-test' not in output('ip','link','show')
        assert output('ip','rule','show')==before4
        assert output('ip','-6','rule','show')==before6

finally:
    for child in children+[remote]:
        if child.poll() is None:
            child.terminate()
            try:child.wait(timeout=3)
            except subprocess.TimeoutExpired:child.kill();child.wait()
