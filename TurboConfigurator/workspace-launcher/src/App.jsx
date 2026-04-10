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

function toWorkspaceCardModel(workspace, readiness, runtime) {
  const safeReadiness = readiness || { executable: false, reason: "Not validated" };
  const triggerValue = workspace.trigger?.value ? normalizeShortcutForUi(workspace.trigger.value) : "";
  const primaryPath =
    workspace.actions.find((action) => action.folderPath || action.projectPath)?.folderPath ||
    workspace.actions.find((action) => action.projectPath)?.projectPath ||
    "Not configured";

  return {
    id: workspace.id,
    groupId: workspace.category,
    title: workspace.name,
    description: workspace.description,
    category: formatCategory(workspace.category),
    trigger: triggerValue,
    status: safeReadiness.executable ? "Ready" : "Blocked",
    executionState: safeReadiness.executable ? "Executable now" : safeReadiness.reason,
    estimatedTime: `${Math.max(2, workspace.actions.length * 2)}s`,
    primaryPath,
    focus: workspace.notes || "Operational context preset",
    details: [
      { label: "Category", value: formatCategory(workspace.category) },
      { label: "Trigger", value: triggerValue || "Manual only" },
      { label: "Primary path", value: primaryPath },
      { label: "Actions", value: `${workspace.actions.length} steps` },
      { label: "Execution", value: safeReadiness.executable ? "Ready / executable" : "Needs setup" },
      { label: "Focus", value: workspace.notes || "Immediate context launch" },
    ],
    actions: workspace.actions.map((action, index) => ({
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

  const {
    workspaces,
    preferences,
    hydration,
    runtime,
    setActiveWorkspaceId,
    patchPreferences,
  } = useWorkspaceStore((state) => ({
    workspaces: state.workspaces,
    preferences: state.preferences,
    hydration: state.hydration,
    runtime: state.runtime,
    setActiveWorkspaceId: state.setActiveWorkspaceId,
    patchPreferences: state.patchPreferences,
  }));

  const workspaceReadinessMap = useMemo(() => {
    const readinessEntries = workspaces.map((workspace) => [workspace.id, getWorkspaceReadiness(workspace)]);
    return new Map(readinessEntries);
  }, [workspaces]);

  const workspaceCards = useMemo(
    () =>
      workspaces.map((workspace) =>
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

  const handleCreateWorkspace = useCallback(async () => {
    const name = window.prompt("Nome workspace (es. Sessione Studio Algebra)");
    if (!name || !name.trim()) {
      return;
    }

    const categoryInput = window.prompt(
      "Categoria: study | coding | operations | personal",
      WORKSPACE_CATEGORIES.STUDY,
    );
    const category = String(categoryInput || WORKSPACE_CATEGORIES.STUDY).trim().toLowerCase();
    const normalizedCategory = Object.values(WORKSPACE_CATEGORIES).includes(category)
      ? category
      : WORKSPACE_CATEGORIES.OTHER;

    const folderPath = window.prompt("Cartella principale da aprire", "~/Desktop") || "~/Desktop";
    const shortcutRaw = window.prompt(
      "Shortcut opzionale (es. Cmd+Opt+9). Lascia vuoto per nessuno.",
      "",
    );

    const workspace = createWorkspace({
      name: name.trim(),
      description: `Preset creato manualmente per ${name.trim()}.`,
      category: normalizedCategory,
      trigger: shortcutRaw?.trim()
        ? {
            type: WORKSPACE_TRIGGER_TYPES.GLOBAL_SHORTCUT,
            label: "Custom shortcut",
            value: shortcutRaw.trim(),
          }
        : null,
      notes: "Creato da UI",
      actions: [
        createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_FOLDER, {
          name: "Open main folder",
          description: "Open selected folder in Finder",
          folderPath,
        }),
      ],
    });

    try {
      await workspaceService.upsertWorkspace(workspace);
      await workspaceService.selectWorkspace(workspace.id);
      setActiveGroupId("all");
      setNoticeMessage(`Workspace creato: ${workspace.name}`);
    } catch (error) {
      setErrorMessage(`Creazione fallita: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

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
            <button type="button" className="topbar-chip topbar-chip--button" onClick={handleCreateWorkspace}>
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
          />
        </section>
      </div>
    </div>
  );
}

export default App;
