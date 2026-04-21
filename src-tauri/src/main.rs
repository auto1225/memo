// JustANotepad Desktop — Tauri 2
// 웹 앱을 네이티브 윈도우로 감싸고, 시스템 트레이 + 포스트잇 상주 기능 제공
//
// v1.0.21: 데스크톱 포스트잇 본격 구현
//   - 웹에서 invoke('postit_spawn', { ... })로 새 포스트잇 OS 창 생성
//   - 포스트잇 위치/크기/색상/내용을 앱 데이터 폴더의 postits.json 에 저장
//   - 앱 시작 시 저장된 모든 포스트잇 자동 복원 (재부팅 후에도 그대로)
//   - 포스트잇 창 이동/리사이즈 시 자동 저장

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Listener, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
};

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Postit {
    id: String,
    x: i32,
    y: i32,
    w: u32,
    h: u32,
    color: String,
    content: String,
    #[serde(default)]
    updated_at: u64,
}

struct PostitStore {
    items: Mutex<Vec<Postit>>,
    path: PathBuf,
}
impl PostitStore {
    fn new(app: &tauri::AppHandle) -> Self {
        let dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("postits.json");
        let items = fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str::<Vec<Postit>>(&s).ok())
            .unwrap_or_default();
        Self { items: Mutex::new(items), path }
    }
    fn save(&self) {
        if let Ok(items) = self.items.lock() {
            if let Ok(json) = serde_json::to_string_pretty(&*items) {
                let _ = fs::write(&self.path, json);
            }
        }
    }
    fn upsert(&self, p: Postit) {
        if let Ok(mut v) = self.items.lock() {
            if let Some(i) = v.iter().position(|x| x.id == p.id) { v[i] = p; }
            else { v.push(p); }
        }
        self.save();
    }
    fn remove(&self, id: &str) {
        if let Ok(mut v) = self.items.lock() {
            v.retain(|x| x.id != id);
        }
        self.save();
    }
    fn list(&self) -> Vec<Postit> {
        self.items.lock().map(|v| v.clone()).unwrap_or_default()
    }
}

// Frontend → Rust command. JS calls:
//     window.__TAURI__.core.invoke('force_quit')
// which lands here and immediately terminates the process. Bypasses
// every Tauri event loop / tray / close-request machinery.
#[tauri::command]
fn force_quit() {
    std::process::exit(0);
}

// ────────── 포스트잇 명령 ──────────
#[tauri::command]
fn postit_list(store: tauri::State<PostitStore>) -> Vec<Postit> {
    store.list()
}

#[tauri::command]
fn postit_spawn(
    app: tauri::AppHandle,
    store: tauri::State<PostitStore>,
    id: Option<String>,
    x: Option<i32>,
    y: Option<i32>,
    w: Option<u32>,
    h: Option<u32>,
    color: Option<String>,
    content: Option<String>,
) -> Result<String, String> {
    let id = id.unwrap_or_else(|| format!("postit-{}", chrono_ts()));
    let p = Postit {
        id: id.clone(),
        x: x.unwrap_or(120),
        y: y.unwrap_or(120),
        w: w.unwrap_or(280),
        h: h.unwrap_or(240),
        color: color.unwrap_or_else(|| "yellow".into()),
        content: content.unwrap_or_default(),
        updated_at: chrono_ts(),
    };
    store.upsert(p.clone());
    spawn_postit_window(&app, &p);
    Ok(id)
}

#[tauri::command]
fn postit_update(
    store: tauri::State<PostitStore>,
    id: String,
    x: Option<i32>,
    y: Option<i32>,
    w: Option<u32>,
    h: Option<u32>,
    color: Option<String>,
    content: Option<String>,
) {
    let mut items = store.items.lock().unwrap();
    if let Some(p) = items.iter_mut().find(|p| p.id == id) {
        if let Some(v) = x { p.x = v; }
        if let Some(v) = y { p.y = v; }
        if let Some(v) = w { p.w = v; }
        if let Some(v) = h { p.h = v; }
        if let Some(v) = color { p.color = v; }
        if let Some(v) = content { p.content = v; }
        p.updated_at = chrono_ts();
    }
    drop(items);
    store.save();
}

#[tauri::command]
fn postit_close(
    app: tauri::AppHandle,
    store: tauri::State<PostitStore>,
    id: String,
) {
    if let Some(w) = app.get_webview_window(&id) {
        let _ = w.close();
    }
    store.remove(&id);
}

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
            // 포스트잇 저장소 초기화 + state 로 등록
            let store = PostitStore::new(app.handle());
            app.manage(store);

            // Force frameless from the native side too — redundant with the
            // static `decorations: false` config, but bullet-proof against
            // any caching / Windows-specific fallback.
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_decorations(false);
                let _ = win.set_shadow(true);
            }

            // 저장된 포스트잇 모두 복원 (재부팅 후에도 그대로)
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                restore_all_postits(&handle);
            });

            // Listen for a Tauri event-bus exit request. Events go through
            // a different gate than commands, so this works even if the
            // force_quit command is blocked by ACL. Frontend calls:
            //     window.__TAURI__.event.emit('jnp://force-quit')
            app.listen_any("jnp://force-quit", |_event| {
                std::process::exit(0);
            });
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
                        let handle = app.app_handle().clone();
                        let store = handle.state::<PostitStore>();
                        let _ = postit_spawn(handle.clone(), store, None, None, None, None, None, None, None);
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
        .invoke_handler(tauri::generate_handler![
            force_quit,
            postit_list, postit_spawn, postit_update, postit_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running JustANotepad");
}

// 실제 포스트잇 창 생성 — Postit 데이터를 기반으로 크기·위치·색상 적용
fn spawn_postit_window(app: &tauri::AppHandle, p: &Postit) {
    // 중복 방지: 이미 그 id 의 창이 있으면 focus 만
    if let Some(w) = app.get_webview_window(&p.id) {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let url = format!(
        "https://justanotepad.com/app?mode=postit&id={}",
        urlencoding_encode(&p.id)
    );
    let builder = WebviewWindowBuilder::new(app, &p.id, WebviewUrl::External(url.parse().unwrap()))
        .title("포스트잇")
        .inner_size(p.w as f64, p.h as f64)
        .position(p.x as f64, p.y as f64)
        .resizable(true)
        .always_on_top(true)
        .decorations(false)
        .skip_taskbar(false);
    match builder.build() {
        Ok(w) => {
            // 창 이동/리사이즈 이벤트 → 저장소 업데이트
            let app_clone = app.clone();
            let id_clone = p.id.clone();
            w.on_window_event(move |evt| {
                match evt {
                    tauri::WindowEvent::Moved(PhysicalPosition { x, y }) => {
                        let store = app_clone.state::<PostitStore>();
                        let mut items = store.items.lock().unwrap();
                        if let Some(p) = items.iter_mut().find(|p| p.id == id_clone) {
                            p.x = *x; p.y = *y; p.updated_at = chrono_ts();
                        }
                        drop(items);
                        store.save();
                    }
                    tauri::WindowEvent::Resized(PhysicalSize { width, height }) => {
                        let store = app_clone.state::<PostitStore>();
                        let mut items = store.items.lock().unwrap();
                        if let Some(p) = items.iter_mut().find(|p| p.id == id_clone) {
                            p.w = *width; p.h = *height; p.updated_at = chrono_ts();
                        }
                        drop(items);
                        store.save();
                    }
                    tauri::WindowEvent::CloseRequested { .. } => {
                        // 창을 닫아도 postits.json 에는 남아있음 (재시작시 복원).
                        // 완전 삭제하려면 앱 안에서 "삭제" 버튼 (postit_close) 사용.
                    }
                    _ => {}
                }
            });
        }
        Err(e) => eprintln!("포스트잇 창 생성 실패: {}", e),
    }
}

// 저장된 모든 포스트잇을 앱 시작 시 자동 복원
fn restore_all_postits(app: &tauri::AppHandle) {
    let store = app.state::<PostitStore>();
    for p in store.list() {
        spawn_postit_window(app, &p);
    }
}

// 간단한 URL 인코더 (id 는 영숫자+'-' 뿐이지만 안전하게)
fn urlencoding_encode(s: &str) -> String {
    s.chars().map(|c| {
        if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c.to_string() }
        else { format!("%{:02X}", c as u32) }
    }).collect()
}

fn chrono_ts() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
