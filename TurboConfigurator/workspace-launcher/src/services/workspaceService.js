import { runWorkspace as runWorkspaceExecution } from "../engine/actionRunner.js";
import { getWorkspaceReadiness, validateWorkspaceCollection } from "../domain/workspaceSchema.js";
import { cloneWorkspace, nowIso, WORKSPACE_STORE_VERSION } from "../domain/workspaceTypes.js";
import { useWorkspaceStore } from "../state/workspaceStore.js";
import { appPersistenceStore } from "./persistenceStore.js";

const DEFAULT_PREFERENCES = {
  activeWorkspaceId: null,
  autoLaunchOnLogin: false,
  continueOnError: false,
  defaultRunMode: "sequential",
};

function normalizeLoadedSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const hasStatePayload =
    Array.isArray(snapshot.workspaces) ||
    (snapshot.preferences && typeof snapshot.preferences === "object") ||
    typeof snapshot.updatedAt === "string";

  return {
    version: Number(snapshot.version || WORKSPACE_STORE_VERSION),
    initialized:
      typeof snapshot.initialized === "boolean"
        ? snapshot.initialized
        : hasStatePayload,
    workspaces: Array.isArray(snapshot.workspaces) ? snapshot.workspaces.map((workspace) => cloneWorkspace(workspace)) : [],
    preferences: {
      ...DEFAULT_PREFERENCES,
      ...(snapshot.preferences || {}),
    },
    updatedAt: typeof snapshot.updatedAt === "string" ? snapshot.updatedAt : null,
  };
}

export function createWorkspaceService({
  persistence = appPersistenceStore,
  initialWorkspaces = [],
} = {}) {
  const defaults = Array.isArray(initialWorkspaces)
    ? initialWorkspaces.map((workspace) => cloneWorkspace(workspace))
    : [];

  function snapshotFromState(state) {
    return {
      version: WORKSPACE_STORE_VERSION,
      initialized: true,
      workspaces: state.workspaces.map((workspace) => cloneWorkspace(workspace)),
      preferences: {
        ...DEFAULT_PREFERENCES,
        ...(state.preferences || {}),
      },
      updatedAt: nowIso(),
    };
  }

  function snapshotFromStore() {
    return snapshotFromState(useWorkspaceStore.getState());
  }

  async function persist() {
    const snapshot = snapshotFromStore();
    await persistence.write(snapshot);
    return snapshot;
  }

  async function hydrate() {
    const state = useWorkspaceStore.getState();
    state.setHydrationStatus("loading");

    try {
      const persisted = normalizeLoadedSnapshot(await persistence.read(null));
      const isFirstRun = !persisted || !persisted.initialized;
      const sourceWorkspaces = isFirstRun ? defaults : persisted.workspaces;
      const validated = validateWorkspaceCollection(sourceWorkspaces);

      useWorkspaceStore.getState().hydrate({
        workspaces: validated.workspaces,
        preferences: isFirstRun ? DEFAULT_PREFERENCES : persisted.preferences,
      });

      const hydratedSnapshot = snapshotFromStore();
      await persistence.write(hydratedSnapshot);

      return hydratedSnapshot;
    } catch (error) {
      useWorkspaceStore.getState().setHydrationStatus("error", error);
      throw error;
    }
  }

  async function resetToSeeds() {
    useWorkspaceStore.getState().reset({
      workspaces: defaults,
      preferences: {
        ...DEFAULT_PREFERENCES,
      },
    });

    return persist();
  }

  async function upsertWorkspace(workspace) {
    useWorkspaceStore.getState().upsertWorkspace(workspace);
    return persist();
  }

  async function removeWorkspace(workspaceId) {
    useWorkspaceStore.getState().removeWorkspace(workspaceId);
    return persist();
  }

  async function selectWorkspace(workspaceId) {
    useWorkspaceStore.getState().setActiveWorkspaceId(workspaceId);
    return persist();
  }

  function getWorkspace(workspaceId) {
    return useWorkspaceStore.getState().getWorkspaceById(workspaceId);
  }

  function getActiveWorkspace() {
    return useWorkspaceStore.getState().getActiveWorkspace();
  }

  function listWorkspaces() {
    return useWorkspaceStore.getState().workspaces.map((workspace) => cloneWorkspace(workspace));
  }

  function listWorkspaceReadiness() {
    return listWorkspaces().map((workspace) => ({
      workspace,
      readiness: getWorkspaceReadiness(workspace),
    }));
  }

  async function runWorkspace(workspaceIdOrWorkspace, options = {}) {
    const workspace =
      typeof workspaceIdOrWorkspace === "string"
        ? getWorkspace(workspaceIdOrWorkspace)
        : cloneWorkspace(workspaceIdOrWorkspace);

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceIdOrWorkspace}`);
    }

    useWorkspaceStore.getState().setRunningState({
      isRunning: true,
      activeRunId: options.runId || null,
      lastError: null,
    });

    try {
      const continueOnError =
        typeof options.continueOnError === "boolean"
          ? options.continueOnError
          : Boolean(useWorkspaceStore.getState().preferences.continueOnError);

      const result = await runWorkspaceExecution(workspace, {
        ...options,
        continueOnError,
      });

      useWorkspaceStore.getState().recordRunResult(result);
      await persist();
      return result;
    } catch (error) {
      const failedRun = {
        runId: options.runId || `run_error_${Date.now().toString(36)}`,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        status: "failed",
        executable: false,
        reason: error instanceof Error ? error.message : String(error),
        startedAt: nowIso(),
        finishedAt: nowIso(),
        durationMs: 0,
        actionResults: [],
      };

      useWorkspaceStore.getState().recordRunResult(failedRun);
      await persist();
      throw error;
    }
  }

  function getSnapshot() {
    return {
      ...useWorkspaceStore.getState(),
      workspaces: listWorkspaces(),
    };
  }

  return {
    hydrate,
    persist,
    resetToSeeds,
    upsertWorkspace,
    removeWorkspace,
    selectWorkspace,
    runWorkspace,
    getWorkspace,
    getActiveWorkspace,
    listWorkspaces,
    listWorkspaceReadiness,
    getSnapshot,
    seedWorkspaces: defaults,
    initialWorkspaces: defaults,
    persistence,
  };
}

export const workspaceService = createWorkspaceService({
  persistence: appPersistenceStore,
});
