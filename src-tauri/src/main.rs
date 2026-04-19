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
        // Prevent a second instance from spawning ghost windows when the
        // updater relaunches or a shortcut is double-clicked. Second launch
        // just focuses the existing main window.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
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
            let close_extras =
                MenuItem::with_id(app, "close_extras", "보조 창 모두 닫기", true, None::<&str>)?;
            let sep1 = MenuItem::with_id(app, "sep1", "---", false, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_main, &new_postit, &close_extras, &sep1, &quit])?;

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
                    "close_extras" => {
                        // Close every window that isn't the main one — wipes
                        // out orphaned postits, leftover devtools, any ghost.
                        let handle = app.app_handle().clone();
                        for (label, window) in handle.webview_windows() {
                            if label != "main" {
                                let _ = window.close();
                            }
                        }
                    }
                    "quit" => {
                        std::process::exit(0);
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
            // X 누르면 프로세스 강제 즉시 종료.
            //
            // v1.0.10의 std::process::exit(0) 단독으로도 안 죽는 케이스가
            // 관찰됨: Tauri의 이벤트 루프가 종료 신호를 삼키거나, WebView2가
            // 추가 HWND를 들고 있어서 메인 창만 사라지고 흰 잔상 창이
            // 남는 상태.
            //
            // v1.0.11 접근:
            //   1) 현재 앱이 소유한 모든 webview window를 명시적으로 destroy
            //   2) std::process::exit(0) 즉시 호출
            //   3) 200ms 뒤에도 프로세스가 살아있으면 abort()로 강제 종료
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    let handle = window.app_handle().clone();
                    for (_, w) in handle.webview_windows() {
                        let _ = w.destroy();
                    }
                    // Safety net: if exit(0) gets stuck, abort after 200ms.
                    std::thread::spawn(|| {
                        std::thread::sleep(std::time::Duration::from_millis(200));
                        std::process::abort();
                    });
                    std::process::exit(0);
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
    .title("JustANotepad 포스트잇")
    .inner_size(320.0, 400.0)
    .resizable(true)
    .always_on_top(true)
    .decorations(false)
    .skip_taskbar(false)  // 작업표시줄에서도 닫을 수 있게
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
