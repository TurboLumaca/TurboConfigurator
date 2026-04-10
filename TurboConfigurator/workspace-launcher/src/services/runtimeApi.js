import { invoke, isTauri } from "@tauri-apps/api/core";
import { homeDir, isAbsolute, join, normalize, resolve } from "@tauri-apps/api/path";
import { openUrl as openExternalUrl } from "@tauri-apps/plugin-opener";

const TAURI_COMMANDS = Object.freeze({
  OPEN_APP: "open_app",
  OPEN_FOLDER: "open_folder",
  OPEN_URL: "open_url",
  RUN_SHELL_COMMAND: "run_shell_command",
  OPEN_VSCODE_PROJECT: "open_vscode_project",
  OPEN_LATEST_FILE: "open_latest_file_in_folder",
});

function hasWindow() {
  return typeof window !== "undefined";
}

async function getHomeDirectory() {
  if (!isTauri()) {
    return hasWindow() ? "" : process.env.HOME || "";
  }

  try {
    return await homeDir();
  } catch {
    return "";
  }
}

async function isAbsolutePath(path) {
  if (!path) {
    return false;
  }

  if (!isTauri()) {
    return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
  }

  return isAbsolute(path);
}

export async function resolveWorkspacePath(inputPath, basePath = null) {
  const rawPath = String(inputPath || "").trim();

  if (!rawPath) {
    return "";
  }

  const home = await getHomeDirectory();
  let resolvedPath = rawPath;

  if (rawPath === "~" && home) {
    resolvedPath = home;
  } else if (rawPath.startsWith("~/") && home) {
    resolvedPath = isTauri() ? await join(home, rawPath.slice(2)) : `${home}/${rawPath.slice(2)}`;
  } else if (basePath && !(await isAbsolutePath(rawPath))) {
    resolvedPath = isTauri() ? await resolve(basePath, rawPath) : `${basePath}/${rawPath}`;
  } else if (!(await isAbsolutePath(rawPath)) && home) {
    resolvedPath = isTauri() ? await resolve(home, rawPath) : `${home}/${rawPath}`;
  }

  if (!isTauri()) {
    return resolvedPath;
  }

  try {
    return await normalize(resolvedPath);
  } catch {
    return resolvedPath;
  }
}

async function callTauriCommand(command, payload) {
  if (!isTauri()) {
    throw new Error(`Tauri runtime is unavailable for command: ${command}`);
  }

  return invoke(command, payload);
}

export async function openUrl(url) {
  const targetUrl = String(url || "").trim();

  if (!targetUrl) {
    throw new Error("openUrl requires a non-empty url");
  }

  if (!isTauri()) {
    if (hasWindow()) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
      return { success: true, url: targetUrl, runtime: "browser" };
    }

    throw new Error("URL opening is unavailable in this runtime");
  }

  await openExternalUrl(targetUrl);

  return {
    success: true,
    url: targetUrl,
    runtime: "tauri-opener",
  };
}

export async function openFolder(folderPath) {
  const resolvedPath = await resolveWorkspacePath(folderPath);

  if (!resolvedPath) {
    throw new Error("openFolder requires a valid folderPath");
  }

  if (!isTauri()) {
    return {
      success: true,
      path: resolvedPath,
      runtime: "browser-simulated",
    };
  }

  return callTauriCommand(TAURI_COMMANDS.OPEN_FOLDER, {
    path: resolvedPath,
  });
}

export async function openApp({ appName = "", appPath = "", args = [] } = {}) {
  const normalizedAppName = String(appName || "").trim();
  const normalizedAppPath = String(appPath || "").trim();

  if (!normalizedAppName && !normalizedAppPath) {
    throw new Error("openApp requires appName or appPath");
  }

  return callTauriCommand(TAURI_COMMANDS.OPEN_APP, {
    appName: normalizedAppName,
    appPath: normalizedAppPath,
    args: Array.isArray(args) ? args.map(String) : [],
  });
}

export async function runShellCommand({ command, cwd = "", shell = "zsh", args = [], env = {} } = {}) {
  const normalizedCommand = String(command || "").trim();

  if (!normalizedCommand) {
    throw new Error("runShellCommand requires a non-empty command");
  }

  return callTauriCommand(TAURI_COMMANDS.RUN_SHELL_COMMAND, {
    command: normalizedCommand,
    cwd: cwd ? await resolveWorkspacePath(cwd) : "",
    shell: String(shell || "zsh").trim() || "zsh",
    args: Array.isArray(args) ? args.map(String) : [],
    env: env && typeof env === "object" && !Array.isArray(env) ? env : {},
  });
}

export async function openVsCodeProject(projectPath) {
  const resolvedPath = await resolveWorkspacePath(projectPath);

  if (!resolvedPath) {
    throw new Error("openVsCodeProject requires a valid projectPath");
  }

  return callTauriCommand(TAURI_COMMANDS.OPEN_VSCODE_PROJECT, {
    path: resolvedPath,
  });
}

export async function findLatestFileInFolder({
  folderPath,
  fileExtensions = [],
  includeHiddenFiles = false,
} = {}) {
  const resolvedFolderPath = await resolveWorkspacePath(folderPath);

  if (!resolvedFolderPath) {
    throw new Error("findLatestFileInFolder requires a valid folderPath");
  }

  return callTauriCommand(TAURI_COMMANDS.OPEN_LATEST_FILE, {
    path: resolvedFolderPath,
    fileExtensions: Array.isArray(fileExtensions)
      ? fileExtensions
          .map((item) => String(item || "").trim().replace(/^\./, "").toLowerCase())
          .filter(Boolean)
      : [],
    includeHiddenFiles: Boolean(includeHiddenFiles),
  });
}

export async function openLatestFileInFolder(options = {}) {
  return findLatestFileInFolder(options);
}
