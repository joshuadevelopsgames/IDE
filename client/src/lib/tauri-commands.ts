/*
 * Obsidian Forge — Tauri Command Stubs
 * 
 * These are the TypeScript type definitions for the Tauri commands that will be
 * implemented in Rust. In the web prototype, these are no-ops. When building with
 * Tauri 2, replace these with actual @tauri-apps/api invocations.
 * 
 * Rust-side implementation outline (src-tauri/src/hermes.rs):
 * 
 * ```rust
 * use std::process::{Command, Child, Stdio};
 * use std::sync::Mutex;
 * use tauri::State;
 * 
 * struct HermesProcess(Mutex<Option<Child>>);
 * 
 * #[tauri::command]
 * fn hermes_start(
 *     state: State<HermesProcess>,
 *     config: HermesConfig
 * ) -> Result<HermesStatus, String> {
 *     let child = Command::new(&config.hermes_path)
 *         .args(["--rpc", "--json", "--working-dir", &config.working_directory])
 *         .stdin(Stdio::piped())
 *         .stdout(Stdio::piped())
 *         .stderr(Stdio::piped())
 *         .spawn()
 *         .map_err(|e| format!("Failed to start Hermes: {}", e))?;
 *     
 *     let pid = child.id();
 *     *state.0.lock().unwrap() = Some(child);
 *     
 *     Ok(HermesStatus { running: true, pid: Some(pid), .. })
 * }
 * 
 * #[tauri::command]
 * fn hermes_stop(state: State<HermesProcess>) -> Result<(), String> {
 *     if let Some(mut child) = state.0.lock().unwrap().take() {
 *         child.kill().map_err(|e| format!("Failed to stop: {}", e))?;
 *     }
 *     Ok(())
 * }
 * 
 * #[tauri::command]
 * fn hermes_send(
 *     state: State<HermesProcess>,
 *     message: String
 * ) -> Result<(), String> {
 *     if let Some(child) = state.0.lock().unwrap().as_mut() {
 *         if let Some(stdin) = child.stdin.as_mut() {
 *             use std::io::Write;
 *             writeln!(stdin, "{}", message)
 *                 .map_err(|e| format!("Failed to send: {}", e))?;
 *         }
 *     }
 *     Ok(())
 * }
 * ```
 * 
 * The stdout reader runs in a separate thread and emits events via Tauri's
 * event system (app_handle.emit_all("hermes-event", payload)).
 */

// ─── Types matching Rust structs ─────────────────────────────────────

export interface TauriHermesConfig {
  hermes_path: string;
  working_directory: string;
  model_provider: string;
  api_key: string;
  max_concurrent_tools: number;
  env_vars?: Record<string, string>;
}

export interface TauriHermesStatus {
  running: boolean;
  pid?: number;
  uptime_seconds?: number;
  model?: string;
  session_id?: string;
  memory_usage_mb?: number;
}

export interface TauriFileDialogResult {
  path: string;
  is_directory: boolean;
}

export interface TauriKeychainEntry {
  service: string;
  account: string;
  // password is never returned to frontend
}

// ─── Command stubs (web prototype) ───────────────────────────────────

/**
 * In Tauri, these would be:
 *   import { invoke } from "@tauri-apps/api/core";
 *   const result = await invoke<TauriHermesStatus>("hermes_start", { config });
 */

export async function tauriHermesStart(config: TauriHermesConfig): Promise<TauriHermesStatus> {
  console.log("[Tauri stub] hermes_start", config);
  return {
    running: true,
    pid: Math.floor(Math.random() * 99999),
    uptime_seconds: 0,
    model: "hermes-3-llama-3.1-70b",
    session_id: crypto.randomUUID(),
  };
}

export async function tauriHermesStop(): Promise<void> {
  console.log("[Tauri stub] hermes_stop");
}

export async function tauriHermesSend(message: string): Promise<void> {
  console.log("[Tauri stub] hermes_send", message);
}

export async function tauriHermesStatus(): Promise<TauriHermesStatus> {
  return { running: false };
}

export async function tauriOpenFileDialog(directory: boolean): Promise<TauriFileDialogResult | null> {
  console.log("[Tauri stub] open_file_dialog", { directory });
  // In web prototype, return a mock path
  return {
    path: "/Users/dev/projects/my-project",
    is_directory: directory,
  };
}

export async function tauriReadDirectory(path: string): Promise<string[]> {
  console.log("[Tauri stub] read_directory", path);
  return [];
}

export async function tauriReadFile(path: string): Promise<string> {
  console.log("[Tauri stub] read_file", path);
  return "";
}

export async function tauriWriteFile(path: string, content: string): Promise<void> {
  console.log("[Tauri stub] write_file", path);
}

export async function tauriKeychainGet(service: string, account: string): Promise<string | null> {
  console.log("[Tauri stub] keychain_get", service, account);
  return null;
}

export async function tauriKeychainSet(service: string, account: string, password: string): Promise<void> {
  console.log("[Tauri stub] keychain_set", service, account);
}

// ─── Event listener stub ─────────────────────────────────────────────

/**
 * In Tauri:
 *   import { listen } from "@tauri-apps/api/event";
 *   const unlisten = await listen("hermes-event", (event) => { ... });
 */
export function tauriListenHermesEvents(
  callback: (event: { type: string; data: unknown }) => void
): () => void {
  console.log("[Tauri stub] listening for hermes-event");
  return () => {
    console.log("[Tauri stub] unlistened hermes-event");
  };
}
