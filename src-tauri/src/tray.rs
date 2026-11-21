use tauri::{image::Image, menu::MenuBuilder, tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent}, AppHandle, Manager};

const ID: &str = "oblique-status";

#[allow(dead_code)]
pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text("show", "Открыть Oblique")
        .text("quit", "Выход")
        .build()?;
    TrayIconBuilder::with_id(ID)
        .icon(Image::from_bytes(include_bytes!("../icons/tray-idle.png"))?)
        .tooltip("Oblique · VPN отключён")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn show(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[allow(dead_code)]
pub fn set_connected(app: &AppHandle, connected: bool) {
    if let Some(tray) = app.tray_by_id(ID) {
        let bytes: &[u8] = if connected { include_bytes!("../icons/tray-connected.png") } else { include_bytes!("../icons/tray-idle.png") };
        if let Ok(icon) = Image::from_bytes(bytes) { let _ = tray.set_icon(Some(icon)); }
        let _ = tray.set_tooltip(Some(if connected { "Oblique · VPN подключён" } else { "Oblique · VPN отключён" }));
    }
}
