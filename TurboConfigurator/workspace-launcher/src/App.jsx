import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import WorkspaceGroups from "./components/WorkspaceGroups";
import WorkspaceList from "./components/WorkspaceList";
import WorkspaceDetail from "./components/WorkspaceDetail";
import WorkspaceEditorModal from "./components/WorkspaceEditorModal";
import { getWorkspaceReadiness } from "./domain/workspaceSchema";
import { workspaceService } from "./services/workspaceService";
import { useWorkspaceStore } from "./state/workspaceStore";
import {
  WORKSPACE_ACTION_TYPES,
  WORKSPACE_CATEGORIES,
  WORKSPACE_TRIGGER_TYPES,
  createWorkspace,
  createWorkspaceAction,
} from "./domain/workspaceTypes";
import "./styles/app.css";

const GROUP_META = [
  {
    id: "all",
    title: "All Workspaces",
    subtitle: "Every local preset on this machine",
    symbol: "ALL",
  },
  {
    id: "study",
    title: "Study",
    subtitle: "Courses, PDFs, and reading flows",
    symbol: "STD",
  },
  {
    id: "coding",
    title: "Coding",
    subtitle: "Repo, editor, shell, and docs",
    symbol: "COD",
  },
  {
    id: "operations",
    title: "Operations",
    subtitle: "Requests, triage, and checklists",
    symbol: "OPS",
  },
  {
    id: "personal",
    title: "Personal",
    subtitle: "Daily routines and planning",
    symbol: "PER",
  },
];

const CATEGORY_LABELS = {
  study: "Study",
  coding: "Coding",
  operations: "Operations",
  personal: "Personal",
  other: "Other",
};

const CATEGORY_VALUES = Object.values(WORKSPACE_CATEGORIES);

function normalizeCategoryInput(category) {
  const normalized = String(category || WORKSPACE_CATEGORIES.STUDY).trim().toLowerCase();
  return CATEGORY_VALUES.includes(normalized) ? normalized : WORKSPACE_CATEGORIES.OTHER;
}

function formatCategory(category) {
  return CATEGORY_LABELS[category] || category || "Other";
}

function normalizeShortcutForTauri(input) {
  if (!input) {
    return "";
  }

  return String(input)
    .trim()
    .replace(/\s+/g, "")
    .replace(/CmdOrControl/gi, "CommandOrControl")
    .replace(/Cmd(?!OrControl)/gi, "Command")
    .replace(/Ctrl/gi, "Control")
    .replace(/Opt/gi, "Option");
}

function normalizeShortcutForUi(input) {
  if (!input) {
    return "";
  }

  return String(input)
    .replace(/CommandOrControl/gi, "CmdOrControl")
    .replace(/Command/gi, "Cmd")
    .replace(/Control/gi, "Ctrl")
    .replace(/Option/gi, "Opt");
}

function getActionTarget(action) {
  if (action.url) return action.url;
  if (action.projectPath) return action.projectPath;
  if (action.folderPath) return action.folderPath;
  if (action.appName) return action.appName;
  if (action.appPath) return action.appPath;
  if (action.command) return action.command;
  if (action.fileExtensions?.length) return `.${action.fileExtensions.join(", .")}`;
  return "Configured action";
}

function getPrimaryPathFromWorkspace(workspace) {
  const actions = Array.isArray(workspace?.actions) ? workspace.actions : [];
  const actionWithPath = actions.find((action) => action?.folderPath || action?.projectPath);
  return actionWithPath?.folderPath || actionWithPath?.projectPath || "~/Desktop";
}

function createDefaultWorkspaceForm() {
  return {
    name: "",
    description: "",
    category: WORKSPACE_CATEGORIES.STUDY,
    primaryPath: "~/Desktop",
    shortcut: "",
    notes: "",
  };
}

function createWorkspaceFormFromSource(workspace) {
  if (!workspace) {
    return createDefaultWorkspaceForm();
  }

  return {
    name: workspace.name || "",
    description: workspace.description || "",
    category: normalizeCategoryInput(workspace.category),
    primaryPath: getPrimaryPathFromWorkspace(workspace),
    shortcut: workspace.trigger?.value || "",
    notes: workspace.notes || "",
  };
}

function buildWorkspaceActions(existingActions, primaryPath) {
  const safeActions = Array.isArray(existingActions) ? existingActions : [];
  const pathActionIndex = safeActions.findIndex(
    (action) =>
      action?.type === WORKSPACE_ACTION_TYPES.OPEN_FOLDER || action?.type === WORKSPACE_ACTION_TYPES.OPEN_VSCODE_PROJECT,
  );

  if (pathActionIndex === -1) {
    return [
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_FOLDER, {
        name: "Open main folder",
        description: "Open selected folder in Finder",
        folderPath: primaryPath,
      }),
      ...safeActions,
    ];
  }

  return safeActions.map((action, index) => {
    if (index !== pathActionIndex) {
      return action;
    }

    if (action.type === WORKSPACE_ACTION_TYPES.OPEN_VSCODE_PROJECT) {
      return createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_VSCODE_PROJECT, {
        ...action,
        projectPath: primaryPath,
        folderPath: action.folderPath || primaryPath,
      });
    }

    return createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_FOLDER, {
      ...action,
      folderPath: primaryPath,
    });
  });
}

function toWorkspaceCardModel(workspace, readiness, runtime) {
  const safeWorkspace = workspace && typeof workspace === "object" ? workspace : {};
  const safeActions = Array.isArray(safeWorkspace.actions) ? safeWorkspace.actions : [];
  const safeReadiness = readiness || { executable: false, reason: "Not validated" };
  const triggerValue = safeWorkspace.trigger?.value
    ? normalizeShortcutForUi(safeWorkspace.trigger.value)
    : "";
  const primaryPath =
    safeActions.find((action) => action?.folderPath || action?.projectPath)?.folderPath ||
    safeActions.find((action) => action?.projectPath)?.projectPath ||
    "Not configured";

  return {
    id: safeWorkspace.id || `workspace-${Math.random().toString(36).slice(2, 8)}`,
    groupId: safeWorkspace.category || WORKSPACE_CATEGORIES.OTHER,
    title: safeWorkspace.name || "Untitled workspace",
    description: safeWorkspace.description || "No description",
    category: formatCategory(safeWorkspace.category),
    trigger: triggerValue,
    status: safeReadiness.executable ? "Ready" : "Blocked",
    executionState: safeReadiness.executable ? "Executable now" : safeReadiness.reason,
    estimatedTime: `${Math.max(2, safeActions.length * 2)}s`,
    primaryPath,
    focus: safeWorkspace.notes || "Operational context preset",
    details: [
      { label: "Category", value: formatCategory(safeWorkspace.category) },
      { label: "Trigger", value: triggerValue || "Manual only" },
      { label: "Primary path", value: primaryPath },
      { label: "Actions", value: `${safeActions.length} steps` },
      { label: "Execution", value: safeReadiness.executable ? "Ready / executable" : "Needs setup" },
      { label: "Focus", value: safeWorkspace.notes || "Immediate context launch" },
    ],
    actions: safeActions.map((action, index) => ({
      id: action.id,
      type: action.type,
      title: action.name || `Step ${index + 1}`,
      description: action.description || "Configured workspace action",
      target: getActionTarget(action),
    })),
    runtime,
  };
}

function App() {
  const [activeGroupId, setActiveGroupId] = useState("all");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [workspaceEditor, setWorkspaceEditor] = useState({
    open: false,
    mode: "create",
    workspaceId: null,
  });
  const [workspaceForm, setWorkspaceForm] = useState(createDefaultWorkspaceForm);
  const [workspaceFormError, setWorkspaceFormError] = useState("");
  const [workspaceFormBusy, setWorkspaceFormBusy] = useState(false);

  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const preferences = useWorkspaceStore((state) => state.preferences);
  const hydration = useWorkspaceStore((state) => state.hydration);
  const runtime = useWorkspaceStore((state) => state.runtime);
  const setActiveWorkspaceId = useWorkspaceStore((state) => state.setActiveWorkspaceId);
  const patchPreferences = useWorkspaceStore((state) => state.patchPreferences);

  const workspaceReadinessMap = useMemo(() => {
    const safeWorkspaces = Array.isArray(workspaces) ? workspaces : [];
    const readinessEntries = safeWorkspaces.map((workspace) => [workspace?.id, getWorkspaceReadiness(workspace)]);
    return new Map(readinessEntries);
  }, [workspaces]);

  const workspaceCards = useMemo(
    () =>
      (Array.isArray(workspaces) ? workspaces : []).map((workspace) =>
        toWorkspaceCardModel(workspace, workspaceReadinessMap.get(workspace.id), runtime),
      ),
    [runtime, workspaceReadinessMap, workspaces],
  );

  const groups = useMemo(
    () =>
      GROUP_META.map((group) => {
        const count =
          group.id === "all"
            ? workspaceCards.length
            : workspaceCards.filter((workspace) => workspace.groupId === group.id).length;

        return {
          ...group,
          count,
        };
      }),
    [workspaceCards],
  );

  const visibleWorkspaces = useMemo(() => {
    if (activeGroupId === "all") {
      return workspaceCards;
    }

    return workspaceCards.filter((workspace) => workspace.groupId === activeGroupId);
  }, [activeGroupId, workspaceCards]);

  const activeWorkspace = useMemo(() => {
    const preferred = visibleWorkspaces.find((workspace) => workspace.id === preferences.activeWorkspaceId);
    return preferred || visibleWorkspaces[0] || null;
  }, [preferences.activeWorkspaceId, visibleWorkspaces]);

  const activeWorkspaceSource = useMemo(() => {
    if (!activeWorkspace?.id) {
      return null;
    }

    const safeWorkspaces = Array.isArray(workspaces) ? workspaces : [];
    return safeWorkspaces.find((workspace) => workspace?.id === activeWorkspace.id) || null;
  }, [activeWorkspace?.id, workspaces]);

  useEffect(() => {
    workspaceService.hydrate().catch((error) => {
      setErrorMessage(`Hydration failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, []);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    if (preferences.activeWorkspaceId === activeWorkspace.id) {
      return;
    }

    setActiveWorkspaceId(activeWorkspace.id);
    workspaceService.persist().catch(() => {
      // Silent persistence retry on next interaction.
    });
  }, [activeWorkspace, preferences.activeWorkspaceId, setActiveWorkspaceId]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let mounted = true;

    isAutostartEnabled()
      .then((enabled) => {
        if (mounted) {
          setAutostartEnabled(enabled);
          patchPreferences({ autoLaunchOnLogin: enabled });
        }
      })
      .catch((error) => {
        if (mounted) {
          setNoticeMessage(`Autostart unavailable: ${error instanceof Error ? error.message : String(error)}`);
        }
      });

    return () => {
      mounted = false;
    };
  }, [patchPreferences]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let isActive = true;

    const shortcutByNormalized = new Map();
    const shortcuts = workspaces
      .map((workspace) => ({
        workspaceId: workspace.id,
        shortcut: normalizeShortcutForTauri(workspace.trigger?.value),
      }))
      .filter((entry) => entry.shortcut);

    if (!shortcuts.length) {
      return () => {
        isActive = false;
      };
    }

    shortcuts.forEach((entry) => {
      shortcutByNormalized.set(entry.shortcut.toLowerCase(), entry.workspaceId);
    });

    (async () => {
      try {
        await unregisterAll();
        await register(
          shortcuts.map((entry) => entry.shortcut),
          (event) => {
            if (!isActive || event.state !== "Pressed") {
              return;
            }

            const workspaceId = shortcutByNormalized.get(String(event.shortcut || "").toLowerCase());
            if (!workspaceId) {
              return;
            }

            workspaceService
              .runWorkspace(workspaceId)
              .then((result) => {
                setNoticeMessage(`Shortcut run completed: ${result.workspaceName}`);
              })
              .catch((error) => {
                setErrorMessage(`Shortcut run failed: ${error instanceof Error ? error.message : String(error)}`);
              });
          },
        );
      } catch (error) {
        setNoticeMessage(
          `Global shortcuts partially unavailable: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    })();

    return () => {
      isActive = false;
      unregisterAll().catch(() => {
        // Ignore cleanup failures.
      });
    };
  }, [workspaces]);

  const handleSelectWorkspace = useCallback((workspaceId) => {
    setErrorMessage("");

    workspaceService.selectWorkspace(workspaceId).catch((error) => {
      setErrorMessage(`Unable to select workspace: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, []);

  const handleRunWorkspace = useCallback(
    async (workspace) => {
      if (!workspace?.id) {
        return;
      }

      setErrorMessage("");
      setNoticeMessage("");

      try {
        const result = await workspaceService.runWorkspace(workspace.id);
        if (result.status === "success") {
          setNoticeMessage(`Workspace completed: ${workspace.title}`);
        } else {
          setNoticeMessage(`Workspace completed with warnings: ${workspace.title}`);
        }
      } catch (error) {
        setErrorMessage(`Run failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [],
  );

  const handleToggleAutostart = useCallback(async () => {
    if (!isTauri()) {
      setNoticeMessage("Autostart is available only in desktop runtime.");
      return;
    }

    setErrorMessage("");

    try {
      if (autostartEnabled) {
        await disableAutostart();
      } else {
        await enableAutostart();
      }

      const nextValue = !autostartEnabled;
      setAutostartEnabled(nextValue);
      patchPreferences({ autoLaunchOnLogin: nextValue });
      await workspaceService.persist();
      setNoticeMessage(nextValue ? "Autostart enabled" : "Autostart disabled");
    } catch (error) {
      setErrorMessage(`Autostart update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [autostartEnabled, patchPreferences]);

  const handleOpenCreateEditor = useCallback(() => {
    setWorkspaceForm(createDefaultWorkspaceForm());
    setWorkspaceFormError("");
    setWorkspaceEditor({
      open: true,
      mode: "create",
      workspaceId: null,
    });
  }, []);

  const handleOpenEditEditor = useCallback(
    (workspaceId) => {
      const safeWorkspaces = Array.isArray(workspaces) ? workspaces : [];
      const sourceWorkspace = safeWorkspaces.find((workspace) => workspace?.id === workspaceId);

      if (!sourceWorkspace) {
        setErrorMessage("Cannot edit workspace: source data not found.");
        return;
      }

      setWorkspaceForm(createWorkspaceFormFromSource(sourceWorkspace));
      setWorkspaceFormError("");
      setWorkspaceEditor({
        open: true,
        mode: "edit",
        workspaceId,
      });
    },
    [workspaces],
  );

  const handleCloseEditor = useCallback(() => {
    setWorkspaceEditor((state) => ({ ...state, open: false }));
    setWorkspaceFormError("");
  }, []);

  const handleWorkspaceFormChange = useCallback((field, value) => {
    setWorkspaceForm((state) => ({
      ...state,
      [field]: value,
    }));
  }, []);

  const handleSubmitWorkspaceEditor = useCallback(async () => {
    const name = String(workspaceForm.name || "").trim();
    const description = String(workspaceForm.description || "").trim();
    const primaryPath = String(workspaceForm.primaryPath || "").trim();
    const category = normalizeCategoryInput(workspaceForm.category);
    const shortcut = String(workspaceForm.shortcut || "").trim();
    const notes = String(workspaceForm.notes || "").trim();

    if (!name) {
      setWorkspaceFormError("Workspace name is required.");
      return;
    }

    if (!description) {
      setWorkspaceFormError("Workspace description is required.");
      return;
    }

    if (!primaryPath) {
      setWorkspaceFormError("Primary path is required.");
      return;
    }

    setWorkspaceFormBusy(true);
    setWorkspaceFormError("");
    setErrorMessage("");

    try {
      const safeWorkspaces = Array.isArray(workspaces) ? workspaces : [];
      const sourceWorkspace =
        workspaceEditor.mode === "edit"
          ? safeWorkspaces.find((workspace) => workspace?.id === workspaceEditor.workspaceId) || null
          : null;

      if (workspaceEditor.mode === "edit" && !sourceWorkspace) {
        throw new Error("Workspace to update no longer exists.");
      }

      const nextWorkspace = createWorkspace({
        ...(sourceWorkspace || {}),
        name,
        description,
        category,
        trigger: shortcut
          ? {
              type: WORKSPACE_TRIGGER_TYPES.GLOBAL_SHORTCUT,
              label: "Custom shortcut",
              value: shortcut,
            }
          : null,
        notes: notes || "Configured from TurboConfigurator UI",
        actions: buildWorkspaceActions(sourceWorkspace?.actions || [], primaryPath),
      });

      await workspaceService.upsertWorkspace(nextWorkspace);
      await workspaceService.selectWorkspace(nextWorkspace.id);

      setWorkspaceEditor({
        open: false,
        mode: "create",
        workspaceId: null,
      });
      setActiveGroupId("all");
      setNoticeMessage(
        workspaceEditor.mode === "edit"
          ? `Workspace updated: ${nextWorkspace.name}`
          : `Workspace created: ${nextWorkspace.name}`,
      );
    } catch (error) {
      setWorkspaceFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorkspaceFormBusy(false);
    }
  }, [workspaceEditor.mode, workspaceEditor.workspaceId, workspaceForm, workspaces]);

  const handleDeleteWorkspace = useCallback(
    async (workspaceId) => {
      const safeWorkspaces = Array.isArray(workspaces) ? workspaces : [];
      const sourceWorkspace = safeWorkspaces.find((workspace) => workspace?.id === workspaceId);

      if (!sourceWorkspace) {
        setErrorMessage("Cannot delete workspace: source data not found.");
        return;
      }

      const confirmDelete = window.confirm(`Delete workspace "${sourceWorkspace.name}"?`);
      if (!confirmDelete) {
        return;
      }

      setErrorMessage("");

      try {
        await workspaceService.removeWorkspace(workspaceId);
        setNoticeMessage(`Workspace deleted: ${sourceWorkspace.name}`);
      } catch (error) {
        setErrorMessage(`Delete failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [workspaces],
  );

  const activeCategory = activeWorkspace?.category || "Workspaces";
  const running = runtime.isRunning;

  return (
    <div className="app-shell">
      <div className="workspace-window">
        <header className="workspace-topbar">
          <div className="traffic-lights" aria-hidden="true">
            <span className="traffic-light traffic-light--red" />
            <span className="traffic-light traffic-light--yellow" />
            <span className="traffic-light traffic-light--green" />
          </div>

          <div className="workspace-topbar__copy">
            <span className="workspace-topbar__eyebrow">Workspace Launcher</span>
            <h1 className="workspace-topbar__title">Local presets, one click away</h1>
          </div>

          <div className="workspace-topbar__status">
            <button type="button" className="topbar-chip topbar-chip--button" onClick={handleOpenCreateEditor}>
              New Workspace
            </button>
            <button type="button" className="topbar-chip topbar-chip--button" onClick={handleToggleAutostart}>
              {autostartEnabled ? "Autostart On" : "Autostart Off"}
            </button>
            <span className="topbar-chip">{hydration.status === "ready" ? "Local Store Ready" : "Loading"}</span>
            <span className="topbar-chip topbar-chip--accent">{activeCategory}</span>
          </div>
        </header>

        {(errorMessage || noticeMessage) && (
          <section className="status-ribbon">
            {errorMessage ? <div className="status-ribbon__item status-ribbon__item--error">{errorMessage}</div> : null}
            {noticeMessage ? <div className="status-ribbon__item status-ribbon__item--notice">{noticeMessage}</div> : null}
          </section>
        )}

        <section className="workspace-layout">
          <WorkspaceGroups
            groups={groups}
            activeGroupId={activeGroupId}
            onSelectGroup={setActiveGroupId}
            title="Groups"
            subtitle="Saved contexts and operating modes"
          />

          <WorkspaceList
            workspaces={visibleWorkspaces}
            activeWorkspaceId={activeWorkspace?.id}
            onSelectWorkspace={handleSelectWorkspace}
            title="Workspaces"
            subtitle={`${visibleWorkspaces.length} visible preset${visibleWorkspaces.length === 1 ? "" : "s"}`}
          />

          <WorkspaceDetail
            workspace={activeWorkspace}
            runtime={runtime}
            running={running}
            onRunWorkspace={handleRunWorkspace}
            onEditWorkspace={(workspace) => handleOpenEditEditor(workspace.id)}
            onDeleteWorkspace={(workspace) => handleDeleteWorkspace(workspace.id)}
          />
        </section>
      </div>

      <WorkspaceEditorModal
        open={workspaceEditor.open}
        mode={workspaceEditor.mode}
        value={workspaceForm}
        busy={workspaceFormBusy}
        errorMessage={workspaceFormError}
        onChange={handleWorkspaceFormChange}
        onClose={handleCloseEditor}
        onSubmit={handleSubmitWorkspaceEditor}
        canDelete={Boolean(activeWorkspaceSource?.id && workspaceEditor.mode === "edit")}
        onDelete={
          activeWorkspaceSource?.id && workspaceEditor.mode === "edit"
            ? () => {
                handleCloseEditor();
                handleDeleteWorkspace(activeWorkspaceSource.id);
              }
            : undefined
        }
      />
    </div>
  );
}

export default App;
