import {
  WORKSPACE_ACTION_TYPES,
  WORKSPACE_CATEGORIES,
  WORKSPACE_TRIGGER_TYPES,
  createWorkspace,
  createWorkspaceAction,
} from "./workspaceTypes.js";

const BASE = "~/Documents";
const TURBO_ROOT = "~/Documents/Side hustle/TurboConfigurator/workspace-launcher";

export const workspaceSeeds = [
  createWorkspace({
    id: "seed-metodi-numerici",
    name: "Metodi Numerici",
    description: "Apri la cartella del corso, il materiale recente e i riferimenti rapidi per studiare senza perdere il contesto.",
    category: WORKSPACE_CATEGORIES.STUDY,
    trigger: {
      type: WORKSPACE_TRIGGER_TYPES.GLOBAL_SHORTCUT,
      label: "Study hotkey",
      value: "Cmd+Opt+1",
    },
    tags: ["study", "university", "pdf"],
    notes: "Workspace pensato per sessioni di studio con materiale locale e riferimenti web.",
    actions: [
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_FOLDER, {
        name: "Open course folder",
        folderPath: `${BASE}/Universita/Metodi Numerici`,
      }),
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_LATEST_FILE_IN_FOLDER, {
        name: "Open latest study file",
        folderPath: `${BASE}/Universita/Metodi Numerici`,
        fileExtensions: ["pdf", "md", "txt"],
      }),
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_URL, {
        name: "Open lecture reference",
        url: "https://www.wolframalpha.com/",
      }),
    ],
  }),
  createWorkspace({
    id: "seed-aurea-dev-session",
    name: "Aurea Dev Session",
    description: "Riporta il progetto Aurea in focus, apre la repo, avvia i riferimenti tecnici e prepara il terminale per il pull.",
    category: WORKSPACE_CATEGORIES.CODING,
    trigger: {
      type: WORKSPACE_TRIGGER_TYPES.GLOBAL_SHORTCUT,
      label: "Dev hotkey",
      value: "Cmd+Opt+2",
    },
    tags: ["code", "repo", "terminal", "git"],
    notes: "Workspace pensato per iniziare una sessione di sviluppo reale.",
    actions: [
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_APP, {
        name: "Open Terminal",
        appName: "Terminal",
      }),
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_FOLDER, {
        name: "Open workspace folder",
        folderPath: TURBO_ROOT,
      }),
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.RUN_SHELL_COMMAND, {
        name: "Pull latest changes",
        command: "git pull --ff-only",
        cwd: TURBO_ROOT,
        shell: "zsh",
      }),
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_VSCODE_PROJECT, {
        name: "Open project in VS Code",
        projectPath: TURBO_ROOT,
      }),
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_URL, {
        name: "Open Tauri docs",
        url: "https://tauri.app/",
      }),
    ],
  }),
  createWorkspace({
    id: "seed-basi-di-dati",
    name: "Basi di Dati",
    description: "Apre il materiale del corso, il PDF piu recente e la documentazione essenziale per esercizi e ripasso.",
    category: WORKSPACE_CATEGORIES.STUDY,
    trigger: {
      type: WORKSPACE_TRIGGER_TYPES.GLOBAL_SHORTCUT,
      label: "Study hotkey",
      value: "Cmd+Opt+3",
    },
    tags: ["database", "course", "reference"],
    notes: "Workspace per studio teorico e pratica su database.",
    actions: [
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_APP, {
        name: "Open Preview",
        appName: "Preview",
      }),
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_FOLDER, {
        name: "Open course folder",
        folderPath: `${BASE}/Universita/Basi di Dati`,
      }),
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_LATEST_FILE_IN_FOLDER, {
        name: "Open latest database note",
        folderPath: `${BASE}/Universita/Basi di Dati`,
        fileExtensions: ["pdf", "md", "sql", "txt"],
      }),
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_URL, {
        name: "Open PostgreSQL docs",
        url: "https://www.postgresql.org/docs/",
      }),
    ],
  }),
  createWorkspace({
    id: "seed-morning-reset",
    name: "Morning Reset",
    description: "Rimette il Mac in modalita operativa: apre gli strumenti quotidiani e ripulisce il punto di partenza.",
    category: WORKSPACE_CATEGORIES.PERSONAL,
    trigger: {
      type: WORKSPACE_TRIGGER_TYPES.GLOBAL_SHORTCUT,
      label: "Morning hotkey",
      value: "Cmd+Opt+4",
    },
    tags: ["routine", "morning", "personal"],
    notes: "Preset personale per iniziare la giornata con meno attrito.",
    actions: [
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_APP, {
        name: "Open Notes",
        appName: "Notes",
      }),
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_FOLDER, {
        name: "Open desktop",
        folderPath: "~/Desktop",
      }),
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.OPEN_URL, {
        name: "Open calendar",
        url: "https://calendar.google.com/",
      }),
      createWorkspaceAction(WORKSPACE_ACTION_TYPES.RUN_SHELL_COMMAND, {
        name: "Print morning status",
        command: "printf 'Morning workspace ready\\n'",
        cwd: "~/",
        shell: "zsh",
      }),
    ],
  }),
];

export function getWorkspaceSeeds() {
  return workspaceSeeds.map((workspace) => createWorkspace(workspace));
}

