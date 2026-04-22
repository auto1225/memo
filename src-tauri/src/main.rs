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
    Listener, Manager, PhysicalPosition, PhysicalSize,
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
    // v1.0.32+: 다른 포스트잇 서브프로세스가 동시에 postits.json 을 수정할 수
    // 있으므로, 쓰기 전에 디스크에서 최신 상태를 읽어와 병합.
    fn refresh_from_disk(&self) {
        if let Ok(text) = fs::read_to_string(&self.path) {
            if let Ok(fresh) = serde_json::from_str::<Vec<Postit>>(&text) {
                if let Ok(mut v) = self.items.lock() { *v = fresh; }
            }
        }
    }
    fn upsert(&self, p: Postit) {
        self.refresh_from_disk();
        if let Ok(mut v) = self.items.lock() {
            if let Some(i) = v.iter().position(|x| x.id == p.id) { v[i] = p; }
            else { v.push(p); }
        }
        self.save();
    }
    fn remove(&self, id: &str) {
        self.refresh_from_disk();
        if let Ok(mut v) = self.items.lock() {
            v.retain(|x| x.id != id);
        }
        self.save();
    }
    fn list(&self) -> Vec<Postit> {
        self.refresh_from_disk();
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
    // 메인 창은 항상 hide. 완전 종료는 트레이 "종료" 메뉴에서만 가능.
    // (커스텀 X 버튼이 이 커맨드를 호출해도 포스트잇·프로세스 모두 유지)
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
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

// NOTE — v1.0.31+ 서브프로세스 아키텍처 전환 이후로, postit 윈도우는 별도 OS
// 프로세스이므로 메인 프로세스에서 get_webview_window(id) 로 접근 불가능함.
// 이전에 있던 postit_update / postit_close / postit_set_z_order 커맨드는 제거.
// 해당 기능은 postit 자기 자신이 처리하는 postit_self_update / postit_self_close
// (아래 `run_postit_mode()` 내부) 에서 담당.

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
    // v1.0.31: --postit <id> 인자 감지 → 포스트잇 전용 모드로 분기.
    // 각 포스트잇이 독립 프로세스라 Tauri 멀티-webview 버그 영향 받지 않음.
    let args: Vec<String> = std::env::args().collect();
    if let Some(idx) = args.iter().position(|a| a == "--postit") {
        let id = args.get(idx + 1).cloned().unwrap_or_default();
        if !id.is_empty() {
            // 위치/크기/색상 CLI 인자 파싱 (선택)
            let get_int = |k: &str| -> Option<i32> {
                args.iter().position(|a| a == k)
                    .and_then(|i| args.get(i + 1))
                    .and_then(|v| v.parse().ok())
            };
            let get_uint = |k: &str| -> Option<u32> {
                args.iter().position(|a| a == k)
                    .and_then(|i| args.get(i + 1))
                    .and_then(|v| v.parse().ok())
            };
            let get_str = |k: &str| -> Option<String> {
                args.iter().position(|a| a == k)
                    .and_then(|i| args.get(i + 1))
                    .map(|s| s.clone())
            };
            run_postit_mode(
                id,
                get_int("--px"),
                get_int("--py"),
                get_uint("--pw"),
                get_uint("--ph"),
                get_str("--color"),
            );
            return;
        }
    }

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

            // 이벤트 버스 경로도 동일: 메인은 무조건 hide, 완전 종료는 트레이에서만.
            let quit_handle = app.handle().clone();
            app.listen_any("jnp://force-quit", move |_event| {
                if let Some(w) = quit_handle.get_webview_window("main") {
                    let _ = w.hide();
                }
            });
            // 시스템 트레이 메뉴
            let open_main = MenuItem::with_id(app, "open_main", "JustANotepad 열기", true, None::<&str>)?;
            let new_postit =
                MenuItem::with_id(app, "new_postit", "새 JustPin", true, None::<&str>)?;
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
                    // 메인 창은 항상 hide 로 처리. 완전 종료는 트레이 "종료" 메뉴만.
                    // (포스트잇 생존 보장 + 트레이 앱 표준 동작)
                    api.prevent_close();
                    let _ = window.hide();
                    return;
                }
                // 포스트잇 창을 X 버튼으로 닫으면: 창은 사라지지만 postits.json 에는 남음.
                // 앱 재시작 시 자동 복원. 완전 삭제는 포스트잇 UI의 X 버튼(postit_close).
            }
        })
        .invoke_handler(tauri::generate_handler![
            force_quit,
            postit_list, postit_spawn,
            autostart_get, autostart_set
        ])
        .run(tauri::generate_context!())
        .expect("error while running JustANotepad");
}

// 실제 포스트잇 창 생성 — Postit 데이터를 기반으로 별도 프로세스를 spawn
fn spawn_postit_window(_app: &tauri::AppHandle, p: &Postit) {
    // v1.0.31+: 포스트잇을 별도 프로세스로 실행 (Tauri v2 멀티-webview 버그 우회).
    // 같은 justanotepad.exe 를 --postit <id> 인자로 spawn → 해당 프로세스는
    // postit-mode 로 부팅해 자기 main window 를 postit 으로 사용.
    // 각 포스트잇 = 독립된 WebView2 인스턴스 = 버그 영향 없음.
    use std::process::Command;
    let exe_path = match std::env::current_exe() {
        Ok(p) => p,
        Err(e) => { eprintln!("[postit] current_exe failed: {}", e); return; }
    };
    let result = Command::new(&exe_path)
        .args([
            "--postit", &p.id,
            "--px", &p.x.to_string(),
            "--py", &p.y.to_string(),
            "--pw", &p.w.to_string(),
            "--ph", &p.h.to_string(),
            "--color", &p.color,
        ])
        .spawn();
    if let Err(e) = result {
        eprintln!("[postit] spawn subprocess failed: {}", e);
    }
}

// ────────── 포스트잇 서브프로세스의 공유 파일 조작 ──────────
// 여러 포스트잇 프로세스가 동시에 postits.json 을 수정할 수 있으므로
// 각 프로세스는 "자기 id 항목만" read-modify-write 하게 구현 (동시성 안전).

fn postits_json_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let _ = fs::create_dir_all(&dir);
    dir.join("postits.json")
}

fn read_postits(path: &std::path::Path) -> Vec<Postit> {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<Postit>>(&s).ok())
        .unwrap_or_default()
}

fn write_postits(path: &std::path::Path, items: &[Postit]) {
    if let Ok(json) = serde_json::to_string_pretty(items) {
        let _ = fs::write(path, json);
    }
}

// 포스트잇 서브프로세스 전용: 자기 id 의 필드만 업데이트
#[tauri::command]
fn postit_self_update(
    app: tauri::AppHandle,
    id: String,
    x: Option<i32>,
    y: Option<i32>,
    w: Option<u32>,
    h: Option<u32>,
    color: Option<String>,
    content: Option<String>,
) {
    let path = postits_json_path(&app);
    let mut items = read_postits(&path);
    if let Some(p) = items.iter_mut().find(|p| p.id == id) {
        if let Some(v) = x { p.x = v; }
        if let Some(v) = y { p.y = v; }
        if let Some(v) = w { p.w = v; }
        if let Some(v) = h { p.h = v; }
        if let Some(v) = color { p.color = v; }
        if let Some(v) = content { p.content = v; }
        p.updated_at = chrono_ts();
    }
    write_postits(&path, &items);
}

// 포스트잇 서브프로세스 전용: 자기 id 를 파일에서 제거 + 프로세스 종료
#[tauri::command]
fn postit_self_close(app: tauri::AppHandle, id: String) {
    let path = postits_json_path(&app);
    let mut items = read_postits(&path);
    items.retain(|p| p.id != id);
    write_postits(&path, &items);
    // 창 닫기 후 프로세스 종료
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.close();
    }
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_millis(200));
        std::process::exit(0);
    });
}

// 포스트잇 서브프로세스 전용: 전체 목록 반환 (postit.html 초기화시 color/content 조회용)
#[tauri::command]
fn postit_self_list(app: tauri::AppHandle) -> Vec<Postit> {
    let path = postits_json_path(&app);
    read_postits(&path)
}

// Postit-mode entrypoint — exe 가 --postit <id> 인자로 실행될 때 이 경로로 진입.
// 핵심: main window (tauri.conf.json 에 정의된 것)를 그대로 postit URL로 navigate.
// main window 는 앱 시작 시 첫 webview 로 생성되므로 Tauri 멀티-webview 버그의 영향을 받지 않음.
fn run_postit_mode(
    id: String,
    x: Option<i32>,
    y: Option<i32>,
    w: Option<u32>,
    h: Option<u32>,
    color: Option<String>,
) {
    let postit_x = x.unwrap_or(120);
    let postit_y = y.unwrap_or(120);
    let postit_w = w.unwrap_or(280);
    let postit_h = h.unwrap_or(240);
    let postit_color = color.unwrap_or_else(|| "yellow".into());

    // 화면 clamp: 저장된 좌표가 현재 모니터를 벗어나면 안쪽으로 밀어냄
    let id_for_setup = id.clone();
    let color_for_setup = postit_color.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            // postit.html 이 호출하는 3 가지 커맨드 — 아래 self 버전으로 연결.
            // (메인 프로세스의 postit_update/postit_close 와 이름만 다름.
            //  postit.html 은 같은 이름으로 invoke 하므로 aliasing wrapper 필요)
            postit_self_list,
            postit_self_update,
            postit_self_close,
        ])
        .setup(move |app| {
            // main window 를 포스트잇으로 변환
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_title("JustPin");
                let _ = w.set_decorations(false);
                let _ = w.set_always_on_top(true);
                // 작은 크기까지 허용 — tauri.conf.json 의 main window 는 minWidth 420/500
                // 이라 포스트잇으로 쓰기엔 너무 큼. 훨씬 작게 재설정.
                let _ = w.set_min_size(Some(tauri::LogicalSize::new(120.0, 80.0)));
                let _ = w.set_size(tauri::LogicalSize::new(postit_w as f64, postit_h as f64));
                let _ = w.set_position(tauri::LogicalPosition::new(postit_x as f64, postit_y as f64));

                // URL 에 color 도 포함 → postit.html 이 초기 렌더부터 올바른 색상 사용
                let url = format!(
                    "https://justanotepad.com/postit?mode=postit&id={}&color={}",
                    urlencoding_encode(&id_for_setup),
                    urlencoding_encode(&color_for_setup)
                );
                if let Ok(u) = url.parse::<tauri::Url>() {
                    let _ = w.navigate(u);
                }
                let _ = w.show();
                let _ = w.set_focus();

                // 창 이동/리사이즈 → postits.json 직접 업데이트
                let id_ev = id_for_setup.clone();
                let path_ev = postits_json_path(app.handle());
                w.on_window_event(move |evt| {
                    match evt {
                        tauri::WindowEvent::Moved(PhysicalPosition { x, y }) => {
                            let mut items = read_postits(&path_ev);
                            if let Some(p) = items.iter_mut().find(|p| p.id == id_ev) {
                                p.x = *x; p.y = *y; p.updated_at = chrono_ts();
                            }
                            write_postits(&path_ev, &items);
                        }
                        tauri::WindowEvent::Resized(PhysicalSize { width, height }) => {
                            let mut items = read_postits(&path_ev);
                            if let Some(p) = items.iter_mut().find(|p| p.id == id_ev) {
                                p.w = *width; p.h = *height; p.updated_at = chrono_ts();
                            }
                            write_postits(&path_ev, &items);
                        }
                        _ => {}
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("postit-mode failed");
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
