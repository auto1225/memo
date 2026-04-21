// JustANotepad Desktop — Tauri 2
// 웹 앱을 네이티브 윈도우로 감싸고, 시스템 트레이 + 포스트잇 상주 기능 제공
//
// v1.0.21: 데스크톱 포스트잇 본격 구현
// v1.0.23: OS 자동시작 — 재부팅하면 앱을 실행하지 않아도 포스트잇이 그대로
//   - tauri-plugin-autostart 로 Windows/macOS/Linux 에 로그인 시 자동 실행 등록
//   - 포스트잇이 1개 이상 있으면 자동시작 자동 활성화 (사용자 별도 클릭 불필요)
//   - --autostart 인자로 실행되면 메인 창은 숨긴 채 트레이로만 기동, 포스트잇만 표시
//   - 자동시작 토글 command (postit_autostart_get / postit_autostart_set) 노출

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
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

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
// 메인 창의 커스텀 X 버튼이 호출. 포스트잇이 살아있으면 메인 창만 숨기고
// 프로세스 유지 (그래야 포스트잇이 같이 죽지 않음). 포스트잇 없으면 종전대로 종료.
// 진짜 완전 종료는 트레이 메뉴 "종료"로만.
#[tauri::command]
fn force_quit(app: tauri::AppHandle) {
    let has_postit = app.webview_windows().iter()
        .any(|(label, _)| label.starts_with("postit-"));
    if has_postit {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.hide();
        }
        return;
    }
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
    // 포스트잇이 첫 개 생기면 자동시작 자동 활성화 (사용자 재부팅 후 그대로 보이게)
    let mgr = app.autolaunch();
    if mgr.is_enabled().unwrap_or(false) == false {
        let _ = mgr.enable();
    }
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

// z-order 토글: "top" | "normal" | "bottom" (Windows/macOS 지원, Linux는 부분적)
#[tauri::command]
fn postit_set_z_order(app: tauri::AppHandle, id: String, state: String) {
    if let Some(w) = app.get_webview_window(&id) {
        match state.as_str() {
            "top" => {
                let _ = w.set_always_on_bottom(false);
                let _ = w.set_always_on_top(true);
            }
            "bottom" => {
                let _ = w.set_always_on_top(false);
                let _ = w.set_always_on_bottom(true);
            }
            _ => {
                let _ = w.set_always_on_top(false);
                let _ = w.set_always_on_bottom(false);
            }
        }
    }
}

// ────────── 자동시작 (OS 로그인 시 백그라운드 실행) ──────────
#[tauri::command]
fn autostart_get(app: tauri::AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn autostart_set(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    let mgr = app.autolaunch();
    let res = if enabled { mgr.enable() } else { mgr.disable() };
    res.map_err(|e| e.to_string())?;
    Ok(mgr.is_enabled().unwrap_or(false))
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
        // 자동시작: 사용자가 로그인하면 백그라운드에서 JustANotepad 실행 →
        // 포스트잇이 저절로 복원됨. --autostart 플래그로 실행되는 것도 감지 가능.
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .setup(|app| {
            // 포스트잇 저장소 초기화 + state 로 등록
            let store = PostitStore::new(app.handle());
            app.manage(store);

            // 자동시작으로 실행된 경우 감지 → 메인 창 숨김 (포스트잇만 떠있게)
            let started_by_autostart = std::env::args().any(|a| a == "--autostart");
            if started_by_autostart {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.hide();
                }
            }

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

            // Listen for a Tauri event-bus exit request. 포스트잇이 있으면
            // 메인 창만 숨기고 프로세스는 유지 (포스트잇 보호).
            let quit_handle = app.handle().clone();
            app.listen_any("jnp://force-quit", move |_event| {
                let has_postit = quit_handle.webview_windows().iter()
                    .any(|(label, _)| label.starts_with("postit-"));
                if has_postit {
                    if let Some(w) = quit_handle.get_webview_window("main") {
                        let _ = w.hide();
                    }
                    return;
                }
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
                        // 데브툴즈/고아 창만 닫음. 포스트잇은 보존 (사용자가 의도해서 연 것).
                        // 포스트잇 창은 label 이 "postit-*" 형태. 이것만 빼고 닫음.
                        let handle = app.app_handle().clone();
                        for (label, window) in handle.webview_windows() {
                            if label != "main" && !label.starts_with("postit-") {
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
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let handle = window.app_handle().clone();
                    // 포스트잇이 하나라도 살아있으면 → 프로세스는 유지, 메인 창만 숨김.
                    // 사용자는 시스템 트레이에서 "종료"로만 완전 종료 가능.
                    let has_postit = handle.webview_windows().iter()
                        .any(|(label, _)| label.starts_with("postit-"));
                    if has_postit {
                        api.prevent_close();
                        let _ = window.hide();
                        return;
                    }
                    // 포스트잇 없으면 종전과 동일하게 프로세스 완전 종료
                    for (_, w) in handle.webview_windows() {
                        let _ = w.destroy();
                    }
                    std::thread::spawn(|| {
                        std::thread::sleep(std::time::Duration::from_millis(200));
                        std::process::abort();
                    });
                    std::process::exit(0);
                }
                // 포스트잇 창을 X 버튼으로 닫는 경우 → 창은 사라지지만 postits.json 에는 남음.
                // 사용자가 트레이에서 "JustANotepad 열기" 하면 다음 부팅 시 복원됨.
                // "삭제"는 포스트잇 UI의 ✕ 버튼(postit_close)으로만 가능.
            }
        })
        .invoke_handler(tauri::generate_handler![
            force_quit,
            postit_list, postit_spawn, postit_update, postit_close, postit_set_z_order,
            autostart_get, autostart_set
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
