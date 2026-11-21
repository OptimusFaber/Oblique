fn main() {
    const COMMANDS: &[&str] = &["core_start", "core_stop", "core_hint", "set_window_mode", "core_status", "core_logs", "core_delay", "core_select", "core_probe", "tcp_ping_ms", "detect_country", "fetch_subscription"];
    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS))
        .windows_attributes(tauri_build::WindowsAttributes::new().app_manifest(include_str!("windows.manifest")));
    tauri_build::try_build(attributes).expect("Tauri build failed");
}
