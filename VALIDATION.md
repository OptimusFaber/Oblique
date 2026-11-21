# Проверка Oblique 2.1.0

## Локальная сборка на Ubuntu 22.04, 21 ноября 2026

| Проверка | Результат |
| --- | --- |
| `npm ci`, `npm run lint`, `npm test`, `npm run build` | PASS: 12/12 unit; lint без ошибок, одно предупреждение |
| `npm run test:core` | PASS: 10 сетевых сценариев с временными серверами |
| `cargo check --locked` | PASS: одно предупреждение о неиспользуемых методах |
| Tauri release build | PASS: `src-tauri/target/release/oblique` |
| DEB и AppImage | PASS: оба пакета созданы, ядро и лицензии включены |
| DEB postinst | PASS (инспекция): путь `/usr/lib/Oblique/resources/oblique-core` совпадает с пакетом; скрипт задаёт `cap_net_admin,cap_net_raw,cap_net_bind_service+ep` |
| Native GUI smoke test | PASS (запуск): бинарник и AppImage работали 8 секунд без аварийного завершения с очищенным от snap GTK окружением; затем остановлены `timeout` |
| Native UI→IPC→VPN, proxy restore, crash watchdog, live failover | NOT RUN: нужны рабочие профили и изолированный desktop test; smoke test их не проверяет |
| Установка DEB и фактические capabilities | NOT RUN: пакет проверен распаковкой, но не установлен |
| Windows GUI/NSIS | NOT RUN: на текущей машине только Linux; готовое Windows Go-ядро не является приложением |

Полный вывод текущего запуска в `build-logs/`. SHA256 пакетов в `build-logs/SHA256SUMS`.

При запуске из snap-терминала VS Code его GTK/GSettings переменные вызвали ошибку загрузки системной схемы. После очистки этих переменных оба desktop smoke test прошли. У AppImage остался warning о snap input method, но процесс продолжал работать до таймаута.

Проверяется 21 ноября 2026 года. Этот файл обновляется по фактическим результатам, а не по наличию интерфейса.

| Проверка | Результат |
| --- | --- |
| Unit-тесты импорта, конфигурации, IPv6 и failover | 12/12 прошли |
| React UI: импорт, сохранение, темы, отказ без desktop, fallback и отказ readiness | 5/5 прошли |
| Production-сборка TypeScript/Vite | Прошла |
| ESLint | Прошёл |
| Полный npm audit | 0 известных уязвимостей; повторный аудит после обновления API/CLI Tauri также прошёл |
| Ядро Linux x64 | Собрано статически, CGO=0, тот же закреплённый форк sing-box |
| VLESS TLS/TCP, TLS/WS, TLS/gRPC; VMess, Trojan, SS, SOCKS5, HTTP(S) | Реальные запросы через временные серверы прошли, штатный stop-file даёт exit code 0 |
| Статистика ядра и защита API | Реальные счётчики растут; без секрета API возвращает 401 |
| Неверный UUID / остановка сервера | Запросы не проходят, работающий процесс не считается рабочим VPN |
| Три локальных профиля Irina: TLS/TCP, WS, Reality | 3/3 конфигурации приняты ядром, 3/3 HTTPS-запроса вернули HTTP 204 |
| TUN IPv4 / IPv6 / DNS / strict routing | Реальные запросы в двух изолированных network namespaces прошли |
| Выключенный IPv6 | Явный IPv6-трафик блокируется, IPv4 продолжает идти через VPN |
| TUN от обычного пользователя | Прошёл с cap_net_admin, cap_net_raw, cap_net_bind_service |
| Штатная остановка ядра без консоли | Stop-файл закрывает ядро с кодом 0; интерфейс и правила IPv4/IPv6 удаляются |
| Linux desktop-окно, IPC, восстановление прокси и crash watchdog | Запуск desktop без аварии проверен; IPC, VPN, proxy restore и crash watchdog НЕ ПРОВЕРЕНЫ |
| Windows x64 | Go-ядро x64 собрано; GUI/установщик НЕ собраны, живой Windows-сеанс отсутствовал |
| Установщики | Linux DEB и AppImage собраны; Windows NSIS НЕ СОБРАН |

Сетевые тесты не меняют настройки VPN-сервера. TUN-тесты запускаются в отдельных namespaces и не меняют маршруты хоста. Проверки прокси desktop будут выполняться в отдельном D-Bus/dconf-профиле. Личные UUID, пароли и ссылки не включаются в отчёт и артефакты.

Сценарии: `tests/profiles.test.ts`, `tests/ui/client.spec.ts`, `tests/core-integration.ts`, `tests/check-live-profiles.ts`, `tests/tun-namespace.py`, `tests/native-ui.py`. Дополнительный native harness: `src-tauri/src/engine_test.rs` (feature `integration-tests`).
