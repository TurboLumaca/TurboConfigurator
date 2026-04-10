export const WORKSPACE_CATEGORIES = Object.freeze({
  STUDY: "study",
  CODING: "coding",
  OPERATIONS: "operations",
  PERSONAL: "personal",
  OTHER: "other",
});

export const WORKSPACE_ACTION_TYPES = Object.freeze({
  OPEN_APP: "OPEN_APP",
  OPEN_FOLDER: "OPEN_FOLDER",
  OPEN_URL: "OPEN_URL",
  RUN_SHELL_COMMAND: "RUN_SHELL_COMMAND",
  OPEN_VSCODE_PROJECT: "OPEN_VSCODE_PROJECT",
  OPEN_LATEST_FILE_IN_FOLDER: "OPEN_LATEST_FILE_IN_FOLDER",
});

export const WORKSPACE_TRIGGER_TYPES = Object.freeze({
  MANUAL: "manual",
  GLOBAL_SHORTCUT: "global_shortcut",
});

export const WORKSPACE_STORE_VERSION = 1;

const ID_PREFIXES = Object.freeze({
  workspace: "workspace",
  action: "action",
  run: "run",
});

export function createStableId(prefix = "id") {
  const safePrefix = String(prefix || "id").replace(/[^a-zA-Z0-9_-]/g, "_");

  if (globalThis.crypto?.randomUUID) {
    return `${safePrefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${safePrefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function createWorkspaceId() {
  return createStableId(ID_PREFIXES.workspace);
}

export function createWorkspaceActionId() {
  return createStableId(ID_PREFIXES.action);
}

export function createRunId() {
  return createStableId(ID_PREFIXES.run);
}

export function nowIso() {
  return new Date().toISOString();
}

export function createWorkspaceAction(type, overrides = {}) {
  return normalizeWorkspaceAction({
    id: overrides.id || createWorkspaceActionId(),
    type,
    ...overrides,
  });
}

export function createWorkspace(overrides = {}) {
  return normalizeWorkspace({
    id: overrides.id || createWorkspaceId(),
    name: "",
    description: "",
    category: WORKSPACE_CATEGORIES.OTHER,
    trigger: null,
    actions: [],
    tags: [],
    notes: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...overrides,
  });
}

export function normalizeWorkspaceAction(action = {}) {
  const type = String(action.type || "").trim();

  return {
    id: String(action.id || createWorkspaceActionId()),
    type,
    name: typeof action.name === "string" ? action.name : "",
    description: typeof action.description === "string" ? action.description : "",
    appName: typeof action.appName === "string" ? action.appName : "",
    appPath: typeof action.appPath === "string" ? action.appPath : "",
    folderPath: typeof action.folderPath === "string" ? action.folderPath : "",
    projectPath: typeof action.projectPath === "string" ? action.projectPath : "",
    url: typeof action.url === "string" ? action.url : "",
    command: typeof action.command === "string" ? action.command : "",
    cwd: typeof action.cwd === "string" ? action.cwd : "",
    shell: typeof action.shell === "string" && action.shell.trim() ? action.shell : "zsh",
    args: Array.isArray(action.args) ? action.args.filter((item) => item != null).map(String) : [],
    fileExtensions: Array.isArray(action.fileExtensions)
      ? action.fileExtensions.filter((item) => item != null).map((item) => String(item).replace(/^\./, "").toLowerCase())
      : [],
    includeHiddenFiles: Boolean(action.includeHiddenFiles),
    revealAfterOpen: Boolean(action.revealAfterOpen),
    continueOnError: Boolean(action.continueOnError),
    metadata:
      action.metadata && typeof action.metadata === "object" && !Array.isArray(action.metadata)
        ? { ...action.metadata }
        : {},
  };
}

export function normalizeWorkspaceTrigger(trigger) {
  if (!trigger) {
    return null;
  }

  if (typeof trigger === "string") {
    return {
      type: WORKSPACE_TRIGGER_TYPES.MANUAL,
      label: trigger,
      value: trigger,
    };
  }

  if (typeof trigger !== "object") {
    return null;
  }

  return {
    type: String(trigger.type || WORKSPACE_TRIGGER_TYPES.MANUAL),
    label: typeof trigger.label === "string" ? trigger.label : "",
    value: typeof trigger.value === "string" ? trigger.value : "",
  };
}

export function normalizeWorkspace(workspace = {}) {
  const actions = Array.isArray(workspace.actions)
    ? workspace.actions.map((action) => normalizeWorkspaceAction(action))
    : [];

  return {
    id: String(workspace.id || createWorkspaceId()),
    name: typeof workspace.name === "string" ? workspace.name : "",
    description: typeof workspace.description === "string" ? workspace.description : "",
    category: String(workspace.category || WORKSPACE_CATEGORIES.OTHER),
    trigger: normalizeWorkspaceTrigger(workspace.trigger),
    actions,
    tags: Array.isArray(workspace.tags) ? workspace.tags.filter((item) => item != null).map(String) : [],
    notes: typeof workspace.notes === "string" ? workspace.notes : "",
    createdAt: typeof workspace.createdAt === "string" ? workspace.createdAt : nowIso(),
    updatedAt: typeof workspace.updatedAt === "string" ? workspace.updatedAt : nowIso(),
    metadata:
      workspace.metadata && typeof workspace.metadata === "object" && !Array.isArray(workspace.metadata)
        ? { ...workspace.metadata }
        : {},
  };
}

export function cloneWorkspace(workspace) {
  return normalizeWorkspace(workspace);
}

