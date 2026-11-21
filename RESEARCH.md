# Исследование совместимости и обновлений

Проверено 20–21 ноября 2026 года по исходникам обоих проектов и официальной документации.

## Архитектура

Исходный SilentGuard использует форк `qr243vbi/sing-box`, закреплённый на `89c21d48d74da9a08f3fc77847be68234e4cf143`, и Go-обёртку с Thrift API. Обёртка также имеет CLI `sing-box run/check`, который уже вызывал интерфейс v2. Поэтому отдельный переход на Xray или другой движок для этого переноса не нужен.

Oblique включает исходники обёртки и ту же ревизию движка. Для desktop-управления используются проверка CLI, lifecycle процесса и локальный Clash API с одноразовым секретом. Controller слушает только loopback; секрет не передаётся в WebView. Это позволяет получать настоящие соединения, счётчики и delay-тесты без ручной реализации Thrift-протокола в Rust.

Документация API: https://sing-box.sagernet.org/configuration/experimental/clash-api/

## Конфигурация sing-box

В v2 были утрачены учётные данные ссылок и настройки транспорта. Исправлены импорт, хранение, редактор и генератор для TLS, Reality, WS и gRPC. Удалён legacy `block` outbound; блокировки выражаются `action: reject`, DNS использует типизированные серверы, перенаправление DNS — `hijack-dns`, а разрешение адресов серверов — bootstrap resolver.

Основание: https://sing-box.sagernet.org/migration/ и https://sing-box.sagernet.org/configuration/outbound/vless/

Переход с форка на новую major/minor ветку upstream не выполняется автоматически: это самостоятельная миграция конфигураций и поведения TUN, которую нужно проверять на Windows и Linux. Текущая совместимость проверена реальными HTTPS-запросами для всех трёх локальных профилей Irina и локальными TLS/TCP, WS и gRPC серверами. Наличие новых upstream-версий не является доказательством их совместимости с существующим форком.

## Tauri

Исходный Tauri 2.10.3 затронут двумя опубликованными IPC advisories. Минимум установлен 2.11.6, lockfile разрешил актуальную совместимую 2.12.7. Добавлены CSP, явный список desktop-команд, single-instance и отдельный crash watchdog. Удалён dev HTTP-probe, не проверявший VPN-маршрут.

- Исправление local-origin confusion начиная с 2.11.1: https://github.com/tauri-apps/tauri/security/advisories/GHSA-7gmj-67g7-phm9
- Исправление channel fetch ACL начиная с 2.11.6: https://github.com/tauri-apps/tauri/security/advisories/GHSA-w28w-mhc8-qvjv
- Модель разрешений: https://v2.tauri.app/security/capabilities/
- Упаковка бинарников: https://v2.tauri.app/develop/sidecar/

## Frontend

Vite 5 заменён поддерживаемой веткой Vite 8, обновлён React-плагин. TypeScript закреплён в совместимой ветке 5.9, чтобы не нарушить совместимость ESLint. Node 22 выбран как поддерживаемая среда. `npm audit fix` применил совместимые исправления; после него полный npm audit сообщает 0 известных уязвимостей.

Основание: https://vite.dev/blog/announcing-vite8.html и https://vite.dev/releases

## Что проверять при следующем обновлении ядра

Следует отдельно проверить новый поддерживаемый Go toolchain и обновления зависимостей движка, включая gVisor. Простая замена версии компилятора может ломать runtime-связи этих библиотек. Сохранён компилятор, требуемый исходной сборкой, а не заявлена проверка отсутствия всех уязвимостей Go/Rust-цепочки.

История исправлений Go: https://go.dev/doc/devel/release

Обязательные регрессии: TLS/SNI/Host на CDN, gRPC serviceName, WS path, Reality, импорт/обновление подписок, DNS, TUN IPv4/IPv6, восстановление прокси и переключение серверов. Alpha-версии sing-box для готового клиентского релиза не предлагаются.
