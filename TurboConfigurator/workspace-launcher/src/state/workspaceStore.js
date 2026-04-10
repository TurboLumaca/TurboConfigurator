import { create } from "zustand";
import { cloneWorkspace, nowIso } from "../domain/workspaceTypes.js";

const DEFAULT_PREFERENCES = Object.freeze({
  activeWorkspaceId: null,
  autoLaunchOnLogin: false,
  continueOnError: false,
  defaultRunMode: "sequential",
});

function createInitialState() {
  return {
    workspaces: [],
    preferences: { ...DEFAULT_PREFERENCES },
    hydration: {
      status: "idle",
      loadedAt: null,
      error: null,
    },
    runtime: {
      isRunning: false,
      activeRunId: null,
      lastRun: null,
      recentRuns: [],
      lastError: null,
    },
  };
}

function normalizeWorkspaces(list) {
  return Array.isArray(list) ? list.map((workspace) => cloneWorkspace(workspace)) : [];
}

function mergePreferences(nextPreferences = {}) {
  return {
    ...DEFAULT_PREFERENCES,
    ...(nextPreferences || {}),
  };
}

function hasWorkspace(workspaces, workspaceId) {
  if (!workspaceId) {
    return false;
  }

  return workspaces.some((workspace) => workspace.id === workspaceId);
}

export const useWorkspaceStore = create((set, get) => ({
  ...createInitialState(),

  hydrate(snapshot = {}) {
    const workspaces = normalizeWorkspaces(snapshot.workspaces);
    const preferences = mergePreferences(snapshot.preferences);
    const activeWorkspaceId = hasWorkspace(workspaces, preferences.activeWorkspaceId)
      ? preferences.activeWorkspaceId
      : workspaces[0]?.id || null;

    set((state) => ({
      ...state,
      workspaces,
      preferences: {
        ...preferences,
        activeWorkspaceId,
      },
      hydration: {
        status: "ready",
        loadedAt: nowIso(),
        error: null,
      },
    }));
  },

  reset(nextState = {}) {
    const initial = createInitialState();
    const workspaces = normalizeWorkspaces(nextState.workspaces);
    const preferences = mergePreferences(nextState.preferences);
    const activeWorkspaceId = hasWorkspace(workspaces, preferences.activeWorkspaceId)
      ? preferences.activeWorkspaceId
      : workspaces[0]?.id || null;

    set({
      ...initial,
      ...nextState,
      workspaces,
      preferences: {
        ...preferences,
        activeWorkspaceId,
      },
      hydration: {
        ...initial.hydration,
        ...(nextState.hydration || {}),
      },
      runtime: {
        ...initial.runtime,
        ...(nextState.runtime || {}),
      },
    });
  },

  setWorkspaces(workspaces) {
    const normalized = normalizeWorkspaces(workspaces);

    set((state) => ({
      ...state,
      workspaces: normalized,
      preferences: {
        ...state.preferences,
        activeWorkspaceId: hasWorkspace(normalized, state.preferences.activeWorkspaceId)
          ? state.preferences.activeWorkspaceId
          : normalized[0]?.id || null,
      },
    }));
  },

  upsertWorkspace(workspace) {
    const nextWorkspace = cloneWorkspace(workspace);

    set((state) => {
      const index = state.workspaces.findIndex((item) => item.id === nextWorkspace.id);
      const workspaces =
        index >= 0
          ? state.workspaces.map((item, itemIndex) => (itemIndex === index ? nextWorkspace : item))
          : [...state.workspaces, nextWorkspace];

      return {
        ...state,
        workspaces,
      };
    });
  },

  removeWorkspace(workspaceId) {
    set((state) => {
      const workspaces = state.workspaces.filter((workspace) => workspace.id !== workspaceId);
      const activeWorkspaceId =
        state.preferences.activeWorkspaceId === workspaceId
          ? workspaces[0]?.id || null
          : state.preferences.activeWorkspaceId;

      return {
        ...state,
        workspaces,
        preferences: {
          ...state.preferences,
          activeWorkspaceId,
        },
      };
    });
  },

  setActiveWorkspaceId(activeWorkspaceId) {
    set((state) => {
      const nextActiveWorkspaceId = hasWorkspace(state.workspaces, activeWorkspaceId)
        ? activeWorkspaceId
        : state.preferences.activeWorkspaceId;

      return {
        ...state,
        preferences: {
          ...state.preferences,
          activeWorkspaceId: nextActiveWorkspaceId,
        },
      };
    });
  },

  patchPreferences(patch = {}) {
    set((state) => ({
      ...state,
      preferences: {
        ...state.preferences,
        ...(patch || {}),
      },
    }));
  },

  setHydrationStatus(status, error = null) {
    set((state) => ({
      ...state,
      hydration: {
        ...state.hydration,
        status,
        error: error ? String(error) : null,
        loadedAt: status === "ready" ? nowIso() : state.hydration.loadedAt,
      },
    }));
  },

  setRunningState({ isRunning = false, activeRunId = null, lastRun = null, lastError = null } = {}) {
    set((state) => ({
      ...state,
      runtime: {
        ...state.runtime,
        isRunning,
        activeRunId,
        lastRun,
        lastError: lastError ? String(lastError) : null,
      },
    }));
  },

  recordRunResult(runResult) {
    set((state) => ({
      ...state,
      runtime: {
        ...state.runtime,
        isRunning: false,
        activeRunId: null,
        lastRun: runResult || null,
        lastError: runResult?.status === "success" ? null : runResult?.reason || null,
        recentRuns: runResult
          ? [runResult, ...state.runtime.recentRuns.filter((run) => run.runId !== runResult.runId)].slice(0, 30)
          : state.runtime.recentRuns,
      },
    }));
  },

  getWorkspaceById(workspaceId) {
    return get().workspaces.find((workspace) => workspace.id === workspaceId) || null;
  },

  getActiveWorkspace() {
    const state = get();
    return state.workspaces.find((workspace) => workspace.id === state.preferences.activeWorkspaceId) || null;
  },
}));
