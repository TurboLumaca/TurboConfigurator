use serde::Serialize;
use serde_json::{json, Map, Value};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
    time::UNIX_EPOCH,
};
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_autostart::MacosLauncher;

const MACOS_OPEN_BIN: &str = "/usr/bin/open";
const DEFAULT_SHELL_BIN: &str = "/bin/zsh";

#[derive(Debug, Serialize)]
struct CommandResult {
    success: bool,
    stdout: String,
    stderr: String,
    metadata: Value,
}

#[derive(Debug)]
struct FileCandidate {
    path: PathBuf,
    modified_at: u128,
}

#[tauri::command]
fn open_app(
    app_name: Option<String>,
    app_path: Option<String>,
    args: Option<Vec<String>>,
) -> CommandResult {
    let app_name = app_name.unwrap_or_default().trim().to_string();
    let app_path = app_path.unwrap_or_default().trim().to_string();
    let args = args.unwrap_or_default();

    if app_name.is_empty() && app_path.is_empty() {
        return failure_result(
            "open_app",
            "Either appName or appPath is required.",
            json!({
                "app_name": app_name,
                "app_path": app_path,
                "args": args,
                "launcher": MACOS_OPEN_BIN,
            }),
        );
    }

    let mut command = Command::new(MACOS_OPEN_BIN);

    if !app_path.is_empty() {
        let resolved_path = resolve_local_path(&app_path);
        command.arg(&resolved_path);
    } else {
        command.arg("-a").arg(&app_name);
    }

    if !args.is_empty() {
        command.arg("--args");
        for arg in &args {
            command.arg(arg);
        }
    }

    execute_command(
        "open_app",
        command,
        json!({
            "app_name": app_name,
            "app_path": app_path,
            "args": args,
            "launcher": MACOS_OPEN_BIN,
        }),
    )
}

#[tauri::command]
fn open_folder(path: String) -> CommandResult {
    let resolved = resolve_local_path(&path);

    if !resolved.is_dir() {
        return failure_result(
            "open_folder",
            "The supplied path does not point to an existing folder.",
            json!({
                "requested_path": path,
                "resolved_path": resolved.display().to_string(),
                "launcher": MACOS_OPEN_BIN,
            }),
        );
    }

    let mut command = Command::new(MACOS_OPEN_BIN);
    command.arg(&resolved);

    execute_command(
        "open_folder",
        command,
        json!({
            "requested_path": path,
            "resolved_path": resolved.display().to_string(),
            "launcher": MACOS_OPEN_BIN,
        }),
    )
}

#[tauri::command]
fn open_url(url: String) -> CommandResult {
    let normalized = url.trim().to_string();

    if normalized.is_empty() {
        return failure_result(
            "open_url",
            "URL cannot be empty.",
            json!({ "url": url, "launcher": MACOS_OPEN_BIN }),
        );
    }

    let mut command = Command::new(MACOS_OPEN_BIN);
    command.arg(&normalized);

    execute_command(
        "open_url",
        command,
        json!({ "url": normalized, "launcher": MACOS_OPEN_BIN }),
    )
}

#[tauri::command]
fn run_shell_command(
    command: String,
    cwd: Option<String>,
    shell: Option<String>,
    args: Option<Vec<String>>,
    env: Option<HashMap<String, String>>,
) -> CommandResult {
    let command = command.trim().to_string();

    if command.is_empty() {
        return failure_result(
            "run_shell_command",
            "Shell command cannot be empty.",
            json!({ "command": command }),
        );
    }

    let shell_name = shell
        .unwrap_or_else(|| "zsh".to_string())
        .trim()
        .to_string();

    let shell_bin = if shell_name.starts_with('/') {
        shell_name.clone()
    } else {
        format!("/bin/{}", shell_name)
    };

    let shell_path = if Path::new(&shell_bin).exists() {
        shell_bin
    } else {
        DEFAULT_SHELL_BIN.to_string()
    };

    let mut process = Command::new(&shell_path);
    let mut full_command = command.clone();

    let args = args.unwrap_or_default();
    if !args.is_empty() {
        full_command.push(' ');
        full_command.push_str(&args.join(" "));
    }

    process.arg("-lc").arg(&full_command);

    if let Some(dir) = cwd.as_deref() {
        let resolved_dir = resolve_local_path(dir);
        if resolved_dir.is_dir() {
            process.current_dir(&resolved_dir);
        }
    }

    if let Some(environment) = env {
        for (key, value) in environment {
            process.env(key, value);
        }
    }

    execute_command(
        "run_shell_command",
        process,
        json!({
            "shell": shell_path,
            "command": full_command,
            "cwd": cwd,
        }),
    )
}

#[tauri::command]
fn open_vscode_project(path: String) -> CommandResult {
    let resolved = resolve_local_path(&path);

    if !resolved.exists() {
        return failure_result(
            "open_vscode_project",
            "The supplied path does not exist.",
            json!({
                "requested_path": path,
                "resolved_path": resolved.display().to_string(),
            }),
        );
    }

    match Command::new("code").arg(&resolved).output() {
        Ok(output) => finalize_process_result(
            "open_vscode_project",
            output,
            json!({
                "requested_path": path,
                "resolved_path": resolved.display().to_string(),
                "launcher": "code",
            }),
        ),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let mut fallback = Command::new(MACOS_OPEN_BIN);
            fallback.arg("-a").arg("Visual Studio Code").arg(&resolved);

            execute_command(
                "open_vscode_project",
                fallback,
                json!({
                    "requested_path": path,
                    "resolved_path": resolved.display().to_string(),
                    "launcher": MACOS_OPEN_BIN,
                    "fallback": "Visual Studio Code",
                }),
            )
        }
        Err(error) => failure_result(
            "open_vscode_project",
            &format!("Failed to launch VS Code: {error}"),
            json!({
                "requested_path": path,
                "resolved_path": resolved.display().to_string(),
                "launcher": "code",
            }),
        ),
    }
}

#[tauri::command]
fn open_latest_file_in_folder(
    path: String,
    file_extensions: Option<Vec<String>>,
    include_hidden_files: Option<bool>,
) -> CommandResult {
    let resolved = resolve_local_path(&path);
    let include_hidden_files = include_hidden_files.unwrap_or(false);
    let extension_filter = file_extensions.clone().unwrap_or_default();

    if !resolved.is_dir() {
        return failure_result(
            "open_latest_file_in_folder",
            "The supplied path does not point to an existing folder.",
            json!({
                "requested_path": path,
                "resolved_path": resolved.display().to_string(),
            }),
        );
    }

    match find_latest_file(&resolved, extension_filter, include_hidden_files) {
        Ok(Some(candidate)) => {
            let mut command = Command::new(MACOS_OPEN_BIN);
            command.arg(&candidate);

            execute_command(
                "open_latest_file_in_folder",
                command,
                json!({
                    "requested_path": path,
                    "resolved_path": resolved.display().to_string(),
                    "selected_path": candidate.display().to_string(),
                }),
            )
        }
        Ok(None) => failure_result(
            "open_latest_file_in_folder",
            "No matching files were found in the folder.",
            json!({
                "requested_path": path,
                "resolved_path": resolved.display().to_string(),
                "file_extensions": file_extensions,
            }),
        ),
        Err(error) => failure_result(
            "open_latest_file_in_folder",
            &format!("Failed to inspect folder contents: {error}"),
            json!({
                "requested_path": path,
                "resolved_path": resolved.display().to_string(),
                "file_extensions": file_extensions,
            }),
        ),
    }
}

fn execute_command(command_name: &str, mut command: Command, metadata: Value) -> CommandResult {
    match command.output() {
        Ok(output) => finalize_process_result(command_name, output, metadata),
        Err(error) => failure_result(command_name, &error.to_string(), metadata),
    }
}

fn finalize_process_result(command_name: &str, output: Output, metadata: Value) -> CommandResult {
    let mut metadata_object = metadata_to_object(metadata);
    metadata_object.insert("command".to_string(), json!(command_name));
    metadata_object.insert("exit_code".to_string(), json!(output.status.code()));
    metadata_object.insert("status".to_string(), json!(output.status.to_string()));

    CommandResult {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        metadata: Value::Object(metadata_object),
    }
}

fn failure_result(command_name: &str, error: &str, metadata: Value) -> CommandResult {
    let mut metadata_object = metadata_to_object(metadata);
    metadata_object.insert("command".to_string(), json!(command_name));
    metadata_object.insert("error".to_string(), json!(error));

    CommandResult {
        success: false,
        stdout: String::new(),
        stderr: error.to_string(),
        metadata: Value::Object(metadata_object),
    }
}

fn metadata_to_object(metadata: Value) -> Map<String, Value> {
    match metadata {
        Value::Object(map) => map,
        value => {
            let mut map = Map::new();
            map.insert("details".to_string(), value);
            map
        }
    }
}

fn resolve_local_path(path: &str) -> PathBuf {
    let expanded = expand_tilde(path);

    if expanded.is_absolute() {
        expanded
    } else {
        std::env::current_dir()
            .map(|cwd| cwd.join(&expanded))
            .unwrap_or(expanded)
    }
}

fn expand_tilde(path: &str) -> PathBuf {
    if path == "~" {
        return home_dir().unwrap_or_else(|| PathBuf::from(path));
    }

    if let Some(rest) = path.strip_prefix("~/") {
        return home_dir()
            .map(|home| home.join(rest))
            .unwrap_or_else(|| PathBuf::from(path));
    }

    PathBuf::from(path)
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn find_latest_file(
    folder: &Path,
    file_extensions: Vec<String>,
    include_hidden_files: bool,
) -> std::io::Result<Option<PathBuf>> {
    let allowed_extensions: Vec<String> = file_extensions
        .into_iter()
        .map(|extension| extension.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|extension| !extension.is_empty())
        .collect();

    let mut newest: Option<FileCandidate> = None;

    for entry in fs::read_dir(folder)? {
        let entry = entry?;
        let path = entry.path();

        if !entry.file_type()?.is_file() {
            continue;
        }

        if !include_hidden_files {
            if let Some(file_name) = path.file_name().and_then(|name| name.to_str()) {
                if file_name.starts_with('.') {
                    continue;
                }
            }
        }

        if !allowed_extensions.is_empty() && !matches_extension(&path, &allowed_extensions) {
            continue;
        }

        let metadata = entry.metadata()?;
        let modified_at = metadata_timestamp(&metadata);
        let candidate = FileCandidate { path, modified_at };

        let should_replace = newest
            .as_ref()
            .map(|current| candidate.modified_at > current.modified_at)
            .unwrap_or(true);

        if should_replace {
            newest = Some(candidate);
        }
    }

    Ok(newest.map(|candidate| candidate.path))
}

fn matches_extension(path: &Path, allowed_extensions: &[String]) -> bool {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return false;
    };

    let extension = extension.to_ascii_lowercase();
    allowed_extensions
        .iter()
        .any(|candidate| candidate == &extension)
}

fn metadata_timestamp(metadata: &fs::Metadata) -> u128 {
    metadata
        .modified()
        .or_else(|_| metadata.created())
        .or_else(|_| metadata.accessed())
        .ok()
        .and_then(|timestamp| timestamp.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or(0)
}

fn show_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None::<Vec<&'static str>>,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            if let Some(icon) = app.default_window_icon().cloned() {
                TrayIconBuilder::with_id("workspace-launcher-tray")
                    .icon(icon)
                    .tooltip("Workspace Launcher")
                    .show_menu_on_left_click(false)
                    .on_tray_icon_event(|app, event| match event {
                        TrayIconEvent::Click {
                            button,
                            button_state,
                            ..
                        } if button == MouseButton::Left
                            && button_state == MouseButtonState::Up =>
                        {
                            show_main_window(&app.app_handle());
                        }
                        _ => {}
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_app,
            open_folder,
            open_url,
            run_shell_command,
            open_vscode_project,
            open_latest_file_in_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
