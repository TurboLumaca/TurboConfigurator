import { WORKSPACE_ACTION_TYPES } from "../domain/workspaceTypes.js";
import {
  openApp,
  openFolder,
  openLatestFileInFolder,
  openUrl,
  openVsCodeProject,
  runShellCommand,
} from "../services/runtimeApi.js";

function buildSuccessResult(action, startedAt, output, extra = {}) {
  const finishedAt = new Date().toISOString();

  return {
    actionId: action.id,
    actionType: action.type,
    status: "success",
    startedAt,
    finishedAt,
    durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
    message: "Action completed successfully",
    output,
    error: null,
    ...extra,
  };
}

function buildFailureResult(action, startedAt, error, extra = {}) {
  const finishedAt = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error || "Action failed");

  return {
    actionId: action.id,
    actionType: action.type,
    status: "failed",
    startedAt,
    finishedAt,
    durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
    message,
    output: null,
    error: {
      name: error instanceof Error ? error.name : "Error",
      message,
      stack: error instanceof Error ? error.stack || null : null,
    },
    ...extra,
  };
}

async function executeOpenApp(action) {
  return openApp({
    appName: action.appName,
    appPath: action.appPath,
    args: action.args,
  });
}

async function executeOpenFolder(action) {
  return openFolder(action.folderPath);
}

async function executeOpenUrl(action) {
  return openUrl(action.url);
}

async function executeRunShellCommand(action) {
  return runShellCommand({
    command: action.command,
    cwd: action.cwd || "",
    shell: action.shell || "zsh",
    args: action.args,
  });
}

async function executeOpenVsCodeProject(action) {
  return openVsCodeProject(action.projectPath || action.folderPath);
}

async function executeOpenLatestFile(action) {
  return openLatestFileInFolder({
    folderPath: action.folderPath,
    fileExtensions: action.fileExtensions,
    includeHiddenFiles: action.includeHiddenFiles,
  });
}

export const actionHandlers = Object.freeze({
  [WORKSPACE_ACTION_TYPES.OPEN_APP]: executeOpenApp,
  [WORKSPACE_ACTION_TYPES.OPEN_FOLDER]: executeOpenFolder,
  [WORKSPACE_ACTION_TYPES.OPEN_URL]: executeOpenUrl,
  [WORKSPACE_ACTION_TYPES.RUN_SHELL_COMMAND]: executeRunShellCommand,
  [WORKSPACE_ACTION_TYPES.OPEN_VSCODE_PROJECT]: executeOpenVsCodeProject,
  [WORKSPACE_ACTION_TYPES.OPEN_LATEST_FILE_IN_FOLDER]: executeOpenLatestFile,
});

export async function executeAction(action) {
  const startedAt = new Date().toISOString();
  const handler = actionHandlers[action.type];

  if (!handler) {
    return buildFailureResult(
      action,
      startedAt,
      new Error(`Unsupported action type: ${action.type}`),
      { skipped: true },
    );
  }

  try {
    const output = await handler(action);
    if (
      output &&
      typeof output === "object" &&
      Object.prototype.hasOwnProperty.call(output, "success") &&
      output.success === false
    ) {
      throw new Error(output.stderr || output.metadata?.error || "Action execution failed");
    }

    return buildSuccessResult(action, startedAt, output);
  } catch (error) {
    return buildFailureResult(action, startedAt, error);
  }
}
