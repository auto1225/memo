// JustANotepad Desktop — Tauri 2
// 웹 앱을 네이티브 윈도우로 감싸고, 시스템 트레이 + 포스트잇 상주 기능 제공

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Force frameless from the native side too — redundant with the
            // static `decorations: false` config, but bullet-proof against
            // any caching / Windows-specific fallback.
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_decorations(false);
                let _ = win.set_shadow(true);
                // Devtools stay available via F12 (the `devtools` Cargo feature
                // is still on), but we no longer open them automatically —
                // otherwise a separate DevTools window lingers after the user
                // clicks the X to close the main window.
            }
            // 시스템 트레이 메뉴
            let open_main = MenuItem::with_id(app, "open_main", "JustANotepad 열기", true, None::<&str>)?;
            let new_postit =
                MenuItem::with_id(app, "new_postit", "새 포스트잇", true, None::<&str>)?;
            let sep1 = MenuItem::with_id(app, "sep1", "---", false, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_main, &new_postit, &sep1, &quit])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .tooltip("JustANotepad")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open_main" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    }
                    "new_postit" => {
                        spawn_postit(app.app_handle());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 메인 창 닫기 시 트레이로 숨김
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running JustANotepad");
}

fn spawn_postit(app: &tauri::AppHandle) {
    let label = format!("postit-{}", chrono_ts());
    let window = WebviewWindowBuilder::new(
        app,
        &label,
        WebviewUrl::External("https://justanotepad.com/app?mode=postit".parse().unwrap()),
    )
    .title("포스트잇")
    .inner_size(320.0, 400.0)
    .resizable(true)
    .always_on_top(true)
    .decorations(false)
    .skip_taskbar(true)
    .build();
    if let Err(e) = window {
        eprintln!("포스트잇 생성 실패: {}", e);
    }
}

fn chrono_ts() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
