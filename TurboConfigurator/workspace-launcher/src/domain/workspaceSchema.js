import {
  WORKSPACE_ACTION_TYPES,
  WORKSPACE_CATEGORIES,
  normalizeWorkspace,
  normalizeWorkspaceAction,
} from "./workspaceTypes.js";

const REQUIRED_ACTION_FIELDS = {
  [WORKSPACE_ACTION_TYPES.OPEN_APP]: ["appName", "appPath"],
  [WORKSPACE_ACTION_TYPES.OPEN_FOLDER]: ["folderPath"],
  [WORKSPACE_ACTION_TYPES.OPEN_URL]: ["url"],
  [WORKSPACE_ACTION_TYPES.RUN_SHELL_COMMAND]: ["command"],
  [WORKSPACE_ACTION_TYPES.OPEN_VSCODE_PROJECT]: ["projectPath", "folderPath"],
  [WORKSPACE_ACTION_TYPES.OPEN_LATEST_FILE_IN_FOLDER]: ["folderPath"],
};

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isWorkspaceActionType(type) {
  return Object.values(WORKSPACE_ACTION_TYPES).includes(type);
}

export function validateWorkspaceAction(action) {
  const normalized = normalizeWorkspaceAction(action);
  const errors = [];

  if (!isWorkspaceActionType(normalized.type)) {
    errors.push(`Unknown action type: ${normalized.type || "<empty>"}`);
  }

  const requiredFields = REQUIRED_ACTION_FIELDS[normalized.type] || [];
  const hasRequiredField = requiredFields.some((field) => isNonEmptyString(normalized[field]));

  if (!hasRequiredField && requiredFields.length > 0) {
    errors.push(`Missing required field for ${normalized.type}: ${requiredFields.join(" or ")}`);
  }

  if (normalized.type === WORKSPACE_ACTION_TYPES.OPEN_APP && !hasRequiredField) {
    errors.push("OPEN_APP requires appName or appPath");
  }

  if (normalized.type === WORKSPACE_ACTION_TYPES.OPEN_VSCODE_PROJECT && !hasRequiredField) {
    errors.push("OPEN_VSCODE_PROJECT requires projectPath or folderPath");
  }

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    action: normalized,
  };
}

export function validateWorkspace(workspace) {
  const normalized = normalizeWorkspace(workspace);
  const errors = [];

  if (!isNonEmptyString(normalized.name)) {
    errors.push("Workspace name is required");
  }

  if (!isNonEmptyString(normalized.description)) {
    errors.push("Workspace description is required");
  }

  if (!Object.values(WORKSPACE_CATEGORIES).includes(normalized.category)) {
    errors.push(`Unknown workspace category: ${normalized.category}`);
  }

  if (!Array.isArray(normalized.actions) || normalized.actions.length === 0) {
    errors.push("Workspace must include at least one action");
  }

  const actionResults = normalized.actions.map((action) => validateWorkspaceAction(action));
  const invalidAction = actionResults.find((result) => !result.valid);

  if (invalidAction) {
    errors.push(invalidAction.errors[0]);
  }

  return {
    valid: errors.length === 0,
    errors,
    workspace: normalized,
    actionResults,
  };
}

export function getActionReadiness(action) {
  const result = validateWorkspaceAction(action);
  const executable = result.valid;
  const reason = executable ? "Action is executable" : result.errors[0] || "Action is missing required data";

  return {
    executable,
    reason,
    errors: result.errors,
    action: result.action,
  };
}

export function getWorkspaceReadiness(workspace) {
  const result = validateWorkspace(workspace);
  const executable = result.valid;
  const reason = executable ? "Workspace is executable" : result.errors[0] || "Workspace is missing required data";

  return {
    executable,
    reason,
    errors: result.errors,
    workspace: result.workspace,
    actionReadiness: result.actionResults.map((item) => ({
      executable: item.valid,
      reason: item.valid ? "Action is executable" : item.errors[0] || "Action is missing required data",
      errors: item.errors,
      action: item.action,
    })),
  };
}

export function validateWorkspaceCollection(workspaces) {
  const list = Array.isArray(workspaces) ? workspaces : [];
  const normalized = list.map((workspace) => normalizeWorkspace(workspace));
  const seenIds = new Set();
  const duplicateIds = [];

  for (const workspace of normalized) {
    if (seenIds.has(workspace.id)) {
      duplicateIds.push(workspace.id);
    }
    seenIds.add(workspace.id);
  }

  return {
    valid: duplicateIds.length === 0,
    duplicateIds,
    workspaces: normalized,
  };
}

