#!/bin/sh
set -eu
# The core alone receives network capabilities; the webview stays unprivileged.
core=/usr/lib/Oblique/resources/oblique-core
if [ ! -f "$core" ]; then
  core=/usr/lib/oblique/resources/oblique-core
fi
if [ ! -f "$core" ]; then
  core=/usr/lib/app.oblique.desktop/resources/oblique-core
fi
if [ ! -f "$core" ]; then
  echo 'Oblique core missing from package' >&2
  exit 1
fi
chmod 755 "$core"
setcap cap_net_admin,cap_net_raw,cap_net_bind_service+ep "$core"
