#!/bin/bash
shopt -s extglob
shopt -s globstar

cd `dirname "$(realpath $0)"`
rm -rf *.go
rm -rf */*.go
rm -rf main_sing
rm -rf libcore_service-remote

THRIFT_COMPILER="${THRIFT_COMPILER:-thrift}"

"${THRIFT_COMPILER}" --gen go -out .. libcore.thrift


mkdir main_sing
cp ../sing-box/cmd/sing-box/cmd*.go main_sing
#!(*_stub.go) main_sing

for i in $(ls main_sing)
do
sed -i 's/package main/package main_sing/g;' main_sing/$i
done

cat << 'EOF' > main_sing/main_sing.go
package main_sing

import (
        "github.com/sagernet/sing-box/log"
)

func MainFunc() {
        if err := mainCommand.Execute(); err != nil {
                log.Fatal(err)
        }
}
EOF

# Oblique's console-less shutdown hook; preserve it when regenerating upstream CLI files.
cp oblique-stop.go.in main_sing/oblique_stop.go
python3 - <<'PY'
from pathlib import Path
p=Path('main_sing/cmd_run.go')
s=p.read_text().replace('func run() error {\n','func run() error {\n\tobliqueStop := obliqueStopSignal()\n',1)
s=s.replace('\t\t\tosSignal := <-osSignals','\t\t\tvar osSignal os.Signal\n\t\t\tselect {\n\t\t\tcase osSignal = <-osSignals:\n\t\t\tcase <-obliqueStop:\n\t\t\t\tosSignal = syscall.SIGTERM\n\t\t\t}')
p.write_text(s)
PY
gofmt -w main_sing/oblique_stop.go main_sing/cmd_run.go
